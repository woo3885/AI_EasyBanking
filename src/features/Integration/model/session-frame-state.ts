import type { SessionViewerFrame } from '@/features/Integration/api/session-frame-transport';

export type SessionFramePhase =
  | 'IDLE'
  | 'CREATING_SESSION'
  | 'CONNECTING_FRAME'
  | 'WAITING_FIRST_FRAME'
  | 'FRAME_READY'
  | 'RECONNECTING'
  | 'DISCONNECTED'
  | 'ERROR';

export interface SessionFrameRecoveryState {
  recoveryAttempt: number;
  recoveryMaxAttempts: number | null;
  canRetryManually: boolean;
  recoveryPending: boolean;
}

export interface ExpectedActionFrame {
  frameId: string;
  sequence: number;
}

export interface SessionFrameState extends SessionFrameRecoveryState {
  runId: number;
  phase: SessionFramePhase;
  message: string;
  frame?: SessionViewerFrame;
  hasReceivedFirstFrame: boolean;
  canReset: boolean;
  actionPending: boolean;
  pendingActionType: 'CLICK' | 'SCROLL' | null;
  expectedActionFrame: ExpectedActionFrame | null;
  actionMessage: string;
  actionError: string | null;
}

export const SESSION_FRAME_MESSAGES: Record<SessionFramePhase, string> = {
  IDLE: '시작 버튼을 눌러 데모 화면 연결을 확인해 주세요.',
  CREATING_SESSION: '안전한 데모 세션을 준비하고 있습니다.',
  CONNECTING_FRAME: '원격 화면 연결을 준비하고 있습니다.',
  WAITING_FIRST_FRAME: '첫 원격 화면을 기다리고 있습니다.',
  FRAME_READY: '첫 원격 화면을 안전하게 표시했습니다.',
  RECONNECTING: '원격 화면 연결을 복구하고 있습니다.',
  DISCONNECTED: '원격 화면 연결이 종료되었습니다.',
  ERROR: '원격 화면을 표시하지 못했습니다. 초기화 후 다시 시도해 주세요.'
};

export function createInitialSessionFrameState(runId = 0): SessionFrameState {
  return {
    runId,
    phase: 'IDLE',
    message: SESSION_FRAME_MESSAGES.IDLE,
    frame: undefined,
    hasReceivedFirstFrame: false,
    canReset: false,
    actionPending: false,
    pendingActionType: null,
    expectedActionFrame: null,
    actionMessage: '원격 화면이 준비되면 직접 클릭하거나 스크롤할 수 있습니다.',
    actionError: null,
    recoveryAttempt: 0,
    recoveryMaxAttempts: null,
    canRetryManually: false,
    recoveryPending: false
  };
}

export function canSubmitViewerAction(state: SessionFrameState): boolean {
  return (
    state.phase === 'FRAME_READY' &&
    !state.recoveryPending &&
    !state.actionPending
  );
}

export const initialSessionFrameState = createInitialSessionFrameState();
