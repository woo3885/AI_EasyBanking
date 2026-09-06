import { describe, expect, it } from 'vitest';

import { conversationReducer } from '../../src/features/AgentChat/model/conversation-reducer';
import {
  createInitialConversationState,
  SAFE_MESSAGE_SUBMIT_ERROR,
  type AiMessageEvent,
  type AiQuestionEvent,
  type ConversationMessage,
  type ConversationSnapshot,
  type ConversationState
} from '../../src/features/AgentChat/model/conversation-types';

function localMessage(messageId = 'local-message-1', text = '예금 상품 알아보기'): ConversationMessage {
  return { messageId, requestId: 'request-1', role: 'USER', kind: 'MESSAGE', sequence: null,
    text, questionId: null, goalRevision: null, occurredAt: '2026-09-01T00:00:00.000Z' };
}

function withSession(state = createInitialConversationState()) {
  return conversationReducer(state, { type: 'SESSION_ASSIGNED', sessionId: 'session-1' });
}

function aiMessage(eventSequence: number, sequence = eventSequence, messageId = `ai-${sequence}`, goalRevision = 1): AiMessageEvent {
  return { eventId: `event-${eventSequence}`, eventSequence, eventType: 'AI_MESSAGE', sessionId: 'session-1',
    workflowStatus: 'AI_EXECUTING', occurredAt: '2026-09-01T00:00:01.000Z', messageId, sequence,
    text: '알겠습니다.', kind: 'MESSAGE', goalRevision, errorCode: null };
}

function aiQuestion(eventSequence: number, questionId = `question-${eventSequence}`): AiQuestionEvent {
  return { eventId: `event-${eventSequence}`, eventSequence, eventType: 'AI_QUESTION', sessionId: 'session-1',
    workflowStatus: 'ADDITIONAL_INFORMATION_REQUIRED', occurredAt: '2026-09-01T00:00:02.000Z',
    messageId: `ai-question-${eventSequence}`, sequence: eventSequence, text: '예금 기간은 몇 개월로 할까요?',
    questionId, kind: 'QUESTION', goalRevision: eventSequence };
}

function submit(state = createInitialConversationState()) {
  return conversationReducer(state, { type: 'MESSAGE_SUBMIT_STARTED', requestId: 'request-1', message: localMessage() });
}

function snapshot(overrides: Partial<ConversationSnapshot> = {}): ConversationSnapshot {
  return { snapshotId: 'snapshot-1', sessionId: 'session-1', eventSequence: 0, conversationSequence: 0,
    goalRevision: 0, userGoal: { goalId: 'goal-1' }, activeQuestion: null, recentSafeMessages: [],
    workflowStatus: 'SESSION_CREATED', expiresAt: '2026-09-01T01:00:00.000Z', ...overrides };
}

describe('conversationReducer', () => {
  it('초기 상태를 안전한 기본값으로 생성한다', () => {
    expect(createInitialConversationState()).toMatchObject({ sessionId: null, messages: [], lastEventSequence: 0,
      conversationSequence: 0, goalRevision: 0, seenEventIds: [], activeQuestion: null, draft: '',
      submitPhase: 'IDLE', pendingRequestId: null, pendingMessageId: null, safeError: null,
      connectionPhase: 'DISCONNECTED', workflowStatus: 'SESSION_CREATED' });
  });

  it('제출 시 local message와 request identity를 별도로 보존한다', () => {
    const state = submit();
    expect(state.messages[0]).toMatchObject({ messageId: 'local-message-1', sequence: null });
    expect(state).toMatchObject({ pendingRequestId: 'request-1', pendingMessageId: 'local-message-1', submitPhase: 'SUBMITTING' });
  });

  it('정책을 우회한 민감정보를 reducer 상태에 저장하지 않는다', () => {
    const state = conversationReducer(createInitialConversationState(), {
      type: 'MESSAGE_SUBMIT_STARTED', requestId: 'unsafe-request', message: localMessage('unsafe', '비밀번호는 4321이야')
    });
    expect(state.messages).toHaveLength(0);
  });

  it('HTTP ACK는 완료가 아니라 AI 응답 대기로 전환하고 message sequence만 기록한다', () => {
    const state = conversationReducer(submit(), { type: 'MESSAGE_ACKNOWLEDGED', requestId: 'request-1',
      messageId: 'local-message-1', acceptedSequence: 3 });
    expect(state.submitPhase).toBe('WAITING_FOR_AI');
    expect(state.conversationSequence).toBe(3);
    expect(state.lastEventSequence).toBe(0);
  });

  it('duplicate ACK는 이미 대기 중인 상태를 다시 변경하지 않는다', () => {
    const acknowledged = conversationReducer(submit(), { type: 'MESSAGE_ACKNOWLEDGED', requestId: 'request-1',
      messageId: 'local-message-1', acceptedSequence: 3 });
    expect(conversationReducer(acknowledged, { type: 'MESSAGE_ACKNOWLEDGED', requestId: 'request-1',
      messageId: 'local-message-1', acceptedSequence: 4 })).toBe(acknowledged);
  });

  it('event sequence와 message sequence를 독립적으로 보존한다', () => {
    const state = conversationReducer(withSession(), { type: 'SERVER_EVENT_RECEIVED', event: aiMessage(9, 2) });
    expect(state.lastEventSequence).toBe(9);
    expect(state.conversationSequence).toBe(2);
    expect(state.messages[0].sequence).toBe(2);
  });

  it('stale 이벤트와 다른 session 이벤트를 무시한다', () => {
    const first = conversationReducer(withSession(), { type: 'SERVER_EVENT_RECEIVED', event: aiMessage(2) });
    const stale = conversationReducer(first, { type: 'SERVER_EVENT_RECEIVED', event: aiMessage(1) });
    const foreign = { ...aiMessage(3), sessionId: 'foreign' };
    expect(conversationReducer(stale, { type: 'SERVER_EVENT_RECEIVED', event: foreign })).toBe(first);
  });

  it('eventId와 messageId 중복을 차단한다', () => {
    const first = conversationReducer(withSession(), { type: 'SERVER_EVENT_RECEIVED', event: aiMessage(1, 1, 'same') });
    const duplicateMessage = conversationReducer(first, { type: 'SERVER_EVENT_RECEIVED', event: aiMessage(2, 2, 'same') });
    const duplicateEvent = conversationReducer(duplicateMessage, { type: 'SERVER_EVENT_RECEIVED', event: { ...aiMessage(3), eventId: 'event-2' } });
    expect(duplicateMessage.messages).toHaveLength(1);
    expect(duplicateMessage.lastEventSequence).toBe(2);
    expect(duplicateEvent).toBe(duplicateMessage);
  });

  it('일반 AI 메시지만으로 activeQuestion을 지우지 않는다', () => {
    const question = conversationReducer(withSession(), { type: 'SERVER_EVENT_RECEIVED', event: aiQuestion(1, 'question-old') });
    const reply = conversationReducer(question, { type: 'SERVER_EVENT_RECEIVED', event: aiMessage(2, 2, 'answer', 2) });
    expect(reply.activeQuestion?.questionId).toBe('question-old');
  });

  it('새 AI 질문은 activeQuestion을 교체한다', () => {
    const old = conversationReducer(withSession(), { type: 'SERVER_EVENT_RECEIVED', event: aiQuestion(1, 'old') });
    const next = conversationReducer(old, { type: 'SERVER_EVENT_RECEIVED', event: aiQuestion(2, 'new') });
    expect(next.activeQuestion?.questionId).toBe('new');
  });

  it('최신 live 이벤트보다 오래된 snapshot을 무시한다', () => {
    const live = conversationReducer(withSession(), { type: 'SERVER_EVENT_RECEIVED', event: aiMessage(5) });
    expect(conversationReducer(live, { type: 'SNAPSHOT_RESTORED', snapshot: snapshot({ eventSequence: 4 }) })).toBe(live);
  });

  it('동일하거나 최신 snapshot의 null activeQuestion만 질문을 제거한다', () => {
    const question = conversationReducer(withSession(), { type: 'SERVER_EVENT_RECEIVED', event: aiQuestion(2) });
    const restored = conversationReducer(question, { type: 'SNAPSHOT_RESTORED', snapshot: snapshot({
      eventSequence: 2, conversationSequence: 3, goalRevision: 3, activeQuestion: null
    }) });
    expect(restored.activeQuestion).toBeNull();
  });

  it('snapshot 메시지와 아직 ACK되지 않은 로컬 메시지를 messageId로 병합한다', () => {
    const local = withSession(submit());
    const restored = conversationReducer(local, { type: 'SNAPSHOT_RESTORED', snapshot: snapshot() });
    expect(restored.messages).toHaveLength(1);
    expect(restored.messages[0].sequence).toBeNull();
  });

  it('구독 전에 놓친 USER_MESSAGE_ACCEPTED를 snapshot message sequence로 복원한다', () => {
    const local = withSession(submit());
    const restored = conversationReducer(local, { type: 'SNAPSHOT_RESTORED', snapshot: snapshot({
      eventSequence: 1, conversationSequence: 1,
      recentSafeMessages: [{ ...localMessage(), sequence: 1, goalRevision: null }]
    }) });
    expect(restored.messages).toHaveLength(1);
    expect(restored.messages[0].sequence).toBe(1);
    expect(restored.conversationSequence).toBe(1);
  });

  it('느린 이전 request 실패가 최신 상태를 변경하지 않는다', () => {
    const state = submit();
    expect(conversationReducer(state, { type: 'MESSAGE_SUBMIT_FAILED', requestId: 'older' })).toBe(state);
  });

  it('최신 request 실패에서 raw error 대신 고정 안내만 저장한다', () => {
    const failed = conversationReducer(submit(), { type: 'MESSAGE_SUBMIT_FAILED', requestId: 'request-1' });
    expect(failed.safeError).toBe(SAFE_MESSAGE_SUBMIT_ERROR);
  });

  it('reset은 대화 상태를 지우고 연결 상태만 유지한다', () => {
    const state: ConversationState = { ...submit(), connectionPhase: 'CONNECTED' };
    expect(conversationReducer(state, { type: 'CONVERSATION_RESET' })).toEqual(createInitialConversationState('CONNECTED'));
  });
});
