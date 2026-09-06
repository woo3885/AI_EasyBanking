import type { ConversationState } from './conversation-types';

const BLOCKED_WORKFLOW_STATUSES = new Set([
  'SECURE_INPUT_REQUIRED',
  'RISK_WARNING',
  'FINAL_CONFIRMATION_REQUIRED',
  'COMPLETED',
  'CANCELLED',
  'ERROR',
  'TERMINATED'
]);

export function isConversationInteractionBlocked(state: ConversationState) {
  return (
    BLOCKED_WORKFLOW_STATUSES.has(state.workflowStatus) ||
    (state.sessionId !== null && state.connectionPhase !== 'CONNECTED')
  );
}
