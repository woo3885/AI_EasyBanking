import F2_StreamViewer from '@/features/F2_StreamViewer/ui/F2_StreamViewer';
import { useSessionFrameIntegration } from '@/features/Integration/hooks/useSessionFrameIntegration';
import { PREVIEW_FRAME_RECONNECT_POLICY } from '@/features/Integration/model/frame-reconnect-policy';
import type { SessionFramePhase } from '@/features/Integration/model/session-frame-state';
import { Button } from '@/shared/ui/Button';
import { NoticeBox } from '@/shared/ui/NoticeBox';
import { Panel } from '@/shared/ui/Panel';
import { StatusBadge, type StatusBadgeVariant } from '@/shared/ui/StatusBadge';
import { Text } from '@/shared/ui/Text';

export const SESSION_FRAME_PREVIEW_SELECTORS = {
  root: 'preview-session-frame-d17',
  notice: 'notice-session-frame-scope',
  interactionNotice: 'notice-session-frame-interaction',
  phaseStatus: 'status-session-frame-phase',
  messageStatus: 'status-session-frame-message',
  recoveryStatus: 'status-session-frame-recovery',
  actionStatus: 'status-session-frame-action',
  startButton: 'btn-session-frame-start',
  retryButton: 'btn-session-frame-retry',
  resetButton: 'btn-session-frame-reset'
} as const;

const PHASE_LABELS: Record<SessionFramePhase, string> = {
  IDLE: '시작 전',
  CREATING_SESSION: '세션 생성 중',
  CONNECTING_FRAME: '화면 연결 중',
  WAITING_FIRST_FRAME: '첫 화면 대기',
  FRAME_READY: '첫 화면 수신',
  RECONNECTING: '연결 복구 중',
  DISCONNECTED: '연결 종료',
  ERROR: '안전한 오류'
};

const PHASE_VARIANTS: Record<SessionFramePhase, StatusBadgeVariant> = {
  IDLE: 'neutral',
  CREATING_SESSION: 'progress',
  CONNECTING_FRAME: 'progress',
  WAITING_FIRST_FRAME: 'progress',
  FRAME_READY: 'success',
  RECONNECTING: 'progress',
  DISCONNECTED: 'warning',
  ERROR: 'danger'
};

function elementIdentity(id: string) {
  return { id, 'data-testid': id };
}

export default function SessionFramePreview() {
  const integration = useSessionFrameIntegration({
    reconnectPolicy: PREVIEW_FRAME_RECONNECT_POLICY
  });
  const isBusy =
    integration.phase === 'CREATING_SESSION' ||
    integration.phase === 'CONNECTING_FRAME' ||
    integration.phase === 'WAITING_FIRST_FRAME' ||
    integration.phase === 'RECONNECTING' ||
    integration.recoveryPending ||
    integration.actionPending;
  const isRecoveryFailure =
    integration.phase === 'ERROR' && integration.canRetryManually;
  const recoveryMessage =
    integration.phase === 'RECONNECTING'
      ? '원격 화면 연결을 복구하고 있습니다.'
      : isRecoveryFailure
        ? '자동 복구를 완료하지 못했습니다. 다시 연결해 주세요.'
        : integration.phase === 'DISCONNECTED' && integration.canRetryManually
          ? '연결이 끊겼습니다. 다시 연결할 수 있습니다.'
          : integration.phase === 'FRAME_READY'
            ? '원격 화면이 준비되었습니다.'
            : integration.message;

  return (
    <main
      {...elementIdentity(SESSION_FRAME_PREVIEW_SELECTORS.root)}
      aria-busy={isBusy}
      className="mx-auto min-h-screen w-full max-w-7xl space-y-6 bg-slate-50 p-4 text-text-primary sm:p-6 lg:p-8"
    >
      <header>
        <Text as="h1" variant="title">
          D22 Viewer 원격 CLICK·SCROLL Preview
        </Text>
        <Text variant="guide" className="mt-3 text-text-secondary">
          Backend가 연 데모뱅크 화면을 사용자가 직접 클릭하고 스크롤합니다.
        </Text>
      </header>

      <NoticeBox
        {...elementIdentity(SESSION_FRAME_PREVIEW_SELECTORS.notice)}
        variant="warning"
        announce="off"
        role="note"
        title="표시 전용 개발 화면입니다."
      >
        <p>계좌 선택 시작 화면만 열며 실제 금융거래는 발생하지 않습니다.</p>
        <p>사용자 CLICK·SCROLL만 연결하며 AI Engine, Target, 보안 입력은 연결하지 않았습니다.</p>
        <p>자동 복구 지연값은 이 Preview와 테스트에서만 사용하는 Mock 정책입니다.</p>
      </NoticeBox>

      <Panel
        title="실제 Backend 연결 확인"
        description="사용자가 시작 버튼을 눌러야 세션과 화면 연결을 시작합니다."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Button
            {...elementIdentity(SESSION_FRAME_PREVIEW_SELECTORS.startButton)}
            size="lg"
            isLoading={isBusy && integration.phase !== 'RECONNECTING'}
            disabled={integration.phase !== 'IDLE'}
            onClick={() => void integration.start()}
          >
            실제 화면 연결 시작
          </Button>
          <Button
            {...elementIdentity(SESSION_FRAME_PREVIEW_SELECTORS.retryButton)}
            variant="secondary"
            size="lg"
            disabled={!integration.canRetryManually || isBusy}
            onClick={integration.retry}
          >
            화면 다시 연결
          </Button>
          <Button
            {...elementIdentity(SESSION_FRAME_PREVIEW_SELECTORS.resetButton)}
            variant="secondary"
            size="lg"
            disabled={!integration.canReset}
            onClick={() => void integration.reset()}
          >
            연결 초기화
          </Button>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          <div
            {...elementIdentity(SESSION_FRAME_PREVIEW_SELECTORS.phaseStatus)}
            className="rounded-xl border-2 border-border bg-white p-4 text-base leading-relaxed"
          >
            <StatusBadge variant={PHASE_VARIANTS[integration.phase]}>
              {PHASE_LABELS[integration.phase]}
            </StatusBadge>
          </div>
          <p
            {...elementIdentity(SESSION_FRAME_PREVIEW_SELECTORS.messageStatus)}
            className="rounded-xl border-2 border-border bg-white p-4 text-base leading-relaxed"
          >
            {integration.message}
          </p>
          <div
            {...elementIdentity(SESSION_FRAME_PREVIEW_SELECTORS.recoveryStatus)}
            role={isRecoveryFailure ? 'alert' : 'status'}
            aria-live={isRecoveryFailure ? undefined : 'polite'}
            aria-atomic="true"
            className="rounded-xl border-2 border-current bg-white p-4 text-base leading-relaxed"
          >
            <p>{recoveryMessage}</p>
            <p className="mt-2 font-semibold">
              {integration.canSubmitViewerAction
                ? '화면 동작 가능 상태입니다.'
                : '화면 동작은 안전하게 차단됩니다.'}
            </p>
          </div>
        </div>
      </Panel>

      <NoticeBox
        {...elementIdentity(SESSION_FRAME_PREVIEW_SELECTORS.interactionNotice)}
        variant={integration.canSubmitViewerAction ? 'info' : 'warning'}
        announce="polite"
        role="status"
        title={
          integration.canSubmitViewerAction
            ? '원격 화면을 직접 조작할 수 있습니다.'
            : '현재 원격 화면 조작이 차단되어 있습니다.'
        }
      >
        Viewer에서 직접 클릭하거나 스크롤해 주세요. 좌표 기반 키보드 조작은
        Target 정보가 연결되는 D23에서 제공합니다.
      </NoticeBox>

      <section aria-label="실제 원격 화면 Viewer">
        <F2_StreamViewer
          frame={integration.frame}
          interactionDisabled={!integration.canSubmitViewerAction}
          interactionBusy={integration.actionPending}
          onRemoteAction={(action) => void integration.submitViewerAction(action)}
        />
      </section>

      <div
        {...elementIdentity(SESSION_FRAME_PREVIEW_SELECTORS.actionStatus)}
        role={integration.actionError ? 'alert' : 'status'}
        aria-live={integration.actionError ? undefined : 'polite'}
        aria-atomic="true"
        className="rounded-xl border-2 border-current bg-white p-4 text-base leading-relaxed"
      >
        <StatusBadge
          variant={
            integration.actionError
              ? 'danger'
              : integration.actionPending
                ? 'progress'
                : integration.canSubmitViewerAction
                  ? 'success'
                  : 'neutral'
          }
        >
          {integration.actionPending
            ? integration.pendingActionType === 'CLICK'
              ? '클릭 처리 중'
              : '스크롤 처리 중'
            : integration.actionError
              ? '동작 오류'
              : '동작 상태'}
        </StatusBadge>
        <p className="mt-2">
          {integration.actionError ?? integration.actionMessage}
        </p>
      </div>
    </main>
  );
}
