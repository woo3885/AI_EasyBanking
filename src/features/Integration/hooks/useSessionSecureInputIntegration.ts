import { useCallback, useEffect, useRef } from 'react';

import {
  SessionSecureInputClientError,
  defaultSessionSecureInputClient,
  type SessionSecureInputClient
} from '@/features/Integration/api/session-secure-input-client';
import {
  canSubmitSecureInputCompletion,
  isSecureInputMatchingFrame,
  type SessionFrameIdentity,
  type SessionUiState
} from '@/features/Integration/model/session-ui-state';

type SecureInputClient = Pick<SessionSecureInputClient, 'complete'>;

export interface UseSessionSecureInputIntegrationOptions {
  state: SessionUiState;
  frame: SessionFrameIdentity | null;
  frameReady: boolean;
  frameReconnecting: boolean;
  viewerActionPending: boolean;
  client?: SecureInputClient;
  createRequestId?: () => string;
  onSubmitStarted: (secureRequestId: string) => void;
  onSubmitAcknowledged: (secureRequestId: string) => void;
  onSubmitFailed: (secureRequestId: string, message: string) => void;
  onSubmitAborted: (secureRequestId: string) => void;
}

function defaultRequestId(): string {
  return `secure-${globalThis.crypto.randomUUID()}`;
}

function safeSubmitError(error: unknown): string {
  return error instanceof SessionSecureInputClientError
    ? error.message
    : '보안 입력 완료 여부를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

export function useSessionSecureInputIntegration({
  state,
  frame,
  frameReady,
  frameReconnecting,
  viewerActionPending,
  client = defaultSessionSecureInputClient,
  createRequestId = defaultRequestId,
  onSubmitStarted,
  onSubmitAcknowledged,
  onSubmitFailed,
  onSubmitAborted
}: UseSessionSecureInputIntegrationOptions) {
  const mountedRef = useRef(true);
  const runIdRef = useRef(0);
  const inFlightRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const pendingSecureRequestIdRef = useRef<string | null>(null);
  const secureInputRef = useRef(state.activeSecureInput);
  secureInputRef.current = state.activeSecureInput;

  const abortPending = useCallback(() => {
    if (!inFlightRef.current) return;
    const secureRequestId = pendingSecureRequestIdRef.current;
    ++runIdRef.current;
    inFlightRef.current = false;
    abortRef.current?.abort();
    abortRef.current = null;
    pendingSecureRequestIdRef.current = null;
    if (secureRequestId) onSubmitAborted(secureRequestId);
  }, [onSubmitAborted]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      ++runIdRef.current;
      inFlightRef.current = false;
      abortRef.current?.abort();
      abortRef.current = null;
      pendingSecureRequestIdRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (
      inFlightRef.current &&
      (state.workflowStatus !== 'SECURE_INPUT_REQUIRED' ||
        state.connectionPhase !== 'CONNECTED' ||
        !frameReady ||
        frameReconnecting ||
        viewerActionPending ||
        pendingSecureRequestIdRef.current !==
          state.activeSecureInput?.secureRequestId ||
        !isSecureInputMatchingFrame(state.activeSecureInput, frame))
    ) {
      abortPending();
    }
  }, [
    abortPending,
    frame,
    frameReady,
    frameReconnecting,
    state.activeSecureInput,
    state.connectionPhase,
    state.workflowStatus,
    viewerActionPending
  ]);

  const canSubmit = canSubmitSecureInputCompletion({
    state,
    frame,
    frameReady,
    frameReconnecting,
    viewerActionPending
  });
  const controlsDisabled =
    !canSubmit ||
    state.secureInputSubmitPhase === 'SUBMITTING' ||
    state.secureInputSubmitPhase === 'WAITING_FOR_RESUME';

  const requestCompletion = useCallback(async () => {
    const secureInput = state.activeSecureInput;
    if (
      !secureInput ||
      !canSubmitSecureInputCompletion({
        state,
        frame,
        frameReady,
        frameReconnecting,
        viewerActionPending
      }) ||
      inFlightRef.current
    ) {
      return;
    }

    const requestId = createRequestId();
    const runId = ++runIdRef.current;
    const controller = new AbortController();
    inFlightRef.current = true;
    abortRef.current = controller;
    pendingSecureRequestIdRef.current = secureInput.secureRequestId;
    onSubmitStarted(secureInput.secureRequestId);

    try {
      await client.complete({
        sessionId: state.sessionId,
        secureRequestId: secureInput.secureRequestId,
        request: {
          requestId,
          expectedFrameId: secureInput.frameId,
          expectedSequence: secureInput.frameSequence
        },
        signal: controller.signal
      });
      if (
        mountedRef.current &&
        runId === runIdRef.current &&
        secureInputRef.current?.secureRequestId === secureInput.secureRequestId
      ) {
        onSubmitAcknowledged(secureInput.secureRequestId);
      }
    } catch (error) {
      if (
        mountedRef.current &&
        runId === runIdRef.current &&
        !controller.signal.aborted &&
        secureInputRef.current?.secureRequestId === secureInput.secureRequestId
      ) {
        onSubmitFailed(secureInput.secureRequestId, safeSubmitError(error));
      }
    } finally {
      if (runId === runIdRef.current) {
        inFlightRef.current = false;
        pendingSecureRequestIdRef.current = null;
        if (abortRef.current === controller) abortRef.current = null;
      }
    }
  }, [
    client,
    createRequestId,
    frame,
    frameReady,
    frameReconnecting,
    onSubmitAcknowledged,
    onSubmitFailed,
    onSubmitStarted,
    state,
    viewerActionPending
  ]);

  return {
    canSubmit,
    controlsDisabled,
    isBusy: state.secureInputSubmitPhase === 'SUBMITTING',
    completionRequested: state.secureInputSubmitPhase === 'WAITING_FOR_RESUME',
    requestCompletion: () => void requestCompletion(),
    abort: abortPending
  };
}
