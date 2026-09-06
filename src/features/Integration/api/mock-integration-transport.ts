import type {
  IntegrationTransport,
  IntegrationTransportEvent,
  IntegrationTransportListener
} from '@/features/Integration/api/integration-transport';
import type { IntegrationScenarioId } from '@/features/Integration/model/integration-state';
import {
  ACCOUNT_DECISION_OPTIONS,
  ACCOUNT_SELECTION_FRAME,
  ACCOUNT_SELECTION_TARGET,
  MOCK_AGREEMENT_TERMS,
  MOCK_INTEGRATION_SESSION_ID,
  RECIPIENT_DECISION_OPTIONS,
  RECIPIENT_SELECTION_FRAME,
  RECIPIENT_SELECTION_TARGET
} from '@/features/Integration/mocks/integration-scenarios';

const SAFE_INVALID_SELECTION_MESSAGE =
  'Mock 선택 요청을 처리할 수 없습니다. 초기화 후 다시 시도해 주세요.';
const SAFE_INVALID_TERMS_MESSAGE =
  'Mock 약관 요청을 처리할 수 없습니다. 항목을 다시 확인해 주세요.';

type ActiveMockPhase = 'ACCOUNT' | 'RECIPIENT' | 'TERMS';

function hasValidTermsSelection(selectedTermIds: readonly string[]): boolean {
  const selectedIds = new Set(selectedTermIds);
  const knownIds = new Set(MOCK_AGREEMENT_TERMS.map((term) => term.id));

  return (
    selectedIds.size === selectedTermIds.length &&
    selectedTermIds.every((termId) => knownIds.has(termId)) &&
    MOCK_AGREEMENT_TERMS.filter((term) => term.required).every((term) =>
      selectedIds.has(term.id)
    )
  );
}

/**
 * 네트워크나 지연 없이 동기적으로 동작하는 D16 개발 전용 memory transport다.
 * event 순서는 Preview 재현성을 위한 로컬 규칙이며 서버 계약이 아니다.
 */
export function createMockIntegrationTransport(): IntegrationTransport {
  const listeners = new Set<IntegrationTransportListener>();
  let active = false;
  let runSequence = 0;
  let activeRunId = 0;
  let activeScenario: IntegrationScenarioId | null = null;
  let activePhase: ActiveMockPhase | null = null;

  const emit = (event: IntegrationTransportEvent) => {
    if (!active || event.runId !== activeRunId) {
      return;
    }

    Array.from(listeners).forEach((listener) => listener(event));
  };

  const emitError = (safeMessage: string) => {
    emit({
      type: 'MOCK_SAFE_ERROR',
      runId: activeRunId,
      safeMessage
    });
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      let subscribed = true;

      return () => {
        if (subscribed) {
          listeners.delete(listener);
          subscribed = false;
        }
      };
    },

    startScenario(scenarioId) {
      if (active) {
        return;
      }

      active = true;
      activeRunId = ++runSequence;
      activeScenario = scenarioId;
      activePhase =
        scenarioId === 'TRANSFER_ACCOUNT_SELECTION' ? 'ACCOUNT' : 'TERMS';

      emit({
        type: 'MOCK_SESSION_STARTED',
        runId: activeRunId,
        scenarioId,
        mockSessionId: MOCK_INTEGRATION_SESSION_ID
      });
      emit({
        type: 'MOCK_WORKFLOW_STATUS_RECEIVED',
        runId: activeRunId,
        workflowStatus: 'USER_DECISION_REQUIRED',
        guideMessage:
          scenarioId === 'TRANSFER_ACCOUNT_SELECTION'
            ? 'Mock 계좌를 직접 선택한 뒤 선택 확인 버튼을 눌러 주세요.'
            : '필수 Mock 약관을 각각 선택한 뒤 약관 선택 확인 버튼을 눌러 주세요.'
      });

      if (scenarioId === 'TRANSFER_ACCOUNT_SELECTION') {
        emit({
          type: 'MOCK_FRAME_RECEIVED',
          runId: activeRunId,
          frame: ACCOUNT_SELECTION_FRAME
        });
        emit({
          type: 'MOCK_TARGET_RECEIVED',
          runId: activeRunId,
          target: ACCOUNT_SELECTION_TARGET,
          message: 'Mock 안내: 생활비 계좌 선택 위치입니다.'
        });
        emit({
          type: 'MOCK_SINGLE_DECISION_REQUEST_RECEIVED',
          runId: activeRunId,
          request: {
            kind: 'ACCOUNT',
            title: 'Mock 출금 계좌 선택',
            message: '실제 계좌가 아닌 로컬 Mock 항목을 직접 선택해 주세요.',
            options: ACCOUNT_DECISION_OPTIONS
          }
        });
        return;
      }

      emit({
        type: 'MOCK_TERMS_REQUEST_RECEIVED',
        runId: activeRunId,
        request: {
          title: 'Mock 예금 약관 선택',
          message: '전체 동의 없이 각 Mock 약관을 직접 선택해 주세요.',
          terms: MOCK_AGREEMENT_TERMS
        }
      });
    },

    submitSingleDecision(optionId) {
      if (
        !active ||
        activeScenario !== 'TRANSFER_ACCOUNT_SELECTION' ||
        activePhase !== 'ACCOUNT'
      ) {
        return;
      }

      const option = ACCOUNT_DECISION_OPTIONS.find(
        (candidate) => candidate.id === optionId && !candidate.disabled
      );
      if (!option) {
        emitError(SAFE_INVALID_SELECTION_MESSAGE);
        return;
      }

      emit({
        type: 'MOCK_SINGLE_DECISION_CONFIRM_ACKNOWLEDGED',
        runId: activeRunId,
        message: `Mock 선택 확인 callback: ${option.label}`
      });
      activePhase = 'RECIPIENT';
      emit({
        type: 'MOCK_RECIPIENT_PHASE_ENTERED',
        runId: activeRunId
      });
      emit({
        type: 'MOCK_WORKFLOW_STATUS_RECEIVED',
        runId: activeRunId,
        workflowStatus: 'USER_DECISION_REQUIRED',
        guideMessage: 'Mock 수취인 선택 대기 화면을 확인해 주세요.'
      });
      emit({
        type: 'MOCK_FRAME_RECEIVED',
        runId: activeRunId,
        frame: RECIPIENT_SELECTION_FRAME
      });
      emit({
        type: 'MOCK_TARGET_RECEIVED',
        runId: activeRunId,
        target: RECIPIENT_SELECTION_TARGET,
        message: 'Mock 안내: 수취인 선택 위치입니다.'
      });
      emit({
        type: 'MOCK_SINGLE_DECISION_REQUEST_RECEIVED',
        runId: activeRunId,
        request: {
          kind: 'RECIPIENT',
          title: 'Mock 수취인 선택 대기',
          message: 'D16 기준점에서는 수취인을 선택하거나 제출하지 않습니다.',
          options: RECIPIENT_DECISION_OPTIONS
        }
      });
      emit({
        type: 'MOCK_BASELINE_REACHED',
        runId: activeRunId,
        guideMessage:
          '기준 시나리오 도달: Mock 수취인 선택 대기 상태입니다.'
      });
    },

    submitTermsAgreement(selectedTermIds) {
      if (
        !active ||
        activeScenario !== 'DEPOSIT_TERMS_AGREEMENT' ||
        activePhase !== 'TERMS'
      ) {
        return;
      }

      if (!hasValidTermsSelection(selectedTermIds)) {
        emitError(SAFE_INVALID_TERMS_MESSAGE);
        return;
      }

      emit({
        type: 'MOCK_TERMS_CONFIRM_ACKNOWLEDGED',
        runId: activeRunId,
        message: 'Mock 약관 선택 확인 callback을 기록했습니다.'
      });
    },

    stop() {
      active = false;
      activeScenario = null;
      activePhase = null;
    }
  };
}
