import { useCallback, useEffect, useReducer, useRef } from 'react';

import {
  createSessionStatusTransport,
  type SessionStatusTransport,
  type SessionStatusTransportEvent,
  type SessionStatusTransportOptions
} from '@/features/Integration/api/session-status-transport';
import { sessionUiReducer } from '@/features/Integration/model/session-ui-reducer';
import {
  createInitialSessionUiState,
  type SessionFrameIdentity
} from '@/features/Integration/model/session-ui-state';
import type { WorkflowStatus } from '@/types/frontend-state';

type StatusTransportFactory = (
  options: SessionStatusTransportOptions
) => SessionStatusTransport;

export interface UseSessionStatusIntegrationOptions {
  sessionId: string;
  initialStatus?: WorkflowStatus;
  baseUrl?: string;
  transportFactory?: StatusTransportFactory;
}

export function useSessionStatusIntegration({
  sessionId,
  initialStatus = 'SESSION_CREATED',
  baseUrl,
  transportFactory = createSessionStatusTransport
}: UseSessionStatusIntegrationOptions) {
  const [state, dispatch] = useReducer(
    sessionUiReducer,
    undefined,
    () => createInitialSessionUiState(sessionId, initialStatus)
  );
  const generationRef = useRef(0);
  const transportRef = useRef<SessionStatusTransport | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const release = useCallback(() => {
    ++generationRef.current;
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    transportRef.current?.disconnect();
    transportRef.current = null;
  }, []);

  useEffect(() => {
    release();
    const generation = generationRef.current;
    dispatch({ type: 'RESET', sessionId, initialStatus });

    let transport: SessionStatusTransport;
    try {
      transport = transportFactory({ sessionId, baseUrl });
    } catch {
      dispatch({
        type: 'SAFE_ERROR',
        message: '실시간 상태 연결 설정을 확인해 주세요.'
      });
      return release;
    }

    transportRef.current = transport;
    unsubscribeRef.current = transport.subscribe(
      (event: SessionStatusTransportEvent) => {
        if (generation !== generationRef.current) return;
        switch (event.type) {
          case 'SYNC_STARTED':
            dispatch({ type: 'SYNC_STARTED' });
            break;
          case 'SNAPSHOT_RECEIVED':
            dispatch({ type: 'SNAPSHOT_REPLACED', snapshot: event.snapshot });
            break;
          case 'EVENT_RECEIVED':
            dispatch({ type: 'EVENT_RECEIVED', event: event.event });
            break;
          case 'CONNECTED':
            dispatch({ type: 'CONNECTED' });
            break;
          case 'DISCONNECTED':
            dispatch({ type: 'DISCONNECTED' });
            break;
          case 'SAFE_ERROR':
            dispatch({ type: 'SAFE_ERROR', message: event.message });
            break;
        }
      }
    );

    try {
      transport.connect();
    } catch {
      dispatch({
        type: 'SAFE_ERROR',
        message: '실시간 상태 연결을 시작하지 못했습니다.'
      });
    }

    return release;
  }, [baseUrl, initialStatus, release, sessionId, transportFactory]);

  const observeFrame = useCallback((frame: SessionFrameIdentity | null) => {
    dispatch({ type: 'FRAME_OBSERVED', frame });
  }, []);

  const selectDecisionOption = useCallback(
    (decisionId: string, optionId: string) => {
      dispatch({ type: 'DECISION_OPTION_SELECTED', decisionId, optionId });
    },
    []
  );

  const toggleDecisionTerm = useCallback(
    (decisionId: string, optionId: string, selected: boolean) => {
      dispatch({
        type: 'DECISION_TERM_TOGGLED',
        decisionId,
        optionId,
        selected
      });
    },
    []
  );

  const markDecisionSubmitStarted = useCallback((decisionId: string) => {
    dispatch({ type: 'DECISION_SUBMIT_STARTED', decisionId });
  }, []);

  const markDecisionSubmitAcknowledged = useCallback((decisionId: string) => {
    dispatch({ type: 'DECISION_SUBMIT_ACKNOWLEDGED', decisionId });
  }, []);

  const markDecisionSubmitFailed = useCallback(
    (decisionId: string, message: string) => {
      dispatch({ type: 'DECISION_SUBMIT_FAILED', decisionId, message });
    },
    []
  );

  const markDecisionSubmitAborted = useCallback((decisionId: string) => {
    dispatch({ type: 'DECISION_SUBMIT_ABORTED', decisionId });
  }, []);

  const markSecureInputSubmitStarted = useCallback((secureRequestId: string) => {
    dispatch({ type: 'SECURE_INPUT_SUBMIT_STARTED', secureRequestId });
  }, []);

  const markSecureInputSubmitAcknowledged = useCallback((secureRequestId: string) => {
    dispatch({ type: 'SECURE_INPUT_SUBMIT_ACKNOWLEDGED', secureRequestId });
  }, []);

  const markSecureInputSubmitFailed = useCallback(
    (secureRequestId: string, message: string) => {
      dispatch({ type: 'SECURE_INPUT_SUBMIT_FAILED', secureRequestId, message });
    },
    []
  );

  const markSecureInputSubmitAborted = useCallback((secureRequestId: string) => {
    dispatch({ type: 'SECURE_INPUT_SUBMIT_ABORTED', secureRequestId });
  }, []);

  const setConfirmationConfirmed = useCallback(
    (confirmationId: string, confirmed: boolean) => {
      dispatch({
        type: 'CONFIRMATION_CHECKED_CHANGED',
        confirmationId,
        confirmed
      });
    },
    []
  );

  const markConfirmationSubmitStarted = useCallback(
    (confirmationId: string, action: 'APPROVE' | 'REJECT') => {
      dispatch({
        type: 'CONFIRMATION_SUBMIT_STARTED',
        confirmationId,
        action
      });
    },
    []
  );

  const markConfirmationSubmitAcknowledged = useCallback(
    (confirmationId: string) => {
      dispatch({ type: 'CONFIRMATION_SUBMIT_ACKNOWLEDGED', confirmationId });
    },
    []
  );

  const markConfirmationSubmitFailed = useCallback(
    (confirmationId: string, message: string) => {
      dispatch({
        type: 'CONFIRMATION_SUBMIT_FAILED',
        confirmationId,
        message
      });
    },
    []
  );

  const markConfirmationSubmitAborted = useCallback(
    (confirmationId: string) => {
      dispatch({ type: 'CONFIRMATION_SUBMIT_ABORTED', confirmationId });
    },
    []
  );

  return {
    ...state,
    observeFrame,
    selectDecisionOption,
    toggleDecisionTerm,
    markDecisionSubmitStarted,
    markDecisionSubmitAcknowledged,
    markDecisionSubmitFailed,
    markDecisionSubmitAborted,
    markSecureInputSubmitStarted,
    markSecureInputSubmitAcknowledged,
    markSecureInputSubmitFailed,
    markSecureInputSubmitAborted,
    setConfirmationConfirmed,
    markConfirmationSubmitStarted,
    markConfirmationSubmitAcknowledged,
    markConfirmationSubmitFailed,
    markConfirmationSubmitAborted
  };
}
