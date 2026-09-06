import type {
  ConversationConnectionPhase,
  ConversationState,
  ConversationWorkflowStatus
} from './conversation-types';

export type AgentPageProtection =
  | 'NONE'
  | 'SECURE_INPUT_ACTIVE'
  | 'FINAL_CONFIRMATION_ACTIVE';

export type ConversationProtectionReason =
  | 'NONE'
  | 'SECURE_INPUT_REQUIRED'
  | 'SECURE_INPUT_ACTIVE'
  | 'RISK_WARNING'
  | 'FINAL_CONFIRMATION_REQUIRED'
  | 'RECONNECTING'
  | 'CONNECTION_UNAVAILABLE'
  | 'SESSION_TERMINAL';

export interface ConversationProtectionPolicy {
  reason: ConversationProtectionReason;
  announcement: string | null;
  canSubmitMessage: boolean;
  canStartStt: boolean;
  canPlayTts: boolean;
  canShowOverlay: boolean;
  canObserveTarget: boolean;
  canRestoreOverlay: boolean;
  canReconnect: boolean;
  shouldClearDraft: boolean;
  shouldStopTransport: boolean;
}

const TERMINAL_STATUSES = new Set<ConversationWorkflowStatus>([
  'COMPLETED',
  'CANCELLED',
  'ERROR',
  'TERMINATED'
]);

const PROTECTED_STATUSES = new Set<ConversationWorkflowStatus>([
  'SECURE_INPUT_REQUIRED',
  'RISK_WARNING',
  'FINAL_CONFIRMATION_REQUIRED',
  ...TERMINAL_STATUSES
]);

const ANNOUNCEMENTS: Record<Exclude<ConversationProtectionReason, 'NONE'>, string> = {
  SECURE_INPUT_REQUIRED: '보안 입력이 필요합니다. 채팅과 음성 안내를 잠시 중단합니다.',
  SECURE_INPUT_ACTIVE: '보안 정보를 직접 입력해 주세요. 입력 내용은 채팅에 저장되지 않습니다.',
  RISK_WARNING: '위험 확인이 필요합니다. 확인 전에는 AI 기능을 사용할 수 없습니다.',
  FINAL_CONFIRMATION_REQUIRED: '최종 확인 화면을 직접 검토해 주세요. 채팅으로 승인할 수 없습니다.',
  RECONNECTING: '안전하게 다시 연결하고 있습니다. 연결될 때까지 입력을 기다려 주세요.',
  CONNECTION_UNAVAILABLE: '대화 연결을 확인할 수 없습니다. 다시 연결한 뒤 이용해 주세요.',
  SESSION_TERMINAL: '현재 업무 세션이 종료되어 AI 기능을 사용할 수 없습니다.'
};

export function isTerminalWorkflowStatus(status: ConversationWorkflowStatus) {
  return TERMINAL_STATUSES.has(status);
}

export function isProtectedWorkflowStatus(status: ConversationWorkflowStatus) {
  return PROTECTED_STATUSES.has(status);
}

export function shouldClearDraftForStatus(status: ConversationWorkflowStatus) {
  return status === 'SECURE_INPUT_REQUIRED';
}

function protectionReason(
  status: ConversationWorkflowStatus,
  connectionPhase: ConversationConnectionPhase,
  hasSession: boolean,
  pageProtection: AgentPageProtection
): ConversationProtectionReason {
  if (pageProtection === 'SECURE_INPUT_ACTIVE') return 'SECURE_INPUT_ACTIVE';
  if (status === 'SECURE_INPUT_REQUIRED') return 'SECURE_INPUT_REQUIRED';
  if (status === 'RISK_WARNING') return 'RISK_WARNING';
  if (pageProtection === 'FINAL_CONFIRMATION_ACTIVE' || status === 'FINAL_CONFIRMATION_REQUIRED') {
    return 'FINAL_CONFIRMATION_REQUIRED';
  }
  if (isTerminalWorkflowStatus(status)) return 'SESSION_TERMINAL';
  if (hasSession && connectionPhase === 'RECONNECTING') return 'RECONNECTING';
  if (hasSession && connectionPhase !== 'CONNECTED') return 'CONNECTION_UNAVAILABLE';
  return 'NONE';
}

export function getConversationProtectionPolicy(
  state: ConversationState,
  pageProtection: AgentPageProtection = 'NONE'
): ConversationProtectionPolicy {
  const reason = protectionReason(
    state.workflowStatus,
    state.connectionPhase,
    state.sessionId !== null,
    pageProtection
  );
  const blocked = reason !== 'NONE';
  const terminal = isTerminalWorkflowStatus(state.workflowStatus);
  const protectedState = isProtectedWorkflowStatus(state.workflowStatus) || pageProtection !== 'NONE';

  return {
    reason,
    announcement: reason === 'NONE' ? null : ANNOUNCEMENTS[reason],
    canSubmitMessage: !blocked,
    canStartStt: !blocked,
    canPlayTts: !blocked,
    canShowOverlay: !blocked,
    canObserveTarget: !blocked,
    canRestoreOverlay: !protectedState,
    canReconnect:
      state.sessionId !== null &&
      !terminal &&
      (state.connectionPhase === 'RECONNECTING' ||
        state.connectionPhase === 'ERROR' ||
        state.connectionPhase === 'DISCONNECTED'),
    shouldClearDraft:
      pageProtection === 'SECURE_INPUT_ACTIVE' ||
      shouldClearDraftForStatus(state.workflowStatus),
    shouldStopTransport: terminal
  };
}

export function isConversationInteractionBlocked(
  state: ConversationState,
  pageProtection: AgentPageProtection = 'NONE'
) {
  return !getConversationProtectionPolicy(state, pageProtection).canSubmitMessage;
}
