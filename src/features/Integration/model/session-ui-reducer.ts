import type {
  SessionUiEvent,
  SessionUiSnapshot
} from '@/features/Integration/api/session-status-transport';
import type { WorkflowStatus } from '@/types/frontend-state';
import {
  TERMINAL_WORKFLOW_STATUSES,
  clearSessionConfirmation,
  clearSessionDecision,
  clearSessionSecureInput,
  createInitialSessionUiState,
  defaultWorkflowMessage,
  initialDecisionSelection,
  isTargetAllowed,
  statusFromSnapshot,
  type SessionFrameIdentity,
  type SessionUiState
} from './session-ui-state';

export type SessionUiAction =
  | { type: 'RESET'; sessionId: string; initialStatus?: WorkflowStatus }
  | { type: 'SYNC_STARTED' }
  | { type: 'CONNECTED' }
  | { type: 'DISCONNECTED' }
  | { type: 'SAFE_ERROR'; message: string }
  | { type: 'SNAPSHOT_REPLACED'; snapshot: SessionUiSnapshot }
  | { type: 'EVENT_RECEIVED'; event: SessionUiEvent }
  | { type: 'FRAME_OBSERVED'; frame: SessionFrameIdentity | null }
  | { type: 'DECISION_OPTION_SELECTED'; decisionId: string; optionId: string }
  | {
      type: 'DECISION_TERM_TOGGLED';
      decisionId: string;
      optionId: string;
      selected: boolean;
    }
  | { type: 'DECISION_SUBMIT_STARTED'; decisionId: string }
  | { type: 'DECISION_SUBMIT_ACKNOWLEDGED'; decisionId: string }
  | { type: 'DECISION_SUBMIT_FAILED'; decisionId: string; message: string }
  | { type: 'DECISION_SUBMIT_ABORTED'; decisionId: string }
  | { type: 'SECURE_INPUT_SUBMIT_STARTED'; secureRequestId: string }
  | { type: 'SECURE_INPUT_SUBMIT_ACKNOWLEDGED'; secureRequestId: string }
  | { type: 'SECURE_INPUT_SUBMIT_FAILED'; secureRequestId: string; message: string }
  | { type: 'SECURE_INPUT_SUBMIT_ABORTED'; secureRequestId: string }
  | {
      type: 'CONFIRMATION_CHECKED_CHANGED';
      confirmationId: string;
      confirmed: boolean;
    }
  | {
      type: 'CONFIRMATION_SUBMIT_STARTED';
      confirmationId: string;
      action: 'APPROVE' | 'REJECT';
    }
  | { type: 'CONFIRMATION_SUBMIT_ACKNOWLEDGED'; confirmationId: string }
  | {
      type: 'CONFIRMATION_SUBMIT_FAILED';
      confirmationId: string;
      message: string;
    }
  | { type: 'CONFIRMATION_SUBMIT_ABORTED'; confirmationId: string };

function isSameSession(state: SessionUiState, sessionId: string): boolean {
  return state.sessionId === sessionId;
}

function messageForEvent(
  event: SessionUiEvent,
  status: SessionUiState['workflowStatus']
): string {
  return event.message ?? defaultWorkflowMessage(status);
}

function applyEvent(
  state: SessionUiState,
  event: SessionUiEvent
): SessionUiState {
  if (
    !isSameSession(state, event.sessionId) ||
    (state.lastEventSequence !== null &&
      event.eventSequence <= state.lastEventSequence)
  ) {
    return state;
  }

  const sequenceState = {
    ...state,
    lastEventSequence: event.eventSequence,
    safeError: ''
  };

  if (
    (TERMINAL_WORKFLOW_STATUSES.has(state.workflowStatus) ||
      state.workflowStatus === 'ERROR' ||
      state.workflowStatus === 'RISK_WARNING') &&
    (event.eventType === 'SECURE_INPUT_REQUIRED' ||
      event.eventType === 'CONFIRMATION_REQUIRED')
  ) {
    return sequenceState;
  }

  switch (event.eventType) {
    case 'STATE': {
      const nextStatus = event.status;
      if (nextStatus === null) return sequenceState;
      if (
        TERMINAL_WORKFLOW_STATUSES.has(state.workflowStatus) &&
        nextStatus !== state.workflowStatus
      ) {
        return sequenceState;
      }
      const nextState = {
        ...sequenceState,
        workflowStatus: nextStatus,
        guideMessage: messageForEvent(event, nextStatus),
        target: isTargetAllowed(nextStatus) ? state.target : null
      };
      const decisionState = nextStatus === 'USER_DECISION_REQUIRED'
        ? nextState
        : clearSessionDecision(nextState);
      const secureState = nextStatus === 'SECURE_INPUT_REQUIRED'
        ? decisionState
        : clearSessionSecureInput(decisionState);
      return nextStatus === 'SECURE_INPUT_REQUIRED' ||
        nextStatus === 'RISK_WARNING' ||
        TERMINAL_WORKFLOW_STATUSES.has(nextStatus) ||
        nextStatus === 'ERROR'
        ? clearSessionConfirmation(secureState)
        : secureState;
    }
    case 'GUIDE':
      return {
        ...sequenceState,
        guideMessage: messageForEvent(event, state.workflowStatus)
      };
    case 'TARGET':
      return {
        ...sequenceState,
        target: isTargetAllowed(state.workflowStatus) ? event.target : null
      };
    case 'TARGET_CLEAR':
      return { ...sequenceState, target: null };
    case 'DECISION_REQUIRED': {
      const decision = event.decision;
      if (!decision) return clearSessionDecision(sequenceState);
      const sameDecision = state.activeDecision?.decisionId === decision.decisionId;
      if (!sameDecision) {
        return {
          ...sequenceState,
          activeDecision: decision,
          ...initialDecisionSelection(decision),
          decisionSubmitPhase: 'SELECTING',
          safeDecisionError: ''
        };
      }

      if (decision.decisionType === 'TERMS_AGREEMENT') {
        const availableIds = new Set(
          decision.options.filter((option) => !option.disabled).map((option) => option.id)
        );
        return {
          ...sequenceState,
          activeDecision: decision,
          selectedOptionId: null,
          selectedTermIds: new Set(
            Array.from(state.selectedTermIds).filter((id) => availableIds.has(id))
          )
        };
      }

      const selectedStillAvailable = decision.options.some(
        (option) => option.id === state.selectedOptionId && !option.disabled
      );
      return {
        ...sequenceState,
        activeDecision: decision,
        selectedOptionId: selectedStillAvailable
          ? state.selectedOptionId
          : initialDecisionSelection(decision).selectedOptionId,
        selectedTermIds: new Set<string>()
      };
    }
    case 'DECISION_RESOLVED':
    case 'DECISION_CLEAR':
      return clearSessionDecision(sequenceState);
    case 'SECURE_INPUT_REQUIRED': {
      const secureInput = event.secureInput;
      if (!secureInput) return clearSessionSecureInput(sequenceState);
      const sameRequest =
        state.activeSecureInput?.secureRequestId === secureInput.secureRequestId;
      return {
        ...sequenceState,
        workflowStatus: 'SECURE_INPUT_REQUIRED',
        guideMessage: event.message ?? secureInput.message,
        target: null,
        activeSecureInput: secureInput,
        secureInputSubmitPhase: sameRequest
          ? state.secureInputSubmitPhase
          : 'WAITING_FOR_USER',
        safeSecureInputError: sameRequest ? state.safeSecureInputError : ''
      };
    }
    case 'SECURE_INPUT_RESOLVED': {
      const nextStatus = event.status ?? state.workflowStatus;
      return clearSessionSecureInput(
        clearSessionDecision({
          ...sequenceState,
          workflowStatus: nextStatus,
          guideMessage: messageForEvent(event, nextStatus),
          target: null
        })
      );
    }
    case 'SECURE_INPUT_CLEAR':
      return clearSessionSecureInput(sequenceState);
    case 'CONFIRMATION_REQUIRED': {
      const confirmation = event.confirmation;
      if (!confirmation?.summary) {
        return clearSessionConfirmation(sequenceState);
      }
      const sameConfirmation =
        state.activeConfirmation?.confirmationId === confirmation.confirmationId;
      const nextState = clearSessionSecureInput(
        clearSessionDecision({
          ...sequenceState,
          workflowStatus: 'FINAL_CONFIRMATION_REQUIRED',
          guideMessage: messageForEvent(event, 'FINAL_CONFIRMATION_REQUIRED'),
          target: null
        })
      );
      return {
        ...nextState,
        activeConfirmation: confirmation,
        confirmationConfirmed: sameConfirmation
          ? state.confirmationConfirmed
          : false,
        confirmationSubmitPhase: sameConfirmation
          ? state.confirmationSubmitPhase
          : 'REVIEWING',
        safeConfirmationError: sameConfirmation
          ? state.safeConfirmationError
          : ''
      };
    }
    case 'CONFIRMATION_RESOLVED':
    case 'CONFIRMATION_REJECTED': {
      if (
        state.activeConfirmation?.confirmationId !==
        event.confirmation?.confirmationId
      ) {
        return sequenceState;
      }
      const nextStatus = event.status ?? state.workflowStatus;
      return clearSessionConfirmation({
        ...sequenceState,
        workflowStatus: nextStatus,
        guideMessage: messageForEvent(event, nextStatus),
        target: null
      });
    }
    case 'CONFIRMATION_CLEAR':
      return state.activeConfirmation?.confirmationId ===
        event.confirmation?.confirmationId
        ? clearSessionConfirmation(sequenceState)
        : sequenceState;
  }
}

function replaceSnapshot(
  state: SessionUiState,
  snapshot: SessionUiSnapshot
): SessionUiState {
  if (
    !isSameSession(state, snapshot.sessionId) ||
    (state.lastEventSequence !== null &&
      snapshot.latestEventSequence < state.lastEventSequence)
  ) {
    return state;
  }

  let workflowStatus = statusFromSnapshot(snapshot, state.workflowStatus);
  if (
    TERMINAL_WORKFLOW_STATUSES.has(state.workflowStatus) &&
    workflowStatus !== state.workflowStatus
  ) {
    workflowStatus = state.workflowStatus;
  }
  const guideMessage =
    snapshot.guide?.message ??
    snapshot.state?.message ??
    defaultWorkflowMessage(workflowStatus);
  const target =
    isTargetAllowed(workflowStatus) && snapshot.target?.target
      ? snapshot.target.target
      : null;
  let nextState: SessionUiState = {
    ...state,
    workflowStatus,
    guideMessage,
    lastEventSequence: snapshot.latestEventSequence,
    target,
    safeError: ''
  };
  if (
    workflowStatus === 'SECURE_INPUT_REQUIRED' &&
    snapshot.secureInput !== null
  ) {
    nextState = applyEvent(
      { ...clearSessionDecision(nextState), lastEventSequence: null },
      snapshot.secureInput
    );
    return {
      ...nextState,
      lastEventSequence: snapshot.latestEventSequence
    };
  }
  nextState = clearSessionSecureInput(nextState);
  if (
    workflowStatus === 'FINAL_CONFIRMATION_REQUIRED' &&
    snapshot.confirmation !== null
  ) {
    nextState = applyEvent(
      {
        ...clearSessionDecision(nextState),
        lastEventSequence: null
      },
      snapshot.confirmation
    );
    return {
      ...nextState,
      lastEventSequence: snapshot.latestEventSequence
    };
  }
  nextState = clearSessionConfirmation(nextState);
  if (workflowStatus !== 'USER_DECISION_REQUIRED' || snapshot.decision === null) {
    return clearSessionDecision(nextState);
  }

  nextState = applyEvent(
    { ...nextState, lastEventSequence: null },
    snapshot.decision
  );
  return {
    ...nextState,
    lastEventSequence: snapshot.latestEventSequence
  };
}

export function sessionUiReducer(
  state: SessionUiState,
  action: SessionUiAction
): SessionUiState {
  switch (action.type) {
    case 'RESET':
      return createInitialSessionUiState(
        action.sessionId,
        action.initialStatus ?? 'SESSION_CREATED'
      );
    case 'SYNC_STARTED':
      return {
        ...state,
        connectionPhase: 'RESYNCING',
        target: null,
        decisionSubmitPhase:
          state.decisionSubmitPhase === 'SUBMITTING'
            ? 'SELECTING'
            : state.decisionSubmitPhase,
        secureInputSubmitPhase:
          state.secureInputSubmitPhase === 'SUBMITTING'
            ? 'WAITING_FOR_USER'
            : state.secureInputSubmitPhase,
        confirmationSubmitPhase:
          state.confirmationSubmitPhase === 'SUBMITTING_APPROVAL' ||
          state.confirmationSubmitPhase === 'SUBMITTING_REJECTION'
            ? 'REVIEWING'
            : state.confirmationSubmitPhase,
        safeError: ''
      };
    case 'CONNECTED':
      return { ...state, connectionPhase: 'CONNECTED', safeError: '' };
    case 'DISCONNECTED':
      return {
        ...state,
        connectionPhase: 'DISCONNECTED',
        target: null,
        decisionSubmitPhase:
          state.decisionSubmitPhase === 'SUBMITTING'
            ? 'SELECTING'
            : state.decisionSubmitPhase,
        secureInputSubmitPhase:
          state.secureInputSubmitPhase === 'SUBMITTING'
            ? 'WAITING_FOR_USER'
            : state.secureInputSubmitPhase,
        confirmationSubmitPhase:
          state.confirmationSubmitPhase === 'SUBMITTING_APPROVAL' ||
          state.confirmationSubmitPhase === 'SUBMITTING_REJECTION'
            ? 'REVIEWING'
            : state.confirmationSubmitPhase,
        safeError: '실시간 상태 연결이 끊겼습니다. 자동으로 복구하고 있습니다.'
      };
    case 'SAFE_ERROR':
      return {
        ...state,
        connectionPhase: 'ERROR',
        target: null,
        decisionSubmitPhase:
          state.decisionSubmitPhase === 'SUBMITTING'
            ? 'SELECTING'
            : state.decisionSubmitPhase,
        secureInputSubmitPhase:
          state.secureInputSubmitPhase === 'SUBMITTING'
            ? 'WAITING_FOR_USER'
            : state.secureInputSubmitPhase,
        confirmationSubmitPhase:
          state.confirmationSubmitPhase === 'SUBMITTING_APPROVAL' ||
          state.confirmationSubmitPhase === 'SUBMITTING_REJECTION'
            ? 'REVIEWING'
            : state.confirmationSubmitPhase,
        safeError: action.message
      };
    case 'SNAPSHOT_REPLACED':
      return replaceSnapshot(state, action.snapshot);
    case 'EVENT_RECEIVED':
      return applyEvent(state, action.event);
    case 'FRAME_OBSERVED': {
      const target = state.target;
      const decision = state.activeDecision;
      const confirmation = state.activeConfirmation;
      if (!action.frame) return state;
      const targetIsStale = Boolean(
        target &&
          (action.frame.sequence > target.frameSequence ||
            (action.frame.sequence === target.frameSequence &&
              action.frame.frameId !== target.frameId))
      );
      const decisionIsStale = Boolean(
        decision &&
          (action.frame.sequence > decision.frameSequence ||
            (action.frame.sequence === decision.frameSequence &&
              action.frame.frameId !== decision.frameId))
      );
      const confirmationIsStale = Boolean(
        confirmation &&
          (action.frame.sequence > confirmation.frameSequence ||
            (action.frame.sequence === confirmation.frameSequence &&
              action.frame.frameId !== confirmation.frameId))
      );
      const nextState = targetIsStale ? { ...state, target: null } : state;
      const decisionState = decisionIsStale
        ? clearSessionDecision(nextState)
        : nextState;
      return confirmationIsStale
        ? clearSessionConfirmation(decisionState)
        : decisionState;
    }
    case 'DECISION_OPTION_SELECTED': {
      const decision = state.activeDecision;
      if (
        !decision ||
        decision.decisionId !== action.decisionId ||
        decision.decisionType === 'TERMS_AGREEMENT' ||
        !decision.options.some(
          (option) => option.id === action.optionId && !option.disabled
        ) ||
        state.decisionSubmitPhase === 'SUBMITTING' ||
        state.decisionSubmitPhase === 'WAITING_FOR_RESUME'
      ) {
        return state;
      }
      return {
        ...state,
        selectedOptionId: action.optionId,
        decisionSubmitPhase: 'SELECTING',
        safeDecisionError: ''
      };
    }
    case 'DECISION_TERM_TOGGLED': {
      const decision = state.activeDecision;
      if (
        !decision ||
        decision.decisionId !== action.decisionId ||
        decision.decisionType !== 'TERMS_AGREEMENT' ||
        !decision.options.some(
          (option) => option.id === action.optionId && !option.disabled
        ) ||
        state.decisionSubmitPhase === 'SUBMITTING' ||
        state.decisionSubmitPhase === 'WAITING_FOR_RESUME'
      ) {
        return state;
      }
      const selectedTermIds = new Set(state.selectedTermIds);
      if (action.selected) selectedTermIds.add(action.optionId);
      else selectedTermIds.delete(action.optionId);
      return {
        ...state,
        selectedTermIds,
        decisionSubmitPhase: 'SELECTING',
        safeDecisionError: ''
      };
    }
    case 'DECISION_SUBMIT_STARTED':
      return state.activeDecision?.decisionId === action.decisionId &&
        (state.decisionSubmitPhase === 'SELECTING' ||
          state.decisionSubmitPhase === 'ERROR')
        ? {
            ...state,
            decisionSubmitPhase: 'SUBMITTING',
            safeDecisionError: ''
          }
        : state;
    case 'DECISION_SUBMIT_ACKNOWLEDGED':
      return state.activeDecision?.decisionId === action.decisionId &&
        state.decisionSubmitPhase === 'SUBMITTING'
        ? {
            ...state,
            decisionSubmitPhase: 'WAITING_FOR_RESUME',
            safeDecisionError: ''
          }
        : state;
    case 'DECISION_SUBMIT_FAILED':
      return state.activeDecision?.decisionId === action.decisionId
        ? {
            ...state,
            decisionSubmitPhase: 'ERROR',
            safeDecisionError: action.message
          }
        : state;
    case 'DECISION_SUBMIT_ABORTED':
      return state.activeDecision?.decisionId === action.decisionId &&
        state.decisionSubmitPhase === 'SUBMITTING'
        ? {
            ...state,
            decisionSubmitPhase: 'SELECTING',
            safeDecisionError: ''
          }
        : state;
    case 'SECURE_INPUT_SUBMIT_STARTED':
      return state.activeSecureInput?.secureRequestId === action.secureRequestId &&
        (state.secureInputSubmitPhase === 'WAITING_FOR_USER' ||
          state.secureInputSubmitPhase === 'ERROR')
        ? {
            ...state,
            secureInputSubmitPhase: 'SUBMITTING',
            safeSecureInputError: ''
          }
        : state;
    case 'SECURE_INPUT_SUBMIT_ACKNOWLEDGED':
      return state.activeSecureInput?.secureRequestId === action.secureRequestId &&
        state.secureInputSubmitPhase === 'SUBMITTING'
        ? {
            ...state,
            secureInputSubmitPhase: 'WAITING_FOR_RESUME',
            safeSecureInputError: ''
          }
        : state;
    case 'SECURE_INPUT_SUBMIT_FAILED':
      return state.activeSecureInput?.secureRequestId === action.secureRequestId
        ? {
            ...state,
            secureInputSubmitPhase: 'ERROR',
            safeSecureInputError: action.message
          }
        : state;
    case 'SECURE_INPUT_SUBMIT_ABORTED':
      return state.activeSecureInput?.secureRequestId === action.secureRequestId &&
        state.secureInputSubmitPhase === 'SUBMITTING'
        ? {
            ...state,
            secureInputSubmitPhase: 'WAITING_FOR_USER',
            safeSecureInputError: ''
          }
        : state;
    case 'CONFIRMATION_CHECKED_CHANGED':
      return state.activeConfirmation?.confirmationId === action.confirmationId &&
        (state.confirmationSubmitPhase === 'REVIEWING' ||
          state.confirmationSubmitPhase === 'ERROR')
        ? {
            ...state,
            confirmationConfirmed: action.confirmed,
            confirmationSubmitPhase: 'REVIEWING',
            safeConfirmationError: ''
          }
        : state;
    case 'CONFIRMATION_SUBMIT_STARTED':
      return state.activeConfirmation?.confirmationId === action.confirmationId &&
        (state.confirmationSubmitPhase === 'REVIEWING' ||
          state.confirmationSubmitPhase === 'ERROR')
        ? {
            ...state,
            confirmationSubmitPhase:
              action.action === 'APPROVE'
                ? 'SUBMITTING_APPROVAL'
                : 'SUBMITTING_REJECTION',
            safeConfirmationError: ''
          }
        : state;
    case 'CONFIRMATION_SUBMIT_ACKNOWLEDGED':
      return state.activeConfirmation?.confirmationId === action.confirmationId &&
        (state.confirmationSubmitPhase === 'SUBMITTING_APPROVAL' ||
          state.confirmationSubmitPhase === 'SUBMITTING_REJECTION')
        ? {
            ...state,
            confirmationSubmitPhase: 'WAITING_FOR_RESULT',
            safeConfirmationError: ''
          }
        : state;
    case 'CONFIRMATION_SUBMIT_FAILED':
      return state.activeConfirmation?.confirmationId === action.confirmationId
        ? {
            ...state,
            confirmationSubmitPhase: 'ERROR',
            safeConfirmationError: action.message
          }
        : state;
    case 'CONFIRMATION_SUBMIT_ABORTED':
      return state.activeConfirmation?.confirmationId === action.confirmationId &&
        (state.confirmationSubmitPhase === 'SUBMITTING_APPROVAL' ||
          state.confirmationSubmitPhase === 'SUBMITTING_REJECTION')
        ? {
            ...state,
            confirmationSubmitPhase: 'REVIEWING',
            safeConfirmationError: ''
          }
        : state;
  }
}
