import { useEffect, useRef, useState } from 'react';

import F2_StreamViewer from '@/features/F2_StreamViewer/ui/F2_StreamViewer';
import F3_SmartOverlay from '@/features/F3_SmartOverlay/ui/F3_SmartOverlay';
import F4_VoiceController from '@/features/F4_VoiceController/ui/F4_VoiceController';
import { useSessionFrameIntegration } from '@/features/Integration/hooks/useSessionFrameIntegration';
import { useSessionDecisionIntegration } from '@/features/Integration/hooks/useSessionDecisionIntegration';
import { useSessionSecureInputIntegration } from '@/features/Integration/hooks/useSessionSecureInputIntegration';
import { useSessionFinalConfirmationIntegration } from '@/features/Integration/hooks/useSessionFinalConfirmationIntegration';
import { useSessionStatusIntegration } from '@/features/Integration/hooks/useSessionStatusIntegration';
import type { BackendSession } from '@/features/Integration/api/session-rest-client';
import {
  isTargetMatchingFrame,
  isViewerActionAllowed,
  selectVisibleSessionTarget
} from '@/features/Integration/model/session-ui-state';
import { Button } from '@/shared/ui/Button';
import { Panel } from '@/shared/ui/Panel';
import { SecureInputPanel } from '@/shared/ui/SecureInputPanel';
import { FinalConfirmationPanel } from '@/shared/ui/FinalConfirmationPanel';
import { StatusBadge, type StatusBadgeVariant } from '@/shared/ui/StatusBadge';
import { Text } from '@/shared/ui/Text';
import { TermsAgreementPanel } from '@/shared/ui/TermsAgreementPanel';
import { UserDecisionPanel } from '@/shared/ui/UserDecisionPanel';
import { WorkflowStatusPanel } from '@/shared/ui/WorkflowStatusPanel';

export const SESSION_INTEGRATION_SELECTORS = {
  root: 'view-session-integration',
  frameConnection: 'status-production-frame-connection',
  uiConnection: 'status-production-ui-connection',
  actionState: 'status-production-viewer-action',
  decisionSubmitState: 'status-session-decision-submit',
  secureInputSubmitState: 'status-session-secure-input-submit',
  confirmationSubmitState: 'status-session-confirmation-submit',
  exitStatus: 'status-session-integration-exit',
  exitButton: 'btn-session-integration-exit'
} as const;

export interface SessionIntegrationViewProps {
  session: BackendSession;
  onExit: () => void;
}

const UI_PHASE_LABELS = {
  CONNECTING: '상태 연결 중',
  RESYNCING: '상태 동기화 중',
  CONNECTED: '상태 연결됨',
  DISCONNECTED: '상태 복구 중',
  ERROR: '상태 연결 오류'
} as const;

const UI_PHASE_VARIANTS: Record<
  keyof typeof UI_PHASE_LABELS,
  StatusBadgeVariant
> = {
  CONNECTING: 'progress',
  RESYNCING: 'progress',
  CONNECTED: 'success',
  DISCONNECTED: 'warning',
  ERROR: 'danger'
};

const DECISION_TITLES = {
  PRODUCT_SELECTION: '상품 선택',
  SOURCE_ACCOUNT_SELECTION: '출금 계좌 선택',
  RECIPIENT_SELECTION: '수취인 선택',
  TERMS_AGREEMENT: '약관 선택'
} as const;

const SECURE_INPUT_MESSAGE =
  '비밀번호는 금융 화면에 직접 입력하고 화면 캡처와 자동 안내는 멈춥니다.';

function elementIdentity(id: string) {
  return { id, 'data-testid': id };
}

export default function SessionIntegrationView({
  session,
  onExit
}: SessionIntegrationViewProps) {
  const exitRequestInFlight = useRef(false);
  const [isExiting, setIsExiting] = useState(false);
  const frameIntegration = useSessionFrameIntegration({
    existingSession: session
  });
  const statusIntegration = useSessionStatusIntegration({
    sessionId: session.sessionId,
    initialStatus: session.status
  });
  const frameIdentity = frameIntegration.frame
    ? {
        frameId: frameIntegration.frame.metadata.frameId,
        sequence: frameIntegration.frame.metadata.sequence
      }
    : null;
  const frameReconnecting =
    frameIntegration.phase === 'RECONNECTING' ||
    frameIntegration.recoveryPending;

  const decisionIntegration = useSessionDecisionIntegration({
    state: statusIntegration,
    frame: frameIdentity,
    frameReady: frameIntegration.phase === 'FRAME_READY',
    frameReconnecting,
    viewerActionPending: frameIntegration.actionPending,
    onSelectOption: statusIntegration.selectDecisionOption,
    onToggleTerm: statusIntegration.toggleDecisionTerm,
    onSubmitStarted: statusIntegration.markDecisionSubmitStarted,
    onSubmitAcknowledged: statusIntegration.markDecisionSubmitAcknowledged,
    onSubmitFailed: statusIntegration.markDecisionSubmitFailed,
    onSubmitAborted: statusIntegration.markDecisionSubmitAborted
  });
  const secureInputIntegration = useSessionSecureInputIntegration({
    state: statusIntegration,
    frame: frameIdentity,
    frameReady: frameIntegration.phase === 'FRAME_READY',
    frameReconnecting,
    viewerActionPending: frameIntegration.actionPending,
    onSubmitStarted: statusIntegration.markSecureInputSubmitStarted,
    onSubmitAcknowledged: statusIntegration.markSecureInputSubmitAcknowledged,
    onSubmitFailed: statusIntegration.markSecureInputSubmitFailed,
    onSubmitAborted: statusIntegration.markSecureInputSubmitAborted
  });
  const confirmationIntegration = useSessionFinalConfirmationIntegration({
    state: statusIntegration,
    frame: frameIdentity,
    frameReady: frameIntegration.phase === 'FRAME_READY',
    frameReconnecting,
    viewerActionPending: frameIntegration.actionPending,
    onConfirmedChange: statusIntegration.setConfirmationConfirmed,
    onSubmitStarted: statusIntegration.markConfirmationSubmitStarted,
    onSubmitAcknowledged:
      statusIntegration.markConfirmationSubmitAcknowledged,
    onSubmitFailed: statusIntegration.markConfirmationSubmitFailed,
    onSubmitAborted: statusIntegration.markConfirmationSubmitAborted
  });

  useEffect(() => {
    statusIntegration.observeFrame(frameIdentity);
  }, [
    frameIdentity?.frameId,
    frameIdentity?.sequence,
    statusIntegration.observeFrame
  ]);

  const targetMatchesFrame = isTargetMatchingFrame(
    statusIntegration.target,
    frameIdentity
  );
  const visibleTarget = selectVisibleSessionTarget({
    state: statusIntegration,
    frame: frameIdentity,
    frameReady: frameIntegration.phase === 'FRAME_READY',
    frameReconnecting,
    actionPending: frameIntegration.actionPending
  });
  const statusTransportReady =
    statusIntegration.connectionPhase === 'CONNECTED';
  const canSubmitViewerAction =
    frameIntegration.canSubmitViewerAction &&
    statusTransportReady &&
    statusIntegration.activeDecision === null &&
    statusIntegration.activeSecureInput === null &&
    statusIntegration.activeConfirmation === null &&
    isViewerActionAllowed(statusIntegration.workflowStatus) &&
    targetMatchesFrame;
  const busy =
    frameIntegration.recoveryPending ||
    frameIntegration.actionPending ||
    decisionIntegration.isBusy ||
    secureInputIntegration.isBusy ||
    confirmationIntegration.isBusy ||
    isExiting ||
    statusIntegration.connectionPhase === 'CONNECTING' ||
    statusIntegration.connectionPhase === 'RESYNCING';
  const secureInputRequired =
    statusIntegration.workflowStatus === 'SECURE_INPUT_REQUIRED';
  const showDecisionPanel =
    statusIntegration.workflowStatus === 'USER_DECISION_REQUIRED' &&
    statusIntegration.activeDecision !== null &&
    statusIntegration.decisionSubmitPhase !== 'WAITING_FOR_RESUME';

  const handleExit = async () => {
    if (exitRequestInFlight.current || !frameIntegration.canReset) {
      return;
    }

    exitRequestInFlight.current = true;
    setIsExiting(true);
    decisionIntegration.abort();
    secureInputIntegration.abort();
    confirmationIntegration.abort();
    try {
      await frameIntegration.reset();
      onExit();
    } finally {
      exitRequestInFlight.current = false;
      setIsExiting(false);
    }
  };

  return (
    <main
      {...elementIdentity(SESSION_INTEGRATION_SELECTORS.root)}
      aria-busy={busy}
      className="mx-auto min-h-screen w-full max-w-7xl space-y-6 bg-slate-50 p-4 text-text-primary sm:p-6 lg:p-8"
    >
      <header>
        <Text as="h1" variant="title">
          금융 업무 실시간 안내
        </Text>
        <Text variant="guide" className="mt-3 text-text-secondary">
          현재 업무 상태와 원격 화면의 안내 대상을 함께 확인해 주세요.
        </Text>
      </header>

      <Panel title="실시간 연결 상태">
        <div className="grid gap-3 sm:grid-cols-2">
          <div
            {...elementIdentity(SESSION_INTEGRATION_SELECTORS.frameConnection)}
            className="rounded-xl border-2 border-border bg-white p-4"
          >
            <StatusBadge
              variant={
                frameIntegration.phase === 'FRAME_READY'
                  ? 'success'
                  : frameIntegration.phase === 'ERROR'
                    ? 'danger'
                    : 'progress'
              }
            >
              {frameIntegration.phase === 'FRAME_READY'
                ? '화면 연결됨'
                : frameIntegration.message}
            </StatusBadge>
          </div>
          <div
            {...elementIdentity(SESSION_INTEGRATION_SELECTORS.uiConnection)}
            className="rounded-xl border-2 border-border bg-white p-4"
          >
            <StatusBadge
              variant={
                UI_PHASE_VARIANTS[statusIntegration.connectionPhase]
              }
            >
              {UI_PHASE_LABELS[statusIntegration.connectionPhase]}
            </StatusBadge>
            {statusIntegration.safeError ? (
              <Text variant="caption" className="mt-2 text-danger">
                {statusIntegration.safeError}
              </Text>
            ) : null}
          </div>
        </div>
      </Panel>

      {secureInputRequired ? (
        <SecureInputPanel
          message={
            statusIntegration.activeSecureInput?.message ?? SECURE_INPUT_MESSAGE
          }
          completionRequested={secureInputIntegration.completionRequested}
          disabled={secureInputIntegration.controlsDisabled}
          isBusy={secureInputIntegration.isBusy}
          onComplete={secureInputIntegration.requestCompletion}
        />
      ) : statusIntegration.activeConfirmation === null ? (
        <WorkflowStatusPanel
          status={statusIntegration.workflowStatus}
          message={statusIntegration.guideMessage}
        />
      ) : null}

      {showDecisionPanel && statusIntegration.activeDecision?.decisionType ===
      'TERMS_AGREEMENT' ? (
        <TermsAgreementPanel
          title="약관 선택"
          message={statusIntegration.guideMessage}
          terms={statusIntegration.activeDecision.options.map((option) => ({
            id: option.id,
            label: option.label,
            required: option.required,
            disabled: option.disabled
          }))}
          selectedTermIds={statusIntegration.selectedTermIds}
          disabled={decisionIntegration.controlsDisabled}
          isBusy={decisionIntegration.isBusy}
          onToggle={decisionIntegration.toggleTerm}
          onConfirm={decisionIntegration.confirmTerms}
        />
      ) : showDecisionPanel && statusIntegration.activeDecision ? (
        <UserDecisionPanel
          title={DECISION_TITLES[statusIntegration.activeDecision.decisionType]}
          message={statusIntegration.guideMessage}
          options={statusIntegration.activeDecision.options.map((option) => ({
            id: option.id,
            label: option.label,
            disabled: option.disabled
          }))}
          selectedOptionId={statusIntegration.selectedOptionId}
          disabled={decisionIntegration.controlsDisabled}
          isBusy={decisionIntegration.isBusy}
          onSelect={decisionIntegration.selectOption}
          onConfirm={decisionIntegration.confirmOption}
        />
      ) : null}

      {statusIntegration.activeConfirmation?.summary ? (
        <FinalConfirmationPanel
          title="최종 거래 확인"
          message={statusIntegration.guideMessage}
          summary={statusIntegration.activeConfirmation.summary}
          confirmed={statusIntegration.confirmationConfirmed}
          approvalRequested={confirmationIntegration.approvalRequested}
          disabled={confirmationIntegration.controlsDisabled}
          isBusy={confirmationIntegration.isBusy}
          canEdit={false}
          canCancel={confirmationIntegration.canReject}
          onConfirmedChange={confirmationIntegration.setConfirmed}
          onApprove={confirmationIntegration.requestApproval}
          onEdit={() => undefined}
          onCancel={confirmationIntegration.requestRejection}
        />
      ) : null}

      {secureInputRequired ? (
        <div
          {...elementIdentity(
            SESSION_INTEGRATION_SELECTORS.secureInputSubmitState
          )}
        >
          {statusIntegration.safeSecureInputError ? (
            <div role="alert">
              <Text variant="body" className="text-danger">
                {statusIntegration.safeSecureInputError}
              </Text>
            </div>
          ) : null}
        </div>
      ) : null}

      {statusIntegration.activeDecision ? (
        <div
          {...elementIdentity(SESSION_INTEGRATION_SELECTORS.decisionSubmitState)}
        >
          {statusIntegration.decisionSubmitPhase === 'WAITING_FOR_RESUME' ? (
            <div role="status" aria-live="polite">
              <Text variant="body">
                선택 결과를 확인했습니다. 다음 업무 상태를 기다리고 있습니다.
              </Text>
            </div>
          ) : null}
          {statusIntegration.safeDecisionError ? (
            <div role="alert">
              <Text variant="body" className="text-danger">
                {statusIntegration.safeDecisionError}
              </Text>
            </div>
          ) : null}
        </div>
      ) : null}

      {statusIntegration.activeConfirmation ? (
        <div
          {...elementIdentity(
            SESSION_INTEGRATION_SELECTORS.confirmationSubmitState
          )}
        >
          {statusIntegration.safeConfirmationError ? (
            <div role="alert">
              <Text variant="body" className="text-danger">
                {statusIntegration.safeConfirmationError}
              </Text>
            </div>
          ) : null}
        </div>
      ) : null}

      <F4_VoiceController
        sessionId={session.sessionId}
        message={statusIntegration.guideMessage}
        disabled={!statusTransportReady || frameReconnecting || isExiting}
        isSecureInput={secureInputRequired}
      />

      <section aria-label="실시간 원격 화면">
        <F2_StreamViewer
          frame={frameIntegration.frame}
          interactionDisabled={!canSubmitViewerAction}
          interactionBusy={frameIntegration.actionPending}
          onRemoteAction={(action) =>
            void frameIntegration.submitViewerAction(action)
          }
          renderOverlay={({ displaySize, frameStatus, imageSrc }) => (
            <F3_SmartOverlay
              target={visibleTarget}
              serverSize={{ width: 1280, height: 720 }}
              displaySize={displaySize}
              message={visibleTarget?.label ?? ''}
              visible={visibleTarget !== null}
              focusEffectsEnabled
              magnifierImageSrc={imageSrc}
              frameStatus={frameStatus}
            />
          )}
        />
      </section>

      <Panel
        {...elementIdentity(SESSION_INTEGRATION_SELECTORS.actionState)}
        title="원격 화면 조작 상태"
      >
        <Text variant="body">
          {canSubmitViewerAction
            ? '현재 화면을 직접 클릭하거나 스크롤할 수 있습니다.'
            : '상태와 화면이 안전하게 일치할 때까지 조작이 차단됩니다.'}
        </Text>
        <Text variant="caption" className="mt-2 text-text-secondary">
          Target 안내는 위치만 표시하며 자동으로 화면을 조작하지 않습니다.
        </Text>
      </Panel>

      <div className="flex justify-end">
        {isExiting ? (
          <p
            {...elementIdentity(SESSION_INTEGRATION_SELECTORS.exitStatus)}
            role="status"
            aria-live="polite"
            className="mr-4 self-center text-base font-semibold leading-relaxed text-text-primary"
          >
            세션 종료를 요청하고 있습니다. 잠시만 기다려 주세요.
          </p>
        ) : null}
        <Button
          {...elementIdentity(SESSION_INTEGRATION_SELECTORS.exitButton)}
          variant="danger"
          size="lg"
          type="button"
          disabled={!frameIntegration.canReset || isExiting}
          isLoading={isExiting}
          aria-describedby={
            isExiting ? SESSION_INTEGRATION_SELECTORS.exitStatus : undefined
          }
          onClick={() => void handleExit()}
        >
          세션 종료 후 대시보드로
        </Button>
      </div>
    </main>
  );
}
