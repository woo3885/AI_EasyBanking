import { describe, expect, it } from 'vitest';

import { parseAcceptedAck, parseConversationEvent, parseConversationSnapshot, SAFE_AI_RESPONSE_ERROR } from '../../src/features/AgentChat/api/conversation-contract';

const baseEvent = {
  eventId: 'event-1', eventSequence: 1, sessionId: 'session-1',
  workflowStatus: 'AI_EXECUTING', occurredAt: '2026-09-03T00:00:00Z', messageId: 'message-1'
};

describe('conversation runtime contract', () => {
  it('202 ACK envelope를 검증한다', () => {
    expect(parseAcceptedAck({ success: true, errorCode: null, message: null, data: {
      sessionId: 'session-1', requestId: 'request-1', messageId: 'message-1', acceptedSequence: 1,
      queueStatus: 'ACTIVE', workflowStatus: 'SESSION_CREATED', acceptedAt: '2026-09-03T00:00:00Z', duplicate: false
    } })).toMatchObject({ sessionId: 'session-1', acceptedSequence: 1 });
    expect(parseAcceptedAck({ success: true, data: { sessionId: 'session-1' } })).toBeNull();
  });

  it('USER_MESSAGE_ACCEPTED를 파싱한다', () => {
    expect(parseConversationEvent({ ...baseEvent, eventType: 'USER_MESSAGE_ACCEPTED', acceptedSequence: 1 }))
      .toMatchObject({ eventType: 'USER_MESSAGE_ACCEPTED', acceptedSequence: 1 });
  });

  it('AI_QUESTION을 파싱한다', () => {
    expect(parseConversationEvent({ ...baseEvent, eventType: 'AI_QUESTION', workflowStatus: 'ADDITIONAL_INFORMATION_REQUIRED',
      sequence: 2, questionId: 'question-1', text: '기간은 몇 개월인가요?', kind: 'QUESTION', goalRevision: 1 }))
      .toMatchObject({ eventType: 'AI_QUESTION', questionId: 'question-1' });
  });

  it('AI_MESSAGE를 파싱하며 malformed payload를 차단한다', () => {
    expect(parseConversationEvent({ ...baseEvent, eventType: 'AI_MESSAGE', sequence: 2,
      text: '요청 정보를 반영했습니다.', kind: 'MESSAGE', goalRevision: 2, errorCode: null }))
      .toMatchObject({ eventType: 'AI_MESSAGE', goalRevision: 2 });
    expect(parseConversationEvent({ ...baseEvent, eventType: 'AI_MESSAGE', sequence: '2' })).toBeNull();
    expect(parseConversationEvent({ ...baseEvent, eventType: 'AI_MESSAGE', sequence: 2,
      text: 'stack trace raw', kind: 'MESSAGE', goalRevision: 2, errorCode: 'AI_FAILURE' }))
      .toMatchObject({ text: SAFE_AI_RESPONSE_ERROR });
  });

  it('snapshot의 safe messages와 activeQuestion을 파싱한다', () => {
    const snapshot = parseConversationSnapshot({ success: true, errorCode: null, message: null, data: {
      snapshotId: 'snapshot-1', sessionId: 'session-1', eventSequence: 3, conversationSequence: 2,
      goalRevision: 1, userGoal: { goalId: 'goal-1', revision: 1 }, activeQuestion: { questionId: 'question-1', messageId: 'ai-2',
        sequence: 2, text: '기간은 몇 개월인가요?', goalRevision: 1, occurredAt: '2026-09-03T00:00:01Z' },
      recentSafeMessages: [{ messageId: 'user-1', requestId: 'request-1', sequence: 1, role: 'USER',
        content: '예금 가입', kind: 'MESSAGE', questionId: null, goalRevision: null,
        occurredAt: '2026-09-03T00:00:00Z' }, { messageId: 'ai-2', requestId: null, sequence: 2, role: 'AI',
        content: '기간은 몇 개월인가요?', kind: 'QUESTION', questionId: 'question-1', goalRevision: 1,
        occurredAt: '2026-09-03T00:00:01Z' }], workflowStatus: 'ADDITIONAL_INFORMATION_REQUIRED',
      expiresAt: '2026-09-03T01:00:00Z'
    } });
    expect(snapshot?.activeQuestion?.questionId).toBe('question-1');
    expect(snapshot?.recentSafeMessages[0].goalRevision).toBeNull();
    expect(snapshot?.recentSafeMessages[1].kind).toBe('QUESTION');
  });
});
