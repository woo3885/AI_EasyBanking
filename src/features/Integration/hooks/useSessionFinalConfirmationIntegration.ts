import { useCallback, useEffect, useRef } from 'react';

import {
  SessionConfirmationClientError,
  defaultSessionConfirmationClient,
  type SessionConfirmationAction,
  type SessionConfirmationClient
} from '@/features/Integration/api/session-confirmation-client';
import {
  canSubmitFinalConfirmation,
  isConfirmationMatchingFrame,
  type SessionFrameIdentity,
  type SessionUiState
} from '@/features/Integration/model/session-ui-state';

type ConfirmationClient = Pick<SessionConfirmationClient, 'submit'>;

export interface UseSessionFinalConfirmationIntegrationOptions {
  state: SessionUiState;
  frame: SessionFrameIdentity | null;
  frameReady: boolean;
  frameReconnecting: boolean;
  viewerActionPending: boolean;
  client?: ConfirmationClient;
  createRequestId?: () => string;
  onConfirmedChange: (confirmationId: string, confirmed: boolean) => void;
  onSubmitStarted: (
    confirmationId: string,
    action: SessionConfirmationAction
  ) => void;
  onSubmitAcknowledged: (confirmationId: string) => void;
  onSubmitFailed: (confirmationId: string, message: string) => void;
  onSubmitAborted: (confirmationId: string) => void;
}

function defaultRequestId(): string {
  return `confirm-${globalThis.crypto.randomUUID()}`;
}

function safeSubmitError(error: unknown): string {
  return error instanceof SessionConfirmationClientError
    ? error.message
    : '최종 확인 요청을 처리하지 못했습니다. 잠시 후 다시 확인해 주세요.';
}

export function useSessionFinalConfirmationIntegration({
  state,
  frame,
  frameReady,
  frameReconnecting,
  viewerActionPending,
  client = defaultSessionConfirmationClient,
  createRequestId = defaultRequestId,
  onConfirmedChange,
  onSubmitStarted,
  onSubmitAcknowledged,
  onSubmitFailed,
  onSubmitAborted
}: UseSessionFinalConfirmationIntegrationOptions) {
  const mountedRef = useRef(true);
  const runIdRef = useRef(0);
  const inFlightRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const pendingConfirmationIdRef = useRef<string | null>(null);
  const activeConfirmationRef = useRef(state.activeConfirmation);
  activeConfirmationRef.current = state.activeConfirmation;

  const abortPending = useCallback(() => {
    if (!inFlightRef.current) return;
    const confirmationId = pendingConfirmationIdRef.current;
    ++runIdRef.current;
    inFlightRef.current = false;
    abortRef.current?.abort();
    abortRef.current = null;
    pendingConfirmationIdRef.current = null;
    if (confirmationId) onSubmitAborted(confirmationId);
  }, [onSubmitAborted]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      ++runIdRef.current;
      inFlightRef.current = false;
      abortRef.current?.abort();
      abortRef.current = null;
      pendingConfirmationIdRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (
      inFlightRef.current &&
      (state.workflowStatus !== 'FINAL_CONFIRMATION_REQUIRED' ||
        state.connectionPhase !== 'CONNECTED' ||
        !frameReady ||
        frameReconnecting ||
        viewerActionPending ||
        state.activeDecision !== null ||
        state.activeSecureInput !== null ||
        pendingConfirmationIdRef.current !==
          state.activeConfirmation?.confirmationId ||
        !isConfirmationMatchingFrame(state.activeConfirmation, frame))
    ) {
      abortPending();
    }
  }, [
    abortPending,
    frame,
    frameReady,
    frameReconnecting,
    state.activeConfirmation,
    state.activeDecision,
    state.activeSecureInput,
    state.connectionPhase,
    state.workflowStatus,
    viewerActionPending
  ]);

  const canApprove = canSubmitFinalConfirmation({
    state,
    frame,
    frameReady,
    frameReconnecting,
    viewerActionPending,
    action: 'APPROVE'
  });
  const canReject = canSubmitFinalConfirmation({
    state,
    frame,
    frameReady,
    frameReconnecting,
    viewerActionPending,
    action: 'REJECT'
  });
  const isBusy =
    state.confirmationSubmitPhase === 'SUBMITTING_APPROVAL' ||
    state.confirmationSubmitPhase === 'SUBMITTING_REJECTION';
  const approvalRequested =
    state.confirmationSubmitPhase === 'WAITING_FOR_RESULT';

  const submit = useCallback(
    async (action: SessionConfirmationAction) => {
      const confirmation = state.activeConfirmation;
      if (
        !confirmation ||
        !canSubmitFinalConfirmation({
          state,
          frame,
          frameReady,
          frameReconnecting,
          viewerActionPending,
          action
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
      pendingConfirmationIdRef.current = confirmation.confirmationId;
      onSubmitStarted(confirmation.confirmationId, action);

      try {
        await client.submit({
          sessionId: state.sessionId,
          action,
          request: {
            requestId,
            confirmationId: confirmation.confirmationId,
            approved: action === 'APPROVE',
            expectedFrameId: confirmation.frameId,
            expectedSequence: confirmation.frameSequence
          },
          signal: controller.signal
        });
        if (
          mountedRef.current &&
          runId === runIdRef.current &&
          activeConfirmationRef.current?.confirmationId ===
            confirmation.confirmationId
        ) {
          onSubmitAcknowledged(confirmation.confirmationId);
        }
      } catch (error) {
        if (
          mountedRef.current &&
          runId === runIdRef.current &&
          !controller.signal.aborted &&
          activeConfirmationRef.current?.confirmationId ===
            confirmation.confirmationId
        ) {
          onSubmitFailed(confirmation.confirmationId, safeSubmitError(error));
        }
      } finally {
        if (runId === runIdRef.current) {
          inFlightRef.current = false;
          pendingConfirmationIdRef.current = null;
          if (abortRef.current === controller) abortRef.current = null;
        }
      }
    },
    [
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
    ]
  );

  const setConfirmed = useCallback(
    (confirmed: boolean) => {
      const confirmationId = state.activeConfirmation?.confirmationId;
      if (confirmationId) onConfirmedChange(confirmationId, confirmed);
    },
    [onConfirmedChange, state.activeConfirmation?.confirmationId]
  );

  return {
    canApprove,
    canReject,
    controlsDisabled: !canReject || isBusy || approvalRequested,
    isBusy,
    approvalRequested,
    setConfirmed,
    requestApproval: () => void submit('APPROVE'),
    requestRejection: () => void submit('REJECT'),
    abort: abortPending
  };
}
