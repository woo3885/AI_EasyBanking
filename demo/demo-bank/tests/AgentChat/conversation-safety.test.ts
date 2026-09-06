import { describe, expect, it } from 'vitest';

import {
  getConversationProtectionPolicy,
  isProtectedWorkflowStatus,
  isTerminalWorkflowStatus
} from '../../src/features/AgentChat/model/conversation-safety';
import {
  createInitialConversationState,
  type ConversationState,
  type ConversationWorkflowStatus
} from '../../src/features/AgentChat/model/conversation-types';

function state(overrides: Partial<ConversationState> = {}): ConversationState {
  return {
    ...createInitialConversationState('CONNECTED'),
    sessionId: 'session-1',
    ...overrides
  };
}

describe('AgentChat centralized protection policy', () => {
  it('normal connected state permits user-controlled chat, speech, Overlay, and observation', () => {
    const policy = getConversationProtectionPolicy(state());
    expect(policy).toMatchObject({
      reason: 'NONE', canSubmitMessage: true, canStartStt: true, canPlayTts: true,
      canShowOverlay: true, canObserveTarget: true, canRestoreOverlay: true
    });
  });

  it.each([
    ['SECURE_INPUT_REQUIRED', 'SECURE_INPUT_REQUIRED'],
    ['RISK_WARNING', 'RISK_WARNING'],
    ['FINAL_CONFIRMATION_REQUIRED', 'FINAL_CONFIRMATION_REQUIRED']
  ] as const)('%s blocks every Agent interaction with a readable reason', (workflowStatus, reason) => {
    const policy = getConversationProtectionPolicy(state({ workflowStatus }));
    expect(policy.reason).toBe(reason);
    expect(policy.announcement).toBeTruthy();
    expect(policy).toMatchObject({
      canSubmitMessage: false, canStartStt: false, canPlayTts: false,
      canShowOverlay: false, canObserveTarget: false, canRestoreOverlay: false
    });
  });

  it('SECURE_INPUT_ACTIVE DOM policy clears draft and blocks target restoration', () => {
    const policy = getConversationProtectionPolicy(state(), 'SECURE_INPUT_ACTIVE');
    expect(policy).toMatchObject({
      reason: 'SECURE_INPUT_ACTIVE', shouldClearDraft: true,
      canSubmitMessage: false, canRestoreOverlay: false
    });
  });

  it('reconnect blocks interaction but permits an explicit reconnect without target restoration', () => {
    const policy = getConversationProtectionPolicy(state({ connectionPhase: 'RECONNECTING' }));
    expect(policy).toMatchObject({
      reason: 'RECONNECTING', canReconnect: true, canShowOverlay: false,
      canObserveTarget: false, canRestoreOverlay: true
    });
  });

  it.each(['COMPLETED', 'CANCELLED', 'ERROR', 'TERMINATED'] as ConversationWorkflowStatus[])(
    '%s is terminal and stops transport without reconnect', (workflowStatus) => {
      const policy = getConversationProtectionPolicy(state({ workflowStatus }));
      expect(policy).toMatchObject({
        reason: 'SESSION_TERMINAL', shouldStopTransport: true,
        canReconnect: false, canSubmitMessage: false
      });
      expect(isTerminalWorkflowStatus(workflowStatus)).toBe(true);
      expect(isProtectedWorkflowStatus(workflowStatus)).toBe(true);
    }
  );
});
