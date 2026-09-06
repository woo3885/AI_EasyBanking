import { useEffect, useReducer, useRef, useState } from 'react';

import type { IntegrationTransport } from '@/features/Integration/api/integration-transport';
import { createMockIntegrationTransport } from '@/features/Integration/api/mock-integration-transport';
import F2_StreamViewer from '@/features/F2_StreamViewer/ui/F2_StreamViewer';
import {
  VIEWER_FRAME_HEIGHT,
  VIEWER_FRAME_WIDTH
} from '@/features/F2_StreamViewer/model/viewer-constants';
import F3_SmartOverlay from '@/features/F3_SmartOverlay/ui/F3_SmartOverlay';
import F4_VoiceController from '@/features/F4_VoiceController/ui/F4_VoiceController';
import F5_MainController from '@/features/F5_MainController/ui/F5_MainController';
import {
  integrationReducer
} from '@/features/Integration/model/integration-reducer';
import {
  initialIntegrationState,
  type IntegrationScenarioId
} from '@/features/Integration/model/integration-state';
import { Button } from '@/shared/ui/Button';
import { NoticeBox } from '@/shared/ui/NoticeBox';
import { Panel } from '@/shared/ui/Panel';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import { TermsAgreementPanel } from '@/shared/ui/TermsAgreementPanel';
import { Text } from '@/shared/ui/Text';
import { UserDecisionPanel } from '@/shared/ui/UserDecisionPanel';
import { WorkflowStatusPanel } from '@/shared/ui/WorkflowStatusPanel';

export const INTEGRATION_PREVIEW_SELECTORS = {
  root: 'preview-integration-d16',
  notice: 'notice-integration-mock',
  scenarioSelect: 'select-integration-scenario',
  connectionStatus: 'status-integration-connection',
  phaseStatus: 'status-integration-phase',
  lastActionStatus: 'status-integration-last-action',
  startButton: 'btn-integration-start',
  resetButton: 'btn-integration-reset'
} as const;

const SCENARIO_LABELS: Record<IntegrationScenarioId, string> = {
  TRANSFER_ACCOUNT_SELECTION: '계좌 선택 → 수취인 대기 Mock',
  DEPOSIT_TERMS_AGREEMENT: '예금 약관 개별 선택 Mock'
};

const PHASE_LABELS = {
  IDLE: '시작 전',
  ACCOUNT_SELECTION: 'Mock 계좌 선택',
  RECIPIENT_SELECTION: 'Mock 수취인 단계 진입',
  TERMS_AGREEMENT: 'Mock 약관 선택',
  BASELINE_REACHED: '기준 시나리오 도달',
  ERROR: '안전한 Mock 오류'
} as const;

function elementIdentity(id: string) {
  return { id, 'data-testid': id };
}

export default function IntegrationPreview() {
  const [state, dispatch] = useReducer(
    integrationReducer,
    initialIntegrationState
  );
  const [selectedScenarioId, setSelectedScenarioId] =
    useState<IntegrationScenarioId>('TRANSFER_ACCOUNT_SELECTION');
  const transportRef = useRef<IntegrationTransport | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const startedRef = useRef(false);

  if (transportRef.current === null) {
    transportRef.current = createMockIntegrationTransport();
  }

  useEffect(() => {
    return () => {
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
      transportRef.current?.stop();
      startedRef.current = false;
    };
  }, []);

  const handleStart = () => {
    const transport = transportRef.current;
    if (!transport || startedRef.current) {
      return;
    }

    startedRef.current = true;
    unsubscribeRef.current = transport.subscribe(dispatch);
    transport.startScenario(selectedScenarioId);
  };

  const handleReset = () => {
    transportRef.current?.stop();
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    startedRef.current = false;
    dispatch({ type: 'MOCK_RESET' });
  };

  const recordControllerAction = (message: string, isPaused?: boolean) => {
    dispatch({
      type: 'MOCK_LOCAL_ACTION_RECORDED',
      runId: state.runId,
      message,
      isPaused
    });
  };

  const isStarted = state.connectionState === 'MOCK_CONNECTED';
  const isBaselineReached = state.phase === 'BASELINE_REACHED';

  return (
    <main
      {...elementIdentity(INTEGRATION_PREVIEW_SELECTORS.root)}
      className="mx-auto min-h-screen w-full max-w-7xl space-y-6 bg-slate-50 p-4 text-text-primary sm:p-6 lg:p-8"
    >
      <header>
        <Text as="h1" variant="title">
          D16 통합 Mock Preview
        </Text>
        <Text variant="guide" className="mt-3 text-text-secondary">
          D17~D19 실제 연동을 준비하는 독립 개발용 조합 화면입니다.
        </Text>
      </header>

      <NoticeBox
        {...elementIdentity(INTEGRATION_PREVIEW_SELECTORS.notice)}
        variant="warning"
        announce="polite"
        title="실제 시스템과 연결되지 않은 로컬 Mock입니다."
      >
        <p>실제 Backend, AI Engine, WebSocket 및 데모사이트에 연결되지 않았습니다.</p>
        <p>표시되는 frame·Target·상태·선택 요청은 로컬 Mock입니다.</p>
        <p>실제 금융거래나 브라우저 조작은 발생하지 않습니다.</p>
      </NoticeBox>

      <Panel title="개발용 시나리오 제어" description="시나리오를 선택한 뒤 사용자가 직접 시작해야 합니다.">
        <label
          htmlFor={INTEGRATION_PREVIEW_SELECTORS.scenarioSelect}
          className="block text-lg font-bold leading-relaxed"
        >
          Mock 시나리오
        </label>
        <select
          {...elementIdentity(INTEGRATION_PREVIEW_SELECTORS.scenarioSelect)}
          value={selectedScenarioId}
          disabled={isStarted}
          onChange={(event) =>
            setSelectedScenarioId(event.currentTarget.value as IntegrationScenarioId)
          }
          className="mt-2 min-h-14 w-full rounded-xl border-2 border-border bg-surface px-4 text-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {Object.entries(SCENARIO_LABELS).map(([scenarioId, label]) => (
            <option key={scenarioId} value={scenarioId}>
              {label}
            </option>
          ))}
        </select>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Button
            {...elementIdentity(INTEGRATION_PREVIEW_SELECTORS.startButton)}
            size="lg"
            disabled={isStarted}
            onClick={handleStart}
          >
            Mock 시나리오 시작
          </Button>
          <Button
            {...elementIdentity(INTEGRATION_PREVIEW_SELECTORS.resetButton)}
            variant="secondary"
            size="lg"
            onClick={handleReset}
          >
            Mock 초기화
          </Button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <p
            {...elementIdentity(INTEGRATION_PREVIEW_SELECTORS.connectionStatus)}
            role="status"
            aria-live="polite"
            className="rounded-xl border-2 border-border bg-white p-4 text-base leading-relaxed"
          >
            <StatusBadge variant={isStarted ? 'success' : 'neutral'}>
              {isStarted ? '로컬 Mock 연결됨' : 'Mock 연결 전'}
            </StatusBadge>
          </p>
          <p
            {...elementIdentity(INTEGRATION_PREVIEW_SELECTORS.phaseStatus)}
            role="status"
            aria-live="polite"
            className="rounded-xl border-2 border-border bg-white p-4 text-base leading-relaxed"
          >
            단계: {PHASE_LABELS[state.phase]}
          </p>
        </div>
      </Panel>

      {state.safeErrorMessage ? (
        <NoticeBox variant="danger" title="로컬 Mock 오류" announce="assertive">
          {state.safeErrorMessage}
        </NoticeBox>
      ) : null}

      <section aria-label="Mock Viewer와 상태" className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(22rem,0.8fr)]">
        <F2_StreamViewer
          frame={state.frame}
          renderOverlay={({ displaySize, frameStatus, imageSrc }) => (
            <F3_SmartOverlay
              target={state.target}
              serverSize={{
                width: VIEWER_FRAME_WIDTH,
                height: VIEWER_FRAME_HEIGHT
              }}
              displaySize={displaySize}
              message={state.targetMessage}
              visible={frameStatus === 'READY'}
              focusEffectsEnabled
              magnifierImageSrc={imageSrc}
              frameStatus={frameStatus}
            />
          )}
        />
        <WorkflowStatusPanel
          status={state.workflowStatus}
          message={state.guideMessage}
        />
      </section>

      {state.decisionRequest ? (
        <UserDecisionPanel
          title={state.decisionRequest.title}
          message={state.decisionRequest.message}
          options={state.decisionRequest.options}
          selectedOptionId={state.selectedOptionId}
          disabled={isBaselineReached}
          onSelect={(optionId) =>
            dispatch({
              type: 'MOCK_OPTION_SELECTED',
              runId: state.runId,
              optionId
            })
          }
          onConfirm={(optionId) => {
            dispatch({
              type: 'MOCK_SINGLE_DECISION_CONFIRM_REQUESTED',
              runId: state.runId,
              optionId
            });
            transportRef.current?.submitSingleDecision(optionId);
          }}
        />
      ) : null}

      {state.termsRequest ? (
        <TermsAgreementPanel
          title={state.termsRequest.title}
          message={state.termsRequest.message}
          terms={state.termsRequest.terms}
          selectedTermIds={state.selectedTermIds}
          onToggle={(termId, selected) =>
            dispatch({
              type: 'MOCK_TERM_TOGGLED',
              runId: state.runId,
              termId,
              selected
            })
          }
          onConfirm={(selectedTermIds) => {
            dispatch({
              type: 'MOCK_TERMS_CONFIRM_REQUESTED',
              runId: state.runId,
              selectedTermIds
            });
            transportRef.current?.submitTermsAgreement(selectedTermIds);
          }}
        />
      ) : null}

      <NoticeBox variant="info" title="음성 transport 미연결" announce="off">
        음성 기능은 강제 비지원 상태이며 마이크와 음성 합성 API를 호출하지 않습니다.
      </NoticeBox>
      <F4_VoiceController
        sessionId={state.mockSessionId ?? ''}
        message={`Mock 안내: ${state.guideMessage}`}
        disabled
        recognitionFactory={null}
        synthesisFactory={null}
      />

      <F5_MainController
        message={state.guideMessage}
        isPaused={state.isPaused}
        canReplay={false}
        canPause={isStarted}
        canGoPrevious={isStarted}
        canCancel={isStarted}
        onReplay={() =>
          recordControllerAction('Mock 요청: 실제 음성 다시 듣기는 수행하지 않습니다.')
        }
        onPauseChange={(isPaused) =>
          recordControllerAction(
            isPaused
              ? 'Mock 요청: 로컬 일시정지 상태를 표시했습니다.'
              : 'Mock 요청: 로컬 계속 진행 상태를 표시했습니다.',
            isPaused
          )
        }
        onPrevious={() =>
          recordControllerAction('Mock 요청: 실제 이전 단계 이동은 수행하지 않습니다.')
        }
        onCancel={() =>
          recordControllerAction('Mock 요청: 실제 세션 취소는 수행하지 않습니다.')
        }
      />

      <p
        {...elementIdentity(INTEGRATION_PREVIEW_SELECTORS.lastActionStatus)}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="rounded-xl border-2 border-border bg-white p-4 text-base leading-relaxed"
      >
        마지막 로컬 동작: {state.lastActionMessage}
      </p>
    </main>
  );
}
