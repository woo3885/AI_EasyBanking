import { describe, expect, it } from 'vitest';

import { conversationReducer } from '../../src/features/AgentChat/model/conversation-reducer';
import { createInitialConversationState, type OverlayTargetEvent } from '../../src/features/AgentChat/model/conversation-types';

const targetEvent: OverlayTargetEvent = {
  eventId: 'event-10', eventSequence: 10, eventType: 'OVERLAY_TARGET',
  sessionId: 'session-1', workflowStatus: 'USER_DECISION_REQUIRED', targetId: 'target-1',
  pageIdentity: 'page-1', sourceSnapshotId: 'snap-1', coordinateSpace: 'VIEWPORT_CSS_PX',
  rectangle: { x: 10, y: 20, width: 100, height: 50 }, viewport: { width: 1280, height: 720 },
  role: 'button', label: '선택', guide: '버튼을 눌러 주세요.', actionMode: 'GUIDE_USER_CLICK',
  expiresAt: '2099-01-01T00:00:00Z', occurredAt: '2026-09-06T12:00:00Z'
};

function withTarget() {
  let state = conversationReducer(createInitialConversationState('CONNECTED'), {
    type: 'SESSION_ASSIGNED', sessionId: 'session-1'
  });
  state = conversationReducer(state, { type: 'BRIDGE_RECOVERED', pageIdentity: 'page-1', activeTarget: null });
  return conversationReducer(state, { type: 'SERVER_EVENT_RECEIVED', event: targetEvent });
}

describe('Overlay conversation state', () => {
  it('새 target이 이전 target을 교체하고 stale·duplicate event를 무시한다', () => {
    const state = withTarget();
    const replaced = conversationReducer(state, { type: 'SERVER_EVENT_RECEIVED', event: {
      ...targetEvent, eventId: 'event-11', eventSequence: 11, targetId: 'target-2', sourceSnapshotId: 'snap-2'
    } });
    expect(replaced.activeTarget?.targetId).toBe('target-2');
    expect(conversationReducer(replaced, { type: 'SERVER_EVENT_RECEIVED', event: targetEvent })).toBe(replaced);
    expect(conversationReducer(replaced, { type: 'SERVER_EVENT_RECEIVED', event: {
      ...targetEvent, eventId: 'event-11', eventSequence: 12
    } })).toBe(replaced);
  });

  it('OVERLAY_CLEAR identity가 현재 target과 일치할 때만 안내를 제거한다', () => {
    const state = withTarget();
    const foreign = conversationReducer(state, { type: 'SERVER_EVENT_RECEIVED', event: {
      eventId: 'event-11', eventSequence: 11, eventType: 'OVERLAY_CLEAR', sessionId: 'session-1',
      targetId: 'target-2', pageIdentity: 'page-1', sourceSnapshotId: 'snap-1', reason: 'REPLACED',
      occurredAt: '2026-09-06T12:01:00Z'
    } });
    expect(foreign.activeTarget?.targetId).toBe('target-1');

    const cleared = conversationReducer(foreign, { type: 'SERVER_EVENT_RECEIVED', event: {
      eventId: 'event-12', eventSequence: 12, eventType: 'OVERLAY_CLEAR', sessionId: 'session-1',
      targetId: 'target-1', pageIdentity: 'page-1', sourceSnapshotId: 'snap-1', reason: 'USER_ACTION',
      occurredAt: '2026-09-06T12:01:01Z'
    } });
    expect(cleared.activeTarget).toBeNull();
  });

  it('재연결 전환 시 이전 좌표 target을 제거한다', () => {
    const state = withTarget();
    const reconnecting = conversationReducer(state, {
      type: 'CONNECTION_CHANGED', connectionPhase: 'RECONNECTING'
    });
    expect(reconnecting.activeTarget).toBeNull();
    expect(reconnecting.observationPhase).toBe('IDLE');
  });

  it('page identity와 session 변경 시 이전 target을 복원하지 않는다', () => {
    const state = withTarget();
    const nextPage = conversationReducer(state, {
      type: 'BRIDGE_RECOVERED', pageIdentity: 'page-2', activeTarget: null
    });
    expect(nextPage.activeTarget).toBeNull();
    const nextSession = conversationReducer(state, { type: 'SESSION_ASSIGNED', sessionId: 'session-2' });
    expect(nextSession).toMatchObject({ sessionId: 'session-2', pageIdentity: null, activeTarget: null });
  });

  it.each(['SECURE_INPUT_REQUIRED', 'RISK_WARNING', 'FINAL_CONFIRMATION_REQUIRED', 'COMPLETED'] as const)(
    '%s 상태에서 target과 pending observation을 제거한다', (workflowStatus) => {
      let state = withTarget();
      state = conversationReducer(state, { type: 'OBSERVATION_STARTED', observation: {
        requestId: 'request-1', targetId: 'target-1', pageIdentity: 'page-1', sourceSnapshotId: 'snap-1'
      } });
      state = conversationReducer(state, { type: 'SERVER_EVENT_RECEIVED', event: {
        eventId: `event-${workflowStatus}`, eventSequence: 11, eventType: 'AI_MESSAGE', sessionId: 'session-1',
        workflowStatus, occurredAt: '2026-09-06T12:01:00Z', messageId: `message-${workflowStatus}`,
        sequence: 1, text: '안전 상태 안내', kind: 'MESSAGE', goalRevision: 1, errorCode: null
      } });
      expect(state.activeTarget).toBeNull();
      expect(state.pendingObservation).toBeNull();
    }
  );

  it('202 ACK는 대기 상태만 만들고 observed identity가 일치해야 완료한다', () => {
    let state = withTarget();
    state = conversationReducer(state, { type: 'OBSERVATION_STARTED', observation: {
      requestId: 'request-1', targetId: 'target-1', pageIdentity: 'page-1', sourceSnapshotId: 'snap-1'
    } });
    state = conversationReducer(state, { type: 'OBSERVATION_ACKNOWLEDGED', requestId: 'request-1', targetId: 'target-1' });
    expect(state.observationPhase).toBe('WAITING_FOR_RESULT');
    const foreign = conversationReducer(state, { type: 'SERVER_EVENT_RECEIVED', event: {
      eventId: 'event-11', eventSequence: 11, eventType: 'USER_ACTION_OBSERVED', sessionId: 'session-1',
      workflowStatus: 'AI_EXECUTING', observationId: 'observation-2', requestId: 'other', targetId: 'target-1',
      pageIdentity: 'page-1', sourceSnapshotId: 'snap-1', resultingSnapshotId: 'snap-2',
      status: 'DOM_CHANGE_CONFIRMED', occurredAt: '2026-09-06T12:01:00Z'
    } });
    expect(foreign.observationPhase).toBe('WAITING_FOR_RESULT');
    const completed = conversationReducer(foreign, { type: 'SERVER_EVENT_RECEIVED', event: {
      eventId: 'event-12', eventSequence: 12, eventType: 'USER_ACTION_OBSERVED', sessionId: 'session-1',
      workflowStatus: 'AI_EXECUTING', observationId: 'observation-1', requestId: 'request-1', targetId: 'target-1',
      pageIdentity: 'page-1', sourceSnapshotId: 'snap-1', resultingSnapshotId: 'snap-2',
      status: 'DOM_CHANGE_CONFIRMED', occurredAt: '2026-09-06T12:01:01Z'
    } });
    expect(completed.observationPhase).toBe('IDLE');
    expect(completed.pendingObservation).toBeNull();
  });
});
