import {
  canConfirmTermsAgreement
} from '@/shared/model/terms-agreement';
import {
  getSelectedUserDecisionOption
} from '@/shared/model/user-decision';
import type { IntegrationTransportEvent } from '@/features/Integration/api/integration-transport';
import {
  createInitialIntegrationState,
  type IntegrationState
} from '@/features/Integration/model/integration-state';

type RunScopedUiAction = { runId: number };

export type IntegrationReducerAction =
  | IntegrationTransportEvent
  | (RunScopedUiAction & {
      type: 'MOCK_OPTION_SELECTED';
      optionId: string;
    })
  | (RunScopedUiAction & {
      type: 'MOCK_TERM_TOGGLED';
      termId: string;
      selected: boolean;
    })
  | (RunScopedUiAction & {
      type: 'MOCK_SINGLE_DECISION_CONFIRM_REQUESTED';
      optionId: string;
    })
  | (RunScopedUiAction & {
      type: 'MOCK_TERMS_CONFIRM_REQUESTED';
      selectedTermIds: readonly string[];
    })
  | (RunScopedUiAction & {
      type: 'MOCK_LOCAL_ACTION_RECORDED';
      message: string;
      isPaused?: boolean;
    })
  | { type: 'MOCK_RESET' };

function isStaleRun(
  state: IntegrationState,
  action: IntegrationReducerAction
): boolean {
  if (action.type === 'MOCK_RESET') {
    return false;
  }

  if (action.type === 'MOCK_SESSION_STARTED') {
    return action.runId < state.runId;
  }

  return action.runId !== state.runId;
}

function normalizeSafeMessage(message: string, fallback: string): string {
  return message.trim() || fallback;
}

export function integrationReducer(
  state: IntegrationState,
  action: IntegrationReducerAction
): IntegrationState {
  if (isStaleRun(state, action)) {
    return state;
  }

  switch (action.type) {
    case 'MOCK_SESSION_STARTED':
      return {
        ...createInitialIntegrationState(action.runId),
        connectionState: 'MOCK_CONNECTED',
        scenarioId: action.scenarioId,
        mockSessionId: action.mockSessionId,
        phase:
          action.scenarioId === 'TRANSFER_ACCOUNT_SELECTION'
            ? 'ACCOUNT_SELECTION'
            : 'TERMS_AGREEMENT',
        guideMessage: '로컬 Mock 선택 요청을 준비했습니다.'
      };
    case 'MOCK_WORKFLOW_STATUS_RECEIVED':
      return {
        ...state,
        workflowStatus: action.workflowStatus,
        guideMessage: normalizeSafeMessage(
          action.guideMessage,
          '로컬 Mock 상태를 확인해 주세요.'
        )
      };
    case 'MOCK_FRAME_RECEIVED':
      return { ...state, frame: action.frame, target: null, targetMessage: '' };
    case 'MOCK_TARGET_RECEIVED':
      return {
        ...state,
        target: action.target,
        targetMessage: normalizeSafeMessage(
          action.message,
          'Mock 선택 위치를 안내합니다.'
        )
      };
    case 'MOCK_SINGLE_DECISION_REQUEST_RECEIVED':
      return {
        ...state,
        decisionRequest: {
          ...action.request,
          options: action.request.options.map((option) => ({ ...option }))
        },
        termsRequest: null,
        selectedOptionId: null,
        selectedTermIds: new Set<string>()
      };
    case 'MOCK_TERMS_REQUEST_RECEIVED':
      return {
        ...state,
        phase: 'TERMS_AGREEMENT',
        termsRequest: {
          ...action.request,
          terms: action.request.terms.map((term) => ({ ...term }))
        },
        decisionRequest: null,
        selectedOptionId: null,
        selectedTermIds: new Set<string>(),
        target: null,
        targetMessage: ''
      };
    case 'MOCK_OPTION_SELECTED': {
      if (
        !state.decisionRequest ||
        !getSelectedUserDecisionOption(
          state.decisionRequest.options,
          action.optionId
        )
      ) {
        return state;
      }

      return { ...state, selectedOptionId: action.optionId };
    }
    case 'MOCK_TERM_TOGGLED': {
      const term = state.termsRequest?.terms.find(
        (candidate) => candidate.id === action.termId
      );
      if (!term || term.disabled) {
        return state;
      }

      const selectedTermIds = new Set(state.selectedTermIds);
      if (action.selected) {
        selectedTermIds.add(action.termId);
      } else {
        selectedTermIds.delete(action.termId);
      }

      return { ...state, selectedTermIds };
    }
    case 'MOCK_SINGLE_DECISION_CONFIRM_REQUESTED': {
      const confirmedOption = state.decisionRequest
        ? getSelectedUserDecisionOption(
            state.decisionRequest.options,
            action.optionId
          )
        : null;
      if (!confirmedOption || state.selectedOptionId !== confirmedOption.id) {
        return state;
      }

      return {
        ...state,
        lastActionMessage: `Mock 선택 확인 요청: ${confirmedOption.label}`
      };
    }
    case 'MOCK_TERMS_CONFIRM_REQUESTED': {
      if (
        !state.termsRequest ||
        !canConfirmTermsAgreement(
          state.termsRequest.terms,
          new Set(action.selectedTermIds)
        )
      ) {
        return state;
      }

      return {
        ...state,
        lastActionMessage: 'Mock 약관 선택 확인을 요청했습니다.'
      };
    }
    case 'MOCK_SINGLE_DECISION_CONFIRM_ACKNOWLEDGED':
    case 'MOCK_TERMS_CONFIRM_ACKNOWLEDGED':
      return {
        ...state,
        lastActionMessage: normalizeSafeMessage(
          action.message,
          'Mock 확인 요청을 처리했습니다.'
        )
      };
    case 'MOCK_RECIPIENT_PHASE_ENTERED':
      return {
        ...state,
        phase: 'RECIPIENT_SELECTION',
        selectedOptionId: null,
        target: null,
        targetMessage: ''
      };
    case 'MOCK_BASELINE_REACHED':
      return {
        ...state,
        phase: 'BASELINE_REACHED',
        guideMessage: normalizeSafeMessage(
          action.guideMessage,
          '기준 시나리오에 도달했습니다.'
        )
      };
    case 'MOCK_LOCAL_ACTION_RECORDED':
      return {
        ...state,
        isPaused: action.isPaused ?? state.isPaused,
        lastActionMessage: normalizeSafeMessage(
          action.message,
          'Mock 요청을 기록했습니다.'
        )
      };
    case 'MOCK_SAFE_ERROR':
      return {
        ...state,
        phase: 'ERROR',
        target: null,
        targetMessage: '',
        safeErrorMessage: normalizeSafeMessage(
          action.safeMessage,
          '로컬 Mock을 처리하지 못했습니다. 초기화 후 다시 시도해 주세요.'
        )
      };
    case 'MOCK_RESET':
      return createInitialIntegrationState(state.runId + 1);
  }
}
