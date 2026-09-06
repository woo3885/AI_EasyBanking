import type {
  SessionConfirmation,
  SessionDecision,
  SessionSecureInput,
  SessionTarget,
  SessionUiSnapshot
} from '@/features/Integration/api/session-status-transport';
import { getWorkflowStatusPresentation } from '@/shared/model/workflow-status-presentation';
import type { WorkflowStatus } from '@/types/frontend-state';

export type SessionUiConnectionPhase =
  | 'CONNECTING'
  | 'RESYNCING'
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'ERROR';

export type DecisionSubmitPhase =
  | 'IDLE'
  | 'SELECTING'
  | 'SUBMITTING'
  | 'WAITING_FOR_RESUME'
  | 'ERROR';

export type SecureInputSubmitPhase =
  | 'IDLE'
  | 'WAITING_FOR_USER'
  | 'SUBMITTING'
  | 'WAITING_FOR_RESUME'
  | 'ERROR';

export type ConfirmationSubmitPhase =
  | 'IDLE'
  | 'REVIEWING'
  | 'SUBMITTING_APPROVAL'
  | 'SUBMITTING_REJECTION'
  | 'WAITING_FOR_RESULT'
  | 'ERROR';

export interface SessionUiState {
  sessionId: string;
  workflowStatus: WorkflowStatus;
  guideMessage: string;
  lastEventSequence: number | null;
  target: SessionTarget | null;
  activeDecision: SessionDecision | null;
  selectedOptionId: string | null;
  selectedTermIds: ReadonlySet<string>;
  decisionSubmitPhase: DecisionSubmitPhase;
  safeDecisionError: string;
  activeSecureInput: SessionSecureInput | null;
  secureInputSubmitPhase: SecureInputSubmitPhase;
  safeSecureInputError: string;
  activeConfirmation: SessionConfirmation | null;
  confirmationConfirmed: boolean;
  confirmationSubmitPhase: ConfirmationSubmitPhase;
  safeConfirmationError: string;
  connectionPhase: SessionUiConnectionPhase;
  safeError: string;
}

export const TARGET_BLOCKED_STATUSES: ReadonlySet<WorkflowStatus> = new Set([
  'SECURE_INPUT_REQUIRED',
  'FINAL_CONFIRMATION_REQUIRED',
  'RISK_WARNING',
  'COMPLETED',
  'CANCELLED',
  'ERROR',
  'TERMINATED'
]);

export const VIEWER_ACTION_BLOCKED_STATUSES = TARGET_BLOCKED_STATUSES;

export const TERMINAL_WORKFLOW_STATUSES: ReadonlySet<WorkflowStatus> = new Set([
  'COMPLETED',
  'CANCELLED',
  'TERMINATED'
]);

export function defaultWorkflowMessage(status: WorkflowStatus): string {
  return getWorkflowStatusPresentation(status).description;
}

export function createInitialSessionUiState(
  sessionId: string,
  initialStatus: WorkflowStatus = 'SESSION_CREATED'
): SessionUiState {
  return {
    sessionId,
    workflowStatus: initialStatus,
    guideMessage: defaultWorkflowMessage(initialStatus),
    lastEventSequence: null,
    target: null,
    activeDecision: null,
    selectedOptionId: null,
    selectedTermIds: new Set<string>(),
    decisionSubmitPhase: 'IDLE',
    safeDecisionError: '',
    activeSecureInput: null,
    secureInputSubmitPhase: 'IDLE',
    safeSecureInputError: '',
    activeConfirmation: null,
    confirmationConfirmed: false,
    confirmationSubmitPhase: 'IDLE',
    safeConfirmationError: '',
    connectionPhase: 'CONNECTING',
    safeError: ''
  };
}

export function clearSessionConfirmation(
  state: SessionUiState
): SessionUiState {
  return {
    ...state,
    activeConfirmation: null,
    confirmationConfirmed: false,
    confirmationSubmitPhase: 'IDLE',
    safeConfirmationError: ''
  };
}

export function clearSessionSecureInput(
  state: SessionUiState
): SessionUiState {
  return {
    ...state,
    activeSecureInput: null,
    secureInputSubmitPhase: 'IDLE',
    safeSecureInputError: ''
  };
}

export function initialDecisionSelection(decision: SessionDecision): {
  selectedOptionId: string | null;
  selectedTermIds: ReadonlySet<string>;
} {
  if (decision.decisionType === 'TERMS_AGREEMENT') {
    return {
      selectedOptionId: null,
      selectedTermIds: new Set(
        decision.options
          .filter((option) => option.checked && !option.disabled)
          .map((option) => option.id)
      )
    };
  }

  const checked = decision.options.filter(
    (option) => option.checked && !option.disabled
  );
  return {
    selectedOptionId: checked.length === 1 ? checked[0].id : null,
    selectedTermIds: new Set<string>()
  };
}

export function clearSessionDecision(
  state: SessionUiState
): SessionUiState {
  return {
    ...state,
    activeDecision: null,
    selectedOptionId: null,
    selectedTermIds: new Set<string>(),
    decisionSubmitPhase: 'IDLE',
    safeDecisionError: ''
  };
}

export function isTargetAllowed(status: WorkflowStatus): boolean {
  return !TARGET_BLOCKED_STATUSES.has(status);
}

export function isViewerActionAllowed(status: WorkflowStatus): boolean {
  return !VIEWER_ACTION_BLOCKED_STATUSES.has(status);
}

export interface SessionFrameIdentity {
  frameId: string;
  sequence: number;
}

export function isTargetMatchingFrame(
  target: SessionTarget | null,
  frame: SessionFrameIdentity | null
): boolean {
  if (target === null) return true;
  return (
    frame !== null &&
    target.frameId === frame.frameId &&
    target.frameSequence === frame.sequence
  );
}

export function isDecisionMatchingFrame(
  decision: SessionDecision | null,
  frame: SessionFrameIdentity | null
): boolean {
  return (
    decision !== null &&
    frame !== null &&
    decision.frameId === frame.frameId &&
    decision.frameSequence === frame.sequence
  );
}

export function isSecureInputMatchingFrame(
  secureInput: SessionSecureInput | null,
  frame: SessionFrameIdentity | null
): boolean {
  return (
    secureInput !== null &&
    frame !== null &&
    secureInput.frameId === frame.frameId &&
    secureInput.frameSequence === frame.sequence
  );
}

export function isConfirmationMatchingFrame(
  confirmation: SessionConfirmation | null,
  frame: SessionFrameIdentity | null
): boolean {
  return (
    confirmation !== null &&
    frame !== null &&
    confirmation.frameId === frame.frameId &&
    confirmation.frameSequence === frame.sequence
  );
}

export function canSubmitFinalConfirmation(input: {
  state: SessionUiState;
  frame: SessionFrameIdentity | null;
  frameReady: boolean;
  frameReconnecting: boolean;
  viewerActionPending: boolean;
  action: 'APPROVE' | 'REJECT';
}): boolean {
  const {
    state,
    frame,
    frameReady,
    frameReconnecting,
    viewerActionPending,
    action
  } = input;
  const confirmation = state.activeConfirmation;
  return (
    state.workflowStatus === 'FINAL_CONFIRMATION_REQUIRED' &&
    state.connectionPhase === 'CONNECTED' &&
    confirmation !== null &&
    confirmation.summary !== null &&
    (state.confirmationSubmitPhase === 'REVIEWING' ||
      state.confirmationSubmitPhase === 'ERROR') &&
    (action === 'REJECT' || state.confirmationConfirmed) &&
    frameReady &&
    !frameReconnecting &&
    !viewerActionPending &&
    state.activeDecision === null &&
    state.activeSecureInput === null &&
    state.decisionSubmitPhase !== 'SUBMITTING' &&
    state.secureInputSubmitPhase !== 'SUBMITTING' &&
    isConfirmationMatchingFrame(confirmation, frame)
  );
}

export function canSubmitSecureInputCompletion(input: {
  state: SessionUiState;
  frame: SessionFrameIdentity | null;
  frameReady: boolean;
  frameReconnecting: boolean;
  viewerActionPending: boolean;
}): boolean {
  const { state, frame, frameReady, frameReconnecting, viewerActionPending } = input;
  return (
    state.workflowStatus === 'SECURE_INPUT_REQUIRED' &&
    state.connectionPhase === 'CONNECTED' &&
    state.activeSecureInput !== null &&
    (state.secureInputSubmitPhase === 'WAITING_FOR_USER' ||
      state.secureInputSubmitPhase === 'ERROR') &&
    frameReady &&
    !frameReconnecting &&
    !viewerActionPending &&
    isSecureInputMatchingFrame(state.activeSecureInput, frame)
  );
}

export function selectedDecisionOptionIds(
  state: SessionUiState
): readonly string[] | null {
  const decision = state.activeDecision;
  if (!decision) return null;

  if (decision.decisionType === 'TERMS_AGREEMENT') {
    const enabledRequired = decision.options.filter(
      (option) => option.required && !option.disabled
    );
    if (
      decision.options.some((option) => option.required && option.disabled) ||
      enabledRequired.some((option) => !state.selectedTermIds.has(option.id))
    ) {
      return null;
    }
    return decision.options
      .filter(
        (option) => !option.disabled && state.selectedTermIds.has(option.id)
      )
      .map((option) => option.id);
  }

  const selected = decision.options.find(
    (option) =>
      option.id === state.selectedOptionId &&
      !option.disabled
  );
  return selected ? [selected.id] : null;
}

export function canSubmitSessionDecision(input: {
  state: SessionUiState;
  frame: SessionFrameIdentity | null;
  frameReady: boolean;
  frameReconnecting: boolean;
  viewerActionPending: boolean;
}): boolean {
  const { state, frame, frameReady, frameReconnecting, viewerActionPending } = input;
  return (
    state.workflowStatus === 'USER_DECISION_REQUIRED' &&
    state.connectionPhase === 'CONNECTED' &&
    state.activeDecision !== null &&
    (state.decisionSubmitPhase === 'SELECTING' ||
      state.decisionSubmitPhase === 'ERROR') &&
    frameReady &&
    !frameReconnecting &&
    !viewerActionPending &&
    isDecisionMatchingFrame(state.activeDecision, frame) &&
    selectedDecisionOptionIds(state) !== null
  );
}

export function selectVisibleSessionTarget(input: {
  state: SessionUiState;
  frame: SessionFrameIdentity | null;
  frameReady: boolean;
  frameReconnecting: boolean;
  actionPending: boolean;
}): SessionTarget | null {
  const { state, frame, frameReady, frameReconnecting, actionPending } = input;
  if (
    state.connectionPhase !== 'CONNECTED' ||
    !frameReady ||
    frameReconnecting ||
    actionPending ||
    !isTargetAllowed(state.workflowStatus) ||
    !isTargetMatchingFrame(state.target, frame)
  ) {
    return null;
  }
  return state.target;
}

export function statusFromSnapshot(
  snapshot: SessionUiSnapshot,
  fallback: WorkflowStatus
): WorkflowStatus {
  return snapshot.state?.status ?? fallback;
}
