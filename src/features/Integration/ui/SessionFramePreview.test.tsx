import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  start: vi.fn().mockResolvedValue(undefined),
  retry: vi.fn(),
  reset: vi.fn().mockResolvedValue(undefined),
  submitViewerAction: vi.fn().mockResolvedValue(undefined),
  state: {
    phase: 'IDLE',
    frame: undefined as
      | {
          metadata: {
            type: 'BROWSER_FRAME';
            sessionId: string;
            timestamp: number;
            width: number;
            height: number;
          };
          imageSrc: string;
        }
      | undefined,
    message: '시작 버튼을 눌러 데모 화면 연결을 확인해 주세요.',
    hasReceivedFirstFrame: false,
    canReset: false,
    recoveryAttempt: 0,
    recoveryMaxAttempts: 3 as number | null,
    canRetryManually: false,
    recoveryPending: false,
    actionPending: false,
    pendingActionType: null as 'CLICK' | 'SCROLL' | null,
    actionMessage: '원격 화면 조작 대기',
    actionError: null as string | null,
    canSubmitViewerAction: false
  }
}));

vi.mock('@/features/Integration/hooks/useSessionFrameIntegration', () => ({
  useSessionFrameIntegration: () => ({
    ...mocks.state,
    start: mocks.start,
    retry: mocks.retry,
    reset: mocks.reset,
    submitViewerAction: mocks.submitViewerAction
  })
}));

vi.mock('@/features/F2_StreamViewer/ui/F2_StreamViewer', () => ({
  default: ({
    frame,
    interactionDisabled,
    interactionBusy,
    onRemoteAction
  }: {
    frame?: { imageSrc: string };
    interactionDisabled?: boolean;
    interactionBusy?: boolean;
    onRemoteAction?: (action: {
      type: 'CLICK';
      x: number;
      y: number;
      frameId: string;
      sequence: number;
    }) => void;
  }) => (
    <div
      data-testid="viewer-remote-screen"
      data-interaction-disabled={String(interactionDisabled)}
      data-interaction-busy={String(interactionBusy)}
      onClick={() =>
        onRemoteAction?.({
          type: 'CLICK',
          x: 640,
          y: 360,
          frameId: 'frm-current',
          sequence: 1
        })
      }
    >
      {frame?.imageSrc ?? 'EMPTY_VIEWER'}
    </div>
  )
}));

import SessionFramePreview, {
  SESSION_FRAME_PREVIEW_SELECTORS
} from './SessionFramePreview';

beforeEach(() => {
  mocks.start.mockClear();
  mocks.retry.mockClear();
  mocks.reset.mockClear();
  mocks.submitViewerAction.mockClear();
  Object.assign(mocks.state, {
    phase: 'IDLE',
    frame: undefined,
    message: '시작 버튼을 눌러 데모 화면 연결을 확인해 주세요.',
    hasReceivedFirstFrame: false,
    canReset: false,
    recoveryAttempt: 0,
    recoveryMaxAttempts: 3,
    canRetryManually: false,
    recoveryPending: false,
    actionPending: false,
    pendingActionType: null,
    actionMessage: '원격 화면 조작 대기',
    actionError: null,
    canSubmitViewerAction: false
  });
});

describe('SessionFramePreview', () => {
  it('신규 selector의 id와 data-testid를 동일하게 렌더링한다', () => {
    render(<SessionFramePreview />);

    Object.values(SESSION_FRAME_PREVIEW_SELECTORS).forEach((selector) => {
      expect(screen.getByTestId(selector)).toHaveAttribute('id', selector);
    });
  });

  it('초기 상태에서 자동 연결 없이 start만 활성화한다', () => {
    render(<SessionFramePreview />);

    expect(screen.getByText('시작 전')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '실제 화면 연결 시작' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '화면 다시 연결' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '연결 초기화' })).toBeDisabled();
    expect(screen.getByTestId('preview-session-frame-d17')).toHaveAttribute(
      'aria-busy',
      'false'
    );
    expect(mocks.start).not.toHaveBeenCalled();
    expect(screen.getByTestId('viewer-remote-screen')).toHaveTextContent('EMPTY_VIEWER');
  });

  it('사용자 start와 reset 클릭만 hook 경계로 전달한다', async () => {
    const user = userEvent.setup();
    mocks.state.canReset = true;
    render(<SessionFramePreview />);

    await user.click(screen.getByRole('button', { name: '실제 화면 연결 시작' }));
    await user.click(screen.getByRole('button', { name: '연결 초기화' }));

    expect(mocks.start).toHaveBeenCalledTimes(1);
    expect(mocks.reset).toHaveBeenCalledTimes(1);
  });

  it('복구 중 polite 상태와 busy·Action 차단을 텍스트로 전달한다', () => {
    mocks.state.phase = 'RECONNECTING';
    mocks.state.message = '원격 화면 연결을 복구하고 있습니다.';
    mocks.state.canReset = true;
    mocks.state.recoveryAttempt = 1;
    mocks.state.recoveryPending = true;
    render(<SessionFramePreview />);

    const recoveryStatus = screen.getByTestId('status-session-frame-recovery');
    expect(recoveryStatus).toHaveAttribute('role', 'status');
    expect(recoveryStatus).toHaveAttribute('aria-live', 'polite');
    expect(recoveryStatus).toHaveTextContent('원격 화면 연결을 복구하고 있습니다.');
    expect(recoveryStatus).toHaveTextContent('화면 동작은 안전하게 차단됩니다.');
    expect(screen.getByTestId('preview-session-frame-d17')).toHaveAttribute(
      'aria-busy',
      'true'
    );
    expect(screen.getByRole('button', { name: '화면 다시 연결' })).toBeDisabled();
  });

  it('최종 복구 실패를 단일 alert로 알리고 수동 retry를 한 번 전달한다', async () => {
    const user = userEvent.setup();
    mocks.state.phase = 'ERROR';
    mocks.state.message = '원격 화면 연결을 복구하지 못했습니다.';
    mocks.state.canReset = true;
    mocks.state.canRetryManually = true;
    render(<SessionFramePreview />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('자동 복구를 완료하지 못했습니다.');
    const retryButton = screen.getByRole('button', { name: '화면 다시 연결' });
    expect(retryButton).toBeEnabled();
    expect(retryButton).toHaveAttribute('type', 'button');

    await user.click(retryButton);

    expect(mocks.retry).toHaveBeenCalledTimes(1);
  });

  it('실제 수신 ViewerFrame을 F2에 전달하고 sessionId는 UI에 표시하지 않는다', () => {
    mocks.state.phase = 'FRAME_READY';
    mocks.state.frame = {
      metadata: {
        type: 'BROWSER_FRAME',
        sessionId: 'private-session-123',
        timestamp: 1_786_350_000_000,
        width: 1280,
        height: 720
      },
      imageSrc: 'blob:real-frame'
    };
    mocks.state.message = '첫 원격 화면을 안전하게 표시했습니다.';
    mocks.state.hasReceivedFirstFrame = true;
    mocks.state.canReset = true;
    mocks.state.canSubmitViewerAction = true;
    render(<SessionFramePreview />);

    expect(screen.getByTestId('viewer-remote-screen')).toHaveTextContent('blob:real-frame');
    expect(screen.queryByText('private-session-123')).not.toBeInTheDocument();
    expect(screen.getByText('첫 화면 수신')).toBeInTheDocument();
    expect(screen.getByTestId('status-session-frame-recovery')).toHaveTextContent(
      '화면 동작 가능 상태입니다.'
    );
  });

  it('raw close reason과 sessionId를 복구 UI에 노출하지 않는다', () => {
    mocks.state.phase = 'DISCONNECTED';
    mocks.state.message = '원격 화면 연결이 일시적으로 끊겼습니다.';
    mocks.state.canRetryManually = true;
    render(<SessionFramePreview />);

    expect(screen.queryByText(/private-session|raw close|ws:\/\//i)).not.toBeInTheDocument();
    expect(screen.getByTestId('status-session-frame-recovery')).toHaveTextContent(
      '다시 연결할 수 있습니다.'
    );
  });

  it('실제 Backend 범위와 AI·Action 미연결을 명확히 안내한다', () => {
    render(<SessionFramePreview />);

    expect(screen.getByTestId('notice-session-frame-scope')).toHaveTextContent(
      '실제 금융거래는 발생하지 않습니다'
    );
    expect(screen.getByTestId('notice-session-frame-scope')).toHaveTextContent(
      '사용자 CLICK·SCROLL만 연결하며 AI Engine, Target, 보안 입력은 연결하지 않았습니다'
    );
  });

  it('Viewer interaction 가능 여부와 action callback 경계를 연결한다', async () => {
    const user = userEvent.setup();
    mocks.state.phase = 'FRAME_READY';
    mocks.state.canSubmitViewerAction = true;
    render(<SessionFramePreview />);

    const viewer = screen.getByTestId('viewer-remote-screen');
    expect(viewer).toHaveAttribute('data-interaction-disabled', 'false');
    expect(screen.getByTestId('notice-session-frame-interaction')).toHaveTextContent(
      '원격 화면을 직접 조작할 수 있습니다.'
    );

    await user.click(viewer);
    expect(mocks.submitViewerAction).toHaveBeenCalledTimes(1);
    expect(mocks.submitViewerAction).toHaveBeenCalledWith({
      type: 'CLICK',
      x: 640,
      y: 360,
      frameId: 'frm-current',
      sequence: 1
    });
  });

  it('Action pending은 aria-busy와 진행 상태로 표시한다', () => {
    mocks.state.phase = 'FRAME_READY';
    mocks.state.actionPending = true;
    mocks.state.pendingActionType = 'SCROLL';
    mocks.state.actionMessage = '동작이 반영된 새 화면을 기다리고 있습니다.';
    render(<SessionFramePreview />);

    expect(screen.getByTestId('preview-session-frame-d17')).toHaveAttribute(
      'aria-busy',
      'true'
    );
    expect(screen.getByTestId('viewer-remote-screen')).toHaveAttribute(
      'data-interaction-busy',
      'true'
    );
    const actionStatus = screen.getByTestId('status-session-frame-action');
    expect(actionStatus).toHaveAttribute('role', 'status');
    expect(actionStatus).toHaveTextContent('스크롤 처리 중');
  });

  it('Action 오류는 raw 내부정보 없이 alert로 표시한다', () => {
    mocks.state.actionError = '원격 화면 동작을 처리하지 못했습니다.';
    render(<SessionFramePreview />);

    const actionStatus = screen.getByTestId('status-session-frame-action');
    expect(actionStatus).toHaveAttribute('role', 'alert');
    expect(actionStatus).toHaveTextContent('원격 화면 동작을 처리하지 못했습니다.');
    expect(actionStatus).not.toHaveTextContent(/session-|request_|\/api\/|x=|y=/i);
  });
});
