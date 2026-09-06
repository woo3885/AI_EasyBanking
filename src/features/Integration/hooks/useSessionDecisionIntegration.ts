import { useCallback, useEffect, useRef } from 'react';

import {
  SessionDecisionClientError,
  defaultSessionDecisionClient,
  type SessionDecisionClient
} from '@/features/Integration/api/session-decision-client';
import {
  canSubmitSessionDecision,
  isDecisionMatchingFrame,
  selectedDecisionOptionIds,
  type SessionFrameIdentity,
  type SessionUiState
} from '@/features/Integration/model/session-ui-state';

type DecisionClient = Pick<SessionDecisionClient, 'submitDecision'>;

export interface UseSessionDecisionIntegrationOptions {
  state: SessionUiState;
  frame: SessionFrameIdentity | null;
  frameReady: boolean;
  frameReconnecting: boolean;
  viewerActionPending: boolean;
  client?: DecisionClient;
  onSelectOption: (decisionId: string, optionId: string) => void;
  onToggleTerm: (
    decisionId: string,
    optionId: string,
    selected: boolean
  ) => void;
  onSubmitStarted: (decisionId: string) => void;
  onSubmitAcknowledged: (decisionId: string) => void;
  onSubmitFailed: (decisionId: string, message: string) => void;
  onSubmitAborted: (decisionId: string) => void;
}

function safeSubmitError(error: unknown): string {
  return error instanceof SessionDecisionClientError
    ? error.message
    : '선택 결과를 처리하지 못했습니다. 잠시 후 다시 확인해 주세요.';
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export function useSessionDecisionIntegration({
  state,
  frame,
  frameReady,
  frameReconnecting,
  viewerActionPending,
  client = defaultSessionDecisionClient,
  onSelectOption,
  onToggleTerm,
  onSubmitStarted,
  onSubmitAcknowledged,
  onSubmitFailed,
  onSubmitAborted
}: UseSessionDecisionIntegrationOptions) {
  const mountedRef = useRef(true);
  const runIdRef = useRef(0);
  const inFlightRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const pendingDecisionIdRef = useRef<string | null>(null);
  const decisionRef = useRef(state.activeDecision);
  decisionRef.current = state.activeDecision;

  const abortPending = useCallback(() => {
    if (!inFlightRef.current) return;
    const decisionId = pendingDecisionIdRef.current;
    ++runIdRef.current;
    inFlightRef.current = false;
    abortRef.current?.abort();
    abortRef.current = null;
    pendingDecisionIdRef.current = null;
    if (decisionId) onSubmitAborted(decisionId);
  }, [onSubmitAborted]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      ++runIdRef.current;
      inFlightRef.current = false;
      abortRef.current?.abort();
      abortRef.current = null;
      pendingDecisionIdRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (
      inFlightRef.current &&
      (
        state.workflowStatus !== 'USER_DECISION_REQUIRED' ||
        state.connectionPhase !== 'CONNECTED' ||
        !frameReady ||
        frameReconnecting ||
        viewerActionPending ||
        pendingDecisionIdRef.current !== state.activeDecision?.decisionId ||
        !isDecisionMatchingFrame(state.activeDecision, frame)
      )
    ) {
      abortPending();
    }
  }, [
    abortPending,
    frame,
    frameReady,
    frameReconnecting,
    state.activeDecision,
    state.connectionPhase,
    state.workflowStatus,
    viewerActionPending
  ]);

  const canSubmit = canSubmitSessionDecision({
    state,
    frame,
    frameReady,
    frameReconnecting,
    viewerActionPending
  });
  const controlsDisabled =
    state.workflowStatus !== 'USER_DECISION_REQUIRED' ||
    state.connectionPhase !== 'CONNECTED' ||
    !frameReady ||
    frameReconnecting ||
    viewerActionPending ||
    !isDecisionMatchingFrame(state.activeDecision, frame) ||
    state.decisionSubmitPhase === 'SUBMITTING' ||
    state.decisionSubmitPhase === 'WAITING_FOR_RESUME';

  const selectOption = useCallback(
    (optionId: string) => {
      const decision = state.activeDecision;
      if (decision) onSelectOption(decision.decisionId, optionId);
    },
    [onSelectOption, state.activeDecision]
  );

  const toggleTerm = useCallback(
    (optionId: string, selected: boolean) => {
      const decision = state.activeDecision;
      if (decision) onToggleTerm(decision.decisionId, optionId, selected);
    },
    [onToggleTerm, state.activeDecision]
  );

  const submit = useCallback(
    async (confirmedOptionIds: readonly string[]) => {
      const decision = state.activeDecision;
      const selectedIds = selectedDecisionOptionIds(state);
      if (
        !decision ||
        !canSubmitSessionDecision({
          state,
          frame,
          frameReady,
          frameReconnecting,
          viewerActionPending
        }) ||
        selectedIds === null ||
        !sameIds(selectedIds, confirmedOptionIds) ||
        inFlightRef.current
      ) {
        return;
      }

      const runId = ++runIdRef.current;
      const controller = new AbortController();
      inFlightRef.current = true;
      abortRef.current = controller;
      pendingDecisionIdRef.current = decision.decisionId;
      onSubmitStarted(decision.decisionId);

      try {
        await client.submitDecision({
          sessionId: state.sessionId,
          request: {
            requestId: decision.requestId,
            decisionId: decision.decisionId,
            decisionType: decision.decisionType,
            selectedOptionIds: selectedIds,
            expectedFrameId: decision.frameId,
            expectedSequence: decision.frameSequence
          },
          signal: controller.signal
        });

        if (
          mountedRef.current &&
          runId === runIdRef.current &&
          decisionRef.current?.decisionId === decision.decisionId
        ) {
          onSubmitAcknowledged(decision.decisionId);
        }
      } catch (error) {
        if (
          mountedRef.current &&
          runId === runIdRef.current &&
          !controller.signal.aborted &&
          decisionRef.current?.decisionId === decision.decisionId
        ) {
          onSubmitFailed(decision.decisionId, safeSubmitError(error));
        }
      } finally {
        if (runId === runIdRef.current) {
          inFlightRef.current = false;
          pendingDecisionIdRef.current = null;
          if (abortRef.current === controller) abortRef.current = null;
        }
      }
    },
    [
      client,
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

  const confirmOption = useCallback(
    (optionId: string) => void submit([optionId]),
    [submit]
  );

  const confirmTerms = useCallback(
    (optionIds: readonly string[]) => void submit(optionIds),
    [submit]
  );

  return {
    canSubmit,
    controlsDisabled,
    isBusy: state.decisionSubmitPhase === 'SUBMITTING',
    selectOption,
    toggleTerm,
    confirmOption,
    confirmTerms,
    abort: abortPending
  };
}
