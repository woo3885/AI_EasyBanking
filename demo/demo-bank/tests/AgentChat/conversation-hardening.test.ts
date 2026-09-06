import { describe, expect, it } from 'vitest';

import { conversationReducer } from '../../src/features/AgentChat/model/conversation-reducer';
import {
  createInitialConversationState,
  type AiMessageEvent,
  type ConversationState,
  type ConversationWorkflowStatus,
  type OverlayTargetEvent
} from '../../src/features/AgentChat/model/conversation-types';
import type { PublicOverlayTarget } from '../../src/features/AgentChat/model/overlay-types';

const target: PublicOverlayTarget = {
  contractVersion: 2, materializationMode: 'USER_DOM_PUBLIC_TARGET',
  targetId: 'target-1', sessionId: 'session-1', pageIdentity: 'page-1',
  sourceSnapshotId: 'snapshot-1', coordinateSpace: 'VIEWPORT_CSS_PX',
  rectangle: { x: 10, y: 20, width: 100, height: 56 },
  viewport: { width: 1280, height: 720 }, role: 'button', label: '상품 선택',
  guide: '이 버튼을 직접 눌러 주세요.', actionMode: 'GUIDE_USER_CLICK',
  locator: { type: 'PUBLIC_TARGET_KEY', publicTargetKey: 'deposit-product-12m-select',
    role: 'button', accessibleName: '상품 선택' },
  createdAt: '2026-09-06T00:00:00Z', expiresAt: '2099-09-06T00:01:00Z', consumedAt: null
};

function activeState(overrides: Partial<ConversationState> = {}): ConversationState {
  return {
    ...createInitialConversationState('CONNECTED'),
    sessionId: 'session-1', pageIdentity: 'page-1', draft: '안전한 후속 질문',
    activeTarget: target, observationPhase: 'WAITING_FOR_RESULT',
    pendingObservation: {
      requestId: 'observation-request-1', targetId: 'target-1',
      pageIdentity: 'page-1', sourceSnapshotId: 'snapshot-1',
      publicTargetKey: 'deposit-product-12m-select'
    },
    submitPhase: 'WAITING_FOR_ACK', pendingRequestId: 'message-request-1',
    pendingMessageId: 'message-1',
    ...overrides
  };
}

function statusEvent(workflowStatus: ConversationWorkflowStatus): AiMessageEvent {
  return {
    eventId: `event-${workflowStatus}`, eventSequence: 1, eventType: 'AI_MESSAGE',
    sessionId: 'session-1', workflowStatus, occurredAt: '2026-09-06T00:00:01Z',
    messageId: `message-${workflowStatus}`, sequence: 1, text: '현재 상태를 직접 확인해 주세요.',
    kind: 'MESSAGE', goalRevision: 1, errorCode: null
  };
}

describe('AgentChat protected-state reducer hardening', () => {
  it.each(['SECURE_INPUT_REQUIRED', 'RISK_WARNING', 'FINAL_CONFIRMATION_REQUIRED'] as const)(
    '%s immediately clears target and every pending request identity', (workflowStatus) => {
      const next = conversationReducer(activeState(), {
        type: 'SERVER_EVENT_RECEIVED', event: statusEvent(workflowStatus)
      });
      expect(next).toMatchObject({
        workflowStatus, activeTarget: null, observationPhase: 'IDLE',
        pendingObservation: null, submitPhase: 'IDLE',
        pendingRequestId: null, pendingMessageId: null
      });
      expect(next.draft).toBe(workflowStatus === 'SECURE_INPUT_REQUIRED' ? '' : '안전한 후속 질문');
    }
  );

  it('local secure policy clears draft and invalidates pending callbacks', () => {
    const protectedState = conversationReducer(activeState(), {
      type: 'PROTECTION_ENFORCED', clearDraft: true
    });
    expect(protectedState).toMatchObject({
      draft: '', activeTarget: null, pendingObservation: null,
      pendingRequestId: null, pendingMessageId: null, submitPhase: 'IDLE'
    });
    expect(conversationReducer(protectedState, {
      type: 'MESSAGE_ACKNOWLEDGED', requestId: 'message-request-1',
      messageId: 'message-1', acceptedSequence: 2
    })).toBe(protectedState);
  });

  it('protected snapshot cannot reactivate a bridge target', () => {
    const protectedState = { ...activeState({ activeTarget: null }), workflowStatus: 'RISK_WARNING' as const };
    const restored = conversationReducer(protectedState, {
      type: 'BRIDGE_RECOVERED', pageIdentity: 'page-1', activeTarget: target
    });
    expect(restored.activeTarget).toBeNull();
  });

  it('an Overlay event carrying a protected status is consumed without showing its target', () => {
    const event: OverlayTargetEvent = {
      eventId: 'event-protected-target', eventSequence: 1, eventType: 'OVERLAY_TARGET',
      sessionId: 'session-1', workflowStatus: 'FINAL_CONFIRMATION_REQUIRED',
      contractVersion: 2, materializationMode: 'USER_DOM_PUBLIC_TARGET',
      targetId: 'target-2', pageIdentity: 'page-1', sourceSnapshotId: 'snapshot-2',
      coordinateSpace: 'VIEWPORT_CSS_PX', rectangle: target.rectangle,
      viewport: target.viewport, role: 'button', label: '최종 승인', guide: '직접 확인해 주세요.',
      locator: { type: 'PUBLIC_TARGET_KEY', publicTargetKey: 'deposit-final-approve',
        role: 'button', accessibleName: '최종 승인' },
      actionMode: 'GUIDE_USER_CLICK', expiresAt: target.expiresAt,
      occurredAt: '2026-09-06T00:00:01Z'
    };
    const next = conversationReducer(activeState({
      activeTarget: null, pendingObservation: null, observationPhase: 'IDLE'
    }), { type: 'SERVER_EVENT_RECEIVED', event });
    expect(next.activeTarget).toBeNull();
    expect(next.lastEventSequence).toBe(1);
  });

  it('reconnect invalidates message and observation callbacks before any ACK can resume them', () => {
    const reconnecting = conversationReducer(activeState(), {
      type: 'CONNECTION_CHANGED', connectionPhase: 'RECONNECTING'
    });
    expect(reconnecting).toMatchObject({
      activeTarget: null, pendingObservation: null, pendingRequestId: null,
      pendingMessageId: null, submitPhase: 'IDLE'
    });
    expect(conversationReducer(reconnecting, {
      type: 'OBSERVATION_ACKNOWLEDGED', requestId: 'observation-request-1', targetId: 'target-1'
    })).toBe(reconnecting);
  });

  it('initial transport connection preserves the in-flight create-session ACK identity', () => {
    const connecting = conversationReducer(activeState(), {
      type: 'CONNECTION_CHANGED', connectionPhase: 'CONNECTING'
    });
    expect(connecting).toMatchObject({
      connectionPhase: 'CONNECTING', submitPhase: 'WAITING_FOR_ACK',
      pendingRequestId: 'message-request-1', pendingMessageId: 'message-1'
    });
    const acknowledged = conversationReducer(connecting, {
      type: 'MESSAGE_ACKNOWLEDGED', requestId: 'message-request-1',
      messageId: 'message-1', acceptedSequence: 2
    });
    expect(acknowledged).toMatchObject({
      submitPhase: 'WAITING_FOR_AI', conversationSequence: 2
    });
  });
});
