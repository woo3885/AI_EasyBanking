import { useCallback, useEffect, useReducer, useRef } from 'react';

import type { ViewerRemoteAction } from '@/features/F2_StreamViewer/model/viewer-interaction';
import {
  BrowserActionClientError,
  defaultBrowserActionClient,
  type BrowserActionClient,
  type BrowserActionRequest,
  type BrowserActionResponse,
  type BrowserActionStatus
} from '@/features/Integration/api/browser-action-client';
import {
  createSessionFrameTransport,
  type SessionFrameTransport,
  type SessionFrameTransportEvent,
  type SessionFrameTransportOptions
} from '@/features/Integration/api/session-frame-transport';
import {
  defaultSessionRestClient,
  type BackendSession,
  type CreateBackendSessionRequest,
  type SessionRestClient
} from '@/features/Integration/api/session-rest-client';
import {
  classifyFrameConnectionClose,
  getFrameReconnectDelay,
  getFrameReconnectMaxAttempts,
  type FrameConnectionClose,
  type FrameReconnectPolicy
} from '@/features/Integration/model/frame-reconnect-policy';
import { sessionFrameReducer } from '@/features/Integration/model/session-frame-reducer';
import {
  canSubmitViewerAction,
  initialSessionFrameState
} from '@/features/Integration/model/session-frame-state';

const SESSION_REQUEST: CreateBackendSessionRequest = {
  userRequest: '계좌 선택 화면을 확인합니다.',
  siteId: 'demo-bank',
  initialPath: '/transfer/accounts'
};

type SessionClient = Pick<SessionRestClient, 'createSession' | 'cancelSession'>;
type ActionClient = Pick<BrowserActionClient, 'submitBrowserAction'>;
type TransportFactory = (
  options: SessionFrameTransportOptions
) => SessionFrameTransport;

type ConnectFrameTransport = (runId: number) => void;
type HandleFrameDisconnect = (runId: number, close: FrameConnectionClose) => void;

export interface UseSessionFrameIntegrationOptions {
  sessionClient?: SessionClient;
  actionClient?: ActionClient;
  transportFactory?: TransportFactory;
  reconnectPolicy?: FrameReconnectPolicy;
  requestIdFactory?: () => string;
  /** App이 정확히 한 번 생성한 production session을 재사용한다. */
  existingSession?: BackendSession;
}

function createViewerActionRequestId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `viewer_${Array.from(bytes, (value) =>
    value.toString(16).padStart(2, '0')
  ).join('')}`;
}

function toBrowserActionRequest(
  action: ViewerRemoteAction,
  requestId: string
): BrowserActionRequest {
  const common = {
    requestId,
    source: 'USER_VIEWER' as const,
    expectedFrameId: action.frameId,
    expectedSequence: action.sequence
  };

  return action.type === 'CLICK'
    ? {
        ...common,
        actionType: 'CLICK',
        x: action.x,
        y: action.y
      }
    : {
        ...common,
        actionType: 'SCROLL',
        x: action.x,
        y: action.y,
        deltaX: action.deltaX,
        deltaY: action.deltaY
      };
}

function actionResultMessage(response: BrowserActionResponse): string {
  const messages: Record<BrowserActionStatus, string> = {
    EXECUTED: '화면 동작을 처리했지만 새 화면은 생성되지 않았습니다.',
    NO_ACTION: '현재 화면에서 처리할 동작이 없습니다.',
    USER_ACTION_REQUIRED: '사용자가 화면에서 직접 선택해야 합니다.',
    SECURE_INPUT_REQUIRED: '보안 입력은 전용 입력 화면에서 직접 진행해 주세요.',
    FINAL_CONFIRMATION_REQUIRED: '최종 실행은 승인 화면에서 직접 확인해 주세요.',
    BLOCKED: '보안 정책에 따라 화면 동작을 차단했습니다.',
    STOPPED: '원격 화면 동작이 중단되었습니다.'
  };
  return messages[response.status];
}

function safeActionErrorMessage(error: unknown): string {
  if (error instanceof BrowserActionClientError) {
    return error.message;
  }
  return '원격 화면 동작을 처리하지 못했습니다. 연결 상태를 확인해 주세요.';
}

export function useSessionFrameIntegration(
  options: UseSessionFrameIntegrationOptions = {}
) {
  const sessionClient = options.sessionClient ?? defaultSessionRestClient;
  const actionClient = options.actionClient ?? defaultBrowserActionClient;
  const transportFactory = options.transportFactory ?? createSessionFrameTransport;
  const reconnectPolicy = options.reconnectPolicy;
  const requestIdFactory = options.requestIdFactory ?? createViewerActionRequestId;
  const [state, dispatch] = useReducer(sessionFrameReducer, initialSessionFrameState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const runIdRef = useRef(0);
  const runningRef = useRef(false);
  const mountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const actionAbortRef = useRef<AbortController | null>(null);
  const actionPendingRef = useRef(false);
  const expectedActionFrameRef = useRef<{
    frameId: string;
    sequence: number;
  } | null>(null);
  const latestFrameRef = useRef(state.frame);
  const sessionRef = useRef<BackendSession | null>(null);
  const transportRef = useRef<SessionFrameTransport | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const connectionGenerationRef = useRef(0);
  const retryGenerationRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAcceptedSequenceRef = useRef(0);
  const recoveryAttemptRef = useRef(0);
  const recoveryPendingRef = useRef(false);
  const canRetryManuallyRef = useRef(false);
  const manualRetryInFlightRef = useRef(false);
  const connectFrameTransportRef = useRef<ConnectFrameTransport>(() => undefined);
  const handleFrameDisconnectRef = useRef<HandleFrameDisconnect>(() => undefined);

  const clearScheduledRetry = useCallback(() => {
    ++retryGenerationRef.current;
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const releaseConnection = useCallback(() => {
    ++connectionGenerationRef.current;
    const unsubscribe = unsubscribeRef.current;
    unsubscribeRef.current = null;
    unsubscribe?.();

    const transport = transportRef.current;
    transportRef.current = null;
    transport?.disconnect();
  }, []);

  const cancelPendingAction = useCallback(() => {
    actionAbortRef.current?.abort();
    actionAbortRef.current = null;
    actionPendingRef.current = false;
    expectedActionFrameRef.current = null;
  }, []);

  const cancelSessionBestEffort = useCallback(
    async (session: BackendSession | null): Promise<boolean> => {
      if (!session) return true;
      try {
        await sessionClient.cancelSession(session.sessionId);
        return true;
      } catch {
        return false;
      }
    },
    [sessionClient]
  );

  const handleFrameDisconnect = useCallback(
    (runId: number, close: FrameConnectionClose) => {
      if (!mountedRef.current || runId !== runIdRef.current) return;

      clearScheduledRetry();
      releaseConnection();
      cancelPendingAction();
      latestFrameRef.current = undefined;
      recoveryPendingRef.current = false;

      const classification = classifyFrameConnectionClose(close);
      const wasManualRetry = manualRetryInFlightRef.current;
      manualRetryInFlightRef.current = false;
      if (!classification.retryable) {
        recoveryAttemptRef.current = 0;
        canRetryManuallyRef.current = false;
        dispatch({
          type: 'DISCONNECTED',
          runId,
          message: classification.message,
          canRetryManually: false
        });
        return;
      }

      if (wasManualRetry) {
        recoveryAttemptRef.current = 0;
        canRetryManuallyRef.current = true;
        dispatch({
          type: 'DISCONNECTED',
          runId,
          message: `${classification.message} 다시 연결할 수 있습니다.`,
          canRetryManually: true
        });
        return;
      }

      const nextAttempt = recoveryAttemptRef.current + 1;
      const delay = getFrameReconnectDelay(reconnectPolicy, nextAttempt);
      const maxAttempts = getFrameReconnectMaxAttempts(reconnectPolicy);

      if (delay === null || maxAttempts === null) {
        const exhausted =
          maxAttempts !== null &&
          maxAttempts > 0 &&
          recoveryAttemptRef.current >= maxAttempts;
        canRetryManuallyRef.current = true;

        if (exhausted) {
          dispatch({ type: 'RECOVERY_FAILED', runId });
        } else {
          dispatch({
            type: 'DISCONNECTED',
            runId,
            message: `${classification.message} 다시 연결할 수 있습니다.`,
            canRetryManually: true
          });
        }
        return;
      }

      recoveryAttemptRef.current = nextAttempt;
      recoveryPendingRef.current = true;
      canRetryManuallyRef.current = false;
      dispatch({
        type: 'RECONNECT_SCHEDULED',
        runId,
        attempt: nextAttempt,
        maxAttempts
      });

      const retryGeneration = retryGenerationRef.current;
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        if (
          !mountedRef.current ||
          runId !== runIdRef.current ||
          retryGeneration !== retryGenerationRef.current ||
          !recoveryPendingRef.current
        ) {
          return;
        }

        try {
          connectFrameTransportRef.current(runId);
        } catch {
          handleFrameDisconnectRef.current(runId, { code: 1006, wasClean: false });
        }
      }, delay);
    },
    [cancelPendingAction, clearScheduledRetry, reconnectPolicy, releaseConnection]
  );

  const connectFrameTransport = useCallback(
    (runId: number) => {
      const session = sessionRef.current;
      if (!session || !mountedRef.current || runId !== runIdRef.current) return;

      releaseConnection();
      const connectionGeneration = connectionGenerationRef.current;
      const transport = transportFactory({
        webSocketUrl: session.frameWebSocketUrl,
        sessionId: session.sessionId,
        protocol: session.frameProtocol,
        initialSequence: lastAcceptedSequenceRef.current
      });
      transportRef.current = transport;
      unsubscribeRef.current = transport.subscribe((event: SessionFrameTransportEvent) => {
        if (
          !mountedRef.current ||
          runId !== runIdRef.current ||
          connectionGeneration !== connectionGenerationRef.current
        ) {
          return;
        }

        switch (event.type) {
          case 'CONNECTED':
            dispatch({ type: 'FRAME_CONNECTED', runId });
            break;
          case 'FRAME_RECEIVED':
            lastAcceptedSequenceRef.current = event.frame.metadata.sequence;
            latestFrameRef.current = event.frame;
            recoveryAttemptRef.current = 0;
            recoveryPendingRef.current = false;
            canRetryManuallyRef.current = false;
            manualRetryInFlightRef.current = false;
            if (
              expectedActionFrameRef.current?.frameId ===
                event.frame.metadata.frameId &&
              expectedActionFrameRef.current.sequence ===
                event.frame.metadata.sequence
            ) {
              actionPendingRef.current = false;
              expectedActionFrameRef.current = null;
            }
            dispatch({ type: 'FRAME_RECEIVED', runId, frame: event.frame });
            break;
          case 'DISCONNECTED':
            handleFrameDisconnectRef.current(runId, event.close);
            break;
          case 'SAFE_ERROR':
            clearScheduledRetry();
            releaseConnection();
            cancelPendingAction();
            latestFrameRef.current = undefined;
            recoveryPendingRef.current = false;
            canRetryManuallyRef.current = false;
            manualRetryInFlightRef.current = false;
            dispatch({
              type: 'SAFE_ERROR',
              runId,
              message: event.message,
              canRetryManually: false
            });
            break;
        }
      });
      transport.connect();
    },
    [cancelPendingAction, clearScheduledRetry, releaseConnection, transportFactory]
  );

  connectFrameTransportRef.current = connectFrameTransport;
  handleFrameDisconnectRef.current = handleFrameDisconnect;

  const start = useCallback(async () => {
    if (runningRef.current) return;

    clearScheduledRetry();
    releaseConnection();
    cancelPendingAction();
    runningRef.current = true;
    recoveryAttemptRef.current = 0;
    recoveryPendingRef.current = false;
    canRetryManuallyRef.current = false;
    manualRetryInFlightRef.current = false;
    lastAcceptedSequenceRef.current = 0;
    latestFrameRef.current = undefined;
    const runId = ++runIdRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    dispatch({ type: 'START_REQUESTED', runId });

    try {
      const session = await sessionClient.createSession(SESSION_REQUEST, {
        signal: controller.signal
      });

      if (!mountedRef.current || runId !== runIdRef.current) {
        await cancelSessionBestEffort(session);
        return;
      }

      sessionRef.current = session;
      dispatch({ type: 'SESSION_CREATED', runId });
      connectFrameTransportRef.current(runId);
    } catch {
      if (!mountedRef.current || runId !== runIdRef.current) return;
      runningRef.current = false;
      clearScheduledRetry();
      releaseConnection();
      const session = sessionRef.current;
      sessionRef.current = null;
      await cancelSessionBestEffort(session);
      dispatch({
        type: 'SAFE_ERROR',
        runId,
        message: '실제 데모 화면에 연결하지 못했습니다. 실행 상태를 확인해 주세요.'
      });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [
    cancelPendingAction,
    cancelSessionBestEffort,
    clearScheduledRetry,
    releaseConnection,
    sessionClient
  ]);

  const submitViewerAction = useCallback(
    async (action: ViewerRemoteAction) => {
      const currentState = stateRef.current;
      const currentFrame = latestFrameRef.current;
      const session = sessionRef.current;

      if (
        !mountedRef.current ||
        !session ||
        !canSubmitViewerAction(currentState) ||
        actionPendingRef.current ||
        !currentFrame ||
        currentFrame.metadata.frameId !== action.frameId ||
        currentFrame.metadata.sequence !== action.sequence
      ) {
        return;
      }

      const runId = runIdRef.current;
      const controller = new AbortController();
      actionAbortRef.current = controller;
      actionPendingRef.current = true;
      expectedActionFrameRef.current = null;
      dispatch({
        type: 'ACTION_REQUESTED',
        runId,
        actionType: action.type
      });

      try {
        const requestId = requestIdFactory();
        const response = await actionClient.submitBrowserAction({
          sessionId: session.sessionId,
          request: toBrowserActionRequest(action, requestId),
          signal: controller.signal
        });

        if (!mountedRef.current || runId !== runIdRef.current) {
          return;
        }

        if (!response.frameAdvanced) {
          actionPendingRef.current = false;
          dispatch({
            type: 'ACTION_FINISHED_WITHOUT_FRAME',
            runId,
            message: actionResultMessage(response)
          });
          return;
        }

        const expectedFrame = {
          frameId: response.frameId,
          sequence: response.sequence
        };
        const latestFrame = latestFrameRef.current;
        if (
          latestFrame?.metadata.frameId === expectedFrame.frameId &&
          latestFrame.metadata.sequence === expectedFrame.sequence
        ) {
          actionPendingRef.current = false;
          dispatch({
            type: 'ACTION_COMPLETED',
            runId,
            message: '요청한 화면 동작이 새 화면에 반영되었습니다.'
          });
          return;
        }

        expectedActionFrameRef.current = expectedFrame;
        dispatch({
          type: 'ACTION_FRAME_EXPECTED',
          runId,
          ...expectedFrame
        });
      } catch (error) {
        if (
          !mountedRef.current ||
          runId !== runIdRef.current ||
          controller.signal.aborted
        ) {
          return;
        }
        actionPendingRef.current = false;
        expectedActionFrameRef.current = null;
        dispatch({
          type: 'ACTION_FAILED',
          runId,
          message: safeActionErrorMessage(error)
        });
      } finally {
        if (actionAbortRef.current === controller) {
          actionAbortRef.current = null;
        }
      }
    },
    [actionClient, requestIdFactory]
  );

  const retry = useCallback(() => {
    if (
      !mountedRef.current ||
      !sessionRef.current ||
      !canRetryManuallyRef.current ||
      recoveryPendingRef.current
    ) {
      return;
    }

    clearScheduledRetry();
    recoveryAttemptRef.current = 0;
    recoveryPendingRef.current = true;
    canRetryManuallyRef.current = false;
    manualRetryInFlightRef.current = true;
    const runId = runIdRef.current;
    dispatch({ type: 'MANUAL_RETRY_STARTED', runId });

    try {
      connectFrameTransportRef.current(runId);
    } catch {
      recoveryPendingRef.current = false;
      canRetryManuallyRef.current = true;
      manualRetryInFlightRef.current = false;
      releaseConnection();
      dispatch({ type: 'RECOVERY_FAILED', runId });
    }
  }, [clearScheduledRetry, releaseConnection]);

  const reset = useCallback(async () => {
    const nextRunId = ++runIdRef.current;
    runningRef.current = false;
    recoveryPendingRef.current = false;
    canRetryManuallyRef.current = false;
    manualRetryInFlightRef.current = false;
    recoveryAttemptRef.current = 0;
    lastAcceptedSequenceRef.current = 0;
    latestFrameRef.current = undefined;
    abortRef.current?.abort();
    abortRef.current = null;
    cancelPendingAction();
    clearScheduledRetry();
    releaseConnection();

    const session = sessionRef.current;
    sessionRef.current = null;
    dispatch({ type: 'RESET', nextRunId });

    const cleaned = await cancelSessionBestEffort(session);
    if (!cleaned && mountedRef.current && nextRunId === runIdRef.current) {
      dispatch({
        type: 'SAFE_ERROR',
        runId: nextRunId,
        message: '세션 정리를 완료하지 못했습니다. Backend 상태를 확인해 주세요.'
      });
    }
  }, [
    cancelPendingAction,
    cancelSessionBestEffort,
    clearScheduledRetry,
    releaseConnection
  ]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      ++runIdRef.current;
      runningRef.current = false;
      recoveryPendingRef.current = false;
      canRetryManuallyRef.current = false;
      manualRetryInFlightRef.current = false;
      abortRef.current?.abort();
      abortRef.current = null;
      cancelPendingAction();
      latestFrameRef.current = undefined;
      clearScheduledRetry();
      releaseConnection();
      const session = sessionRef.current;
      sessionRef.current = null;
      void cancelSessionBestEffort(session);
    };
  }, [
    cancelPendingAction,
    cancelSessionBestEffort,
    clearScheduledRetry,
    releaseConnection
  ]);

  useEffect(() => {
    const session = options.existingSession;
    if (!session || runningRef.current) return;

    clearScheduledRetry();
    releaseConnection();
    cancelPendingAction();
    mountedRef.current = true;
    runningRef.current = true;
    recoveryAttemptRef.current = 0;
    recoveryPendingRef.current = false;
    canRetryManuallyRef.current = false;
    manualRetryInFlightRef.current = false;
    lastAcceptedSequenceRef.current = 0;
    latestFrameRef.current = undefined;
    sessionRef.current = session;
    const runId = ++runIdRef.current;

    dispatch({ type: 'START_REQUESTED', runId });
    dispatch({ type: 'SESSION_CREATED', runId });

    try {
      connectFrameTransportRef.current(runId);
    } catch {
      runningRef.current = false;
      releaseConnection();
      dispatch({
        type: 'SAFE_ERROR',
        runId,
        message: '실제 데모 화면 연결을 시작하지 못했습니다.'
      });
    }
  }, [
    cancelPendingAction,
    clearScheduledRetry,
    options.existingSession,
    releaseConnection
  ]);

  return {
    phase: state.phase,
    frame: state.frame,
    message: state.message,
    hasReceivedFirstFrame: state.hasReceivedFirstFrame,
    canReset: state.canReset,
    recoveryAttempt: state.recoveryAttempt,
    recoveryMaxAttempts: state.recoveryMaxAttempts,
    canRetryManually: state.canRetryManually,
    recoveryPending: state.recoveryPending,
    actionPending: state.actionPending,
    pendingActionType: state.pendingActionType,
    actionMessage: state.actionMessage,
    actionError: state.actionError,
    canSubmitViewerAction: canSubmitViewerAction(state),
    submitViewerAction,
    start,
    retry,
    reset
  };
}
