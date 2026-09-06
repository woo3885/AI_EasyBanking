import {
  createInitialSessionFrameState,
  SESSION_FRAME_MESSAGES,
  type SessionFrameState
} from '@/features/Integration/model/session-frame-state';
import type { SessionViewerFrame } from '@/features/Integration/api/session-frame-transport';

type ScopedAction = { runId: number };

export type SessionFrameAction =
  | (ScopedAction & { type: 'START_REQUESTED' })
  | (ScopedAction & { type: 'SESSION_CREATED' })
  | (ScopedAction & { type: 'FRAME_CONNECTED' })
  | (ScopedAction & { type: 'FRAME_RECEIVED'; frame: SessionViewerFrame })
  | (ScopedAction & {
      type: 'DISCONNECTED';
      message?: string;
      canRetryManually?: boolean;
    })
  | (ScopedAction & {
      type: 'RECONNECT_SCHEDULED';
      attempt: number;
      maxAttempts: number;
    })
  | (ScopedAction & { type: 'MANUAL_RETRY_STARTED' })
  | (ScopedAction & { type: 'RECOVERY_FAILED'; message?: string })
  | (ScopedAction & {
      type: 'ACTION_REQUESTED';
      actionType: 'CLICK' | 'SCROLL';
    })
  | (ScopedAction & {
      type: 'ACTION_FRAME_EXPECTED';
      frameId: string;
      sequence: number;
    })
  | (ScopedAction & {
      type: 'ACTION_COMPLETED';
      message: string;
    })
  | (ScopedAction & {
      type: 'ACTION_FINISHED_WITHOUT_FRAME';
      message: string;
    })
  | (ScopedAction & {
      type: 'ACTION_FAILED';
      message: string;
    })
  | (ScopedAction & {
      type: 'SAFE_ERROR';
      message?: string;
      canRetryManually?: boolean;
    })
  | { type: 'RESET'; nextRunId: number };

function isStale(state: SessionFrameState, action: SessionFrameAction): boolean {
  if (action.type === 'RESET') return false;
  if (action.type === 'START_REQUESTED') return action.runId <= state.runId;
  return action.runId !== state.runId;
}

function safeErrorMessage(message?: string): string {
  const normalized = message?.trim();
  return normalized || SESSION_FRAME_MESSAGES.ERROR;
}

export function sessionFrameReducer(
  state: SessionFrameState,
  action: SessionFrameAction
): SessionFrameState {
  if (isStale(state, action)) return state;

  switch (action.type) {
    case 'START_REQUESTED':
      return {
        ...createInitialSessionFrameState(action.runId),
        phase: 'CREATING_SESSION',
        message: SESSION_FRAME_MESSAGES.CREATING_SESSION,
        canReset: true
      };
    case 'SESSION_CREATED':
      return {
        ...state,
        phase: 'CONNECTING_FRAME',
        message: SESSION_FRAME_MESSAGES.CONNECTING_FRAME,
        canReset: true
      };
    case 'FRAME_CONNECTED':
      if (state.phase === 'RECONNECTING') {
        return {
          ...state,
          message: SESSION_FRAME_MESSAGES.RECONNECTING,
          recoveryPending: true,
          canRetryManually: false
        };
      }
      return {
        ...state,
        phase: 'WAITING_FIRST_FRAME',
        message: SESSION_FRAME_MESSAGES.WAITING_FIRST_FRAME,
        canReset: true,
        recoveryPending: false,
        canRetryManually: false
      };
    case 'FRAME_RECEIVED': {
      const completesPendingAction =
        state.expectedActionFrame?.frameId === action.frame.metadata.frameId &&
        state.expectedActionFrame.sequence === action.frame.metadata.sequence;
      return {
        ...state,
        phase: 'FRAME_READY',
        message: SESSION_FRAME_MESSAGES.FRAME_READY,
        frame: action.frame,
        hasReceivedFirstFrame: true,
        canReset: true,
        recoveryAttempt: 0,
        canRetryManually: false,
        recoveryPending: false,
        actionPending: completesPendingAction ? false : state.actionPending,
        pendingActionType: completesPendingAction ? null : state.pendingActionType,
        expectedActionFrame: completesPendingAction
          ? null
          : state.expectedActionFrame,
        actionMessage: completesPendingAction
          ? '요청한 화면 동작이 새 화면에 반영되었습니다.'
          : state.actionMessage,
        actionError: completesPendingAction ? null : state.actionError
      };
    }
    case 'DISCONNECTED':
      return {
        ...state,
        phase: 'DISCONNECTED',
        message: safeErrorMessage(action.message ?? SESSION_FRAME_MESSAGES.DISCONNECTED),
        frame: undefined,
        canReset: true,
        canRetryManually: action.canRetryManually ?? false,
        recoveryPending: false,
        actionPending: false,
        pendingActionType: null,
        expectedActionFrame: null
      };
    case 'RECONNECT_SCHEDULED':
      return {
        ...state,
        phase: 'RECONNECTING',
        message: SESSION_FRAME_MESSAGES.RECONNECTING,
        frame: undefined,
        canReset: true,
        recoveryAttempt: action.attempt,
        recoveryMaxAttempts: action.maxAttempts,
        canRetryManually: false,
        recoveryPending: true,
        actionPending: false,
        pendingActionType: null,
        expectedActionFrame: null
      };
    case 'MANUAL_RETRY_STARTED':
      return {
        ...state,
        phase: 'RECONNECTING',
        message: SESSION_FRAME_MESSAGES.RECONNECTING,
        frame: undefined,
        canReset: true,
        canRetryManually: false,
        recoveryPending: true,
        actionPending: false,
        pendingActionType: null,
        expectedActionFrame: null
      };
    case 'RECOVERY_FAILED':
      return {
        ...state,
        phase: 'ERROR',
        message: safeErrorMessage(
          action.message ?? '원격 화면 연결을 복구하지 못했습니다. 다시 연결해 주세요.'
        ),
        frame: undefined,
        canReset: true,
        canRetryManually: true,
        recoveryPending: false,
        actionPending: false,
        pendingActionType: null,
        expectedActionFrame: null
      };
    case 'SAFE_ERROR':
      return {
        ...state,
        phase: 'ERROR',
        message: safeErrorMessage(action.message),
        frame: undefined,
        canReset: true,
        canRetryManually: action.canRetryManually ?? false,
        recoveryPending: false,
        actionPending: false,
        pendingActionType: null,
        expectedActionFrame: null
      };
    case 'ACTION_REQUESTED':
      return {
        ...state,
        actionPending: true,
        pendingActionType: action.actionType,
        expectedActionFrame: null,
        actionMessage:
          action.actionType === 'CLICK'
            ? '클릭 동작을 처리하고 있습니다.'
            : '스크롤 동작을 처리하고 있습니다.',
        actionError: null
      };
    case 'ACTION_FRAME_EXPECTED':
      return {
        ...state,
        actionPending: true,
        expectedActionFrame: {
          frameId: action.frameId,
          sequence: action.sequence
        },
        actionMessage: '동작이 반영된 새 화면을 기다리고 있습니다.',
        actionError: null
      };
    case 'ACTION_COMPLETED':
      return {
        ...state,
        actionPending: false,
        pendingActionType: null,
        expectedActionFrame: null,
        actionMessage: action.message,
        actionError: null
      };
    case 'ACTION_FINISHED_WITHOUT_FRAME':
      return {
        ...state,
        actionPending: false,
        pendingActionType: null,
        expectedActionFrame: null,
        actionMessage: action.message,
        actionError: null
      };
    case 'ACTION_FAILED':
      return {
        ...state,
        actionPending: false,
        pendingActionType: null,
        expectedActionFrame: null,
        actionMessage: '원격 화면 동작을 완료하지 못했습니다.',
        actionError: action.message
      };
    case 'RESET':
      return createInitialSessionFrameState(action.nextRunId);
  }
}
