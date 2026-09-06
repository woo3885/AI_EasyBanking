import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';

import { createConversationHttpClient, DEFAULT_CONVERSATION_API_BASE_URL, type ConversationHttpClient } from '../api/conversation-http-client';
import { createNativeConversationStompClient, toConversationWebSocketUrl, type ConversationStompClient } from '../api/conversation-stomp-client';
import { createConversationTransport, type ConversationTransport } from '../api/conversation-transport';
import { createOverlayHttpClient, type OverlayHttpClient } from '../api/overlay-http-client';
import { readDemoAgentBridge } from '../api/overlay-contract';
import { conversationReducer } from '../model/conversation-reducer';
import {
  getConversationProtectionPolicy,
  type AgentPageProtection
} from '../model/conversation-safety';
import { createInitialConversationState, SAFE_CONNECTION_ERROR, SAFE_RESPONSE_ERROR, type ConversationAction, type ConversationMessage } from '../model/conversation-types';
import type { DemoAgentBridgeBinding, PublicOverlayTarget } from '../model/overlay-types';

export interface AgentChatSubmitRequest { requestId: string; message: ConversationMessage }

export interface AgentConversationDependencies {
  httpClient?: ConversationHttpClient;
  stompClient?: ConversationStompClient;
  backendBaseUrl?: string;
  createId?: (prefix: string) => string;
  onSubmitRequest?: (request: AgentChatSubmitRequest) => void | Promise<void>;
  overlayHttpClient?: OverlayHttpClient;
  bridgeBinding?: DemoAgentBridgeBinding | null;
  pageProtection?: AgentPageProtection;
}

function defaultId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function safeInitialPath(): '/' | '/deposit/products' | '/transfer/accounts' {
  const normalized = window.location.pathname.replace(/\/$/u, '') || '/';
  return normalized === '/deposit/products' || normalized === '/transfer/accounts' ? normalized : '/';
}

export function useAgentConversation(dependencies: AgentConversationDependencies = {}) {
  const [state, dispatch] = useReducer(conversationReducer, undefined, createInitialConversationState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const apply = useCallback((action: ConversationAction) => {
    stateRef.current = conversationReducer(stateRef.current, action);
    dispatch(action);
  }, []);
  const submitLock = useRef(false);
  const requestAbort = useRef<AbortController | null>(null);
  const bootstrapAbort = useRef<AbortController | null>(null);
  const observationAbort = useRef<AbortController | null>(null);
  const bridgeRef = useRef<DemoAgentBridgeBinding | null>(null);
  const pageProtectionRef = useRef<AgentPageProtection>('NONE');
  const bridgeRecoveryGeneration = useRef(0);
  const reconnectRecoveryPending = useRef(false);
  const pendingInitialBridgeTarget = useRef<PublicOverlayTarget | null>(null);
  const transportRef = useRef<ConversationTransport | null>(null);
  const baseUrl = dependencies.backendBaseUrl ?? import.meta.env.VITE_BACKEND_BASE_URL ?? DEFAULT_CONVERSATION_API_BASE_URL;
  const httpClient = useMemo(() => dependencies.httpClient ?? createConversationHttpClient(baseUrl), [baseUrl, dependencies.httpClient]);
  const overlayHttpClient = useMemo(
    () => dependencies.overlayHttpClient ?? createOverlayHttpClient(baseUrl),
    [baseUrl, dependencies.overlayHttpClient]
  );
  const stompClient = useMemo(() => dependencies.stompClient ?? createNativeConversationStompClient(), [dependencies.stompClient]);
  const createId = dependencies.createId ?? defaultId;
  const pageProtection = dependencies.pageProtection ?? 'NONE';
  pageProtectionRef.current = pageProtection;
  const protection = getConversationProtectionPolicy(state, pageProtection);

  const stopTransport = useCallback(() => {
    transportRef.current?.disconnect();
    transportRef.current = null;
  }, []);

  const recoverBridge = useCallback(async (binding: DemoAgentBridgeBinding) => {
    const generation = bridgeRecoveryGeneration.current + 1;
    bridgeRecoveryGeneration.current = generation;
    bootstrapAbort.current?.abort();
    const controller = new AbortController();
    bootstrapAbort.current = controller;
    try {
      const recovery = await overlayHttpClient.recoverBridge(
        binding,
        { width: window.innerWidth, height: window.innerHeight },
        controller.signal
      );
      if (controller.signal.aborted || generation !== bridgeRecoveryGeneration.current) return null;
      return recovery;
    } catch (error) {
      if (controller.signal.aborted || generation !== bridgeRecoveryGeneration.current) return null;
      throw error;
    } finally {
      if (bootstrapAbort.current === controller) bootstrapAbort.current = null;
    }
  }, [overlayHttpClient]);

  const restoreBridgeTarget = useCallback(async () => {
    const binding = bridgeRef.current;
    if (!binding) return;
    try {
      const recovery = await recoverBridge(binding);
      if (!recovery || stateRef.current.sessionId !== recovery.sessionId ||
          stateRef.current.pageIdentity !== recovery.pageIdentity) return;
      const currentProtection = getConversationProtectionPolicy(stateRef.current, pageProtectionRef.current);
      apply({
        type: 'BRIDGE_RECOVERED',
        pageIdentity: recovery.pageIdentity,
        activeTarget: currentProtection.canRestoreOverlay ? recovery.activeTarget : null
      });
    } catch {
      apply({ type: 'CONNECTION_CHANGED', connectionPhase: 'ERROR' });
      apply({ type: 'SAFE_ERROR_SET', error: SAFE_CONNECTION_ERROR });
    }
  }, [apply, recoverBridge]);

  const startTransport = useCallback((sessionId: string, pageIdentity?: string) => {
    stopTransport();
    apply({ type: 'CONNECTION_CHANGED', connectionPhase: 'CONNECTING' });
    const transport = createConversationTransport({
      httpClient,
      stompClient,
      webSocketUrl: toConversationWebSocketUrl(baseUrl),
      callbacks: {
        onConnected: () => apply({ type: 'CONNECTION_CHANGED', connectionPhase: 'CONNECTED' }),
        onReconnecting: () => {
          pendingInitialBridgeTarget.current = null;
          reconnectRecoveryPending.current = true;
          apply({ type: 'CONNECTION_CHANGED', connectionPhase: 'RECONNECTING' });
        },
        onConnectionError: () => {
          pendingInitialBridgeTarget.current = null;
          apply({ type: 'CONNECTION_CHANGED', connectionPhase: 'ERROR' });
        },
        onSnapshot: (snapshot) => {
          apply({ type: 'SNAPSHOT_RESTORED', snapshot });
          if (reconnectRecoveryPending.current) {
            reconnectRecoveryPending.current = false;
            void restoreBridgeTarget();
            return;
          }
          const initialTarget = pendingInitialBridgeTarget.current;
          pendingInitialBridgeTarget.current = null;
          const current = stateRef.current;
          const currentProtection = getConversationProtectionPolicy(current, pageProtectionRef.current);
          if (initialTarget && currentProtection.canRestoreOverlay &&
              current.sessionId === initialTarget.sessionId &&
              current.pageIdentity === initialTarget.pageIdentity) {
            apply({
              type: 'BRIDGE_RECOVERED',
              pageIdentity: initialTarget.pageIdentity,
              activeTarget: initialTarget
            });
          }
        },
        onEvent: (event) => {
          const before = stateRef.current;
          apply({ type: 'SERVER_EVENT_RECEIVED', event });
          if (event.eventType === 'AI_MESSAGE' && before.activeQuestion && event.goalRevision > before.goalRevision) {
            void transportRef.current?.refreshSnapshot();
          }
        },
        onSafeError: () => apply({ type: 'SAFE_ERROR_SET', error: SAFE_RESPONSE_ERROR })
      }
    });
    transportRef.current = transport;
    transport.start(sessionId, pageIdentity);
  }, [apply, baseUrl, httpClient, restoreBridgeTarget, stompClient, stopTransport]);

  useEffect(() => {
    const injected = dependencies.bridgeBinding === undefined
      ? readDemoAgentBridge((window as Window & { __DDD_AGENT_BRIDGE__?: unknown }).__DDD_AGENT_BRIDGE__)
      : dependencies.bridgeBinding;
    if (!injected) return;
    let timer = window.setTimeout(() => {
      timer = 0;
      void recoverBridge(injected).then((recovery) => {
        if (!recovery) return;
        bridgeRef.current = injected;
        apply({ type: 'SESSION_ASSIGNED', sessionId: recovery.sessionId });
        pendingInitialBridgeTarget.current = recovery.activeTarget;
        startTransport(recovery.sessionId, recovery.pageIdentity);
        apply({
          type: 'BRIDGE_RECOVERED',
          pageIdentity: recovery.pageIdentity,
          activeTarget: null
        });
      }).catch(() => {
        apply({ type: 'CONNECTION_CHANGED', connectionPhase: 'ERROR' });
        apply({ type: 'SAFE_ERROR_SET', error: SAFE_CONNECTION_ERROR });
      });
    }, 0);
    return () => {
      if (timer) window.clearTimeout(timer);
      bootstrapAbort.current?.abort();
      bootstrapAbort.current = null;
      bridgeRecoveryGeneration.current += 1;
      pendingInitialBridgeTarget.current = null;
    };
  }, [apply, dependencies.bridgeBinding, recoverBridge, startTransport]);

  const submit = useCallback(async (content: string) => {
    if (submitLock.current ||
        !getConversationProtectionPolicy(stateRef.current, pageProtection).canSubmitMessage) return;
    submitLock.current = true;
    const requestId = createId('chat-request');
    const messageId = createId('chat-message');
    const message: ConversationMessage = {
      messageId, requestId, role: 'USER', kind: 'MESSAGE', sequence: null,
      text: content, questionId: null, goalRevision: null,
      occurredAt: new Date().toISOString()
    };
    apply({ type: 'MESSAGE_SUBMIT_STARTED', requestId, message });
    apply({ type: 'MESSAGE_SUBMIT_DISPATCHED', requestId });
    if (dependencies.onSubmitRequest) {
      try { await dependencies.onSubmitRequest({ requestId, message }); }
      catch { apply({ type: 'MESSAGE_SUBMIT_FAILED', requestId }); }
      finally { submitLock.current = false; }
      return;
    }
    const controller = new AbortController();
    requestAbort.current?.abort();
    requestAbort.current = controller;
    try {
      const current = stateRef.current;
      const ack = current.sessionId
        ? await httpClient.sendMessage(current.sessionId, {
            requestId, messageId, content,
            answerToQuestionId: current.activeQuestion?.questionId ?? null,
            expectedConversationSequence: current.conversationSequence,
            expectedGoalRevision: current.goalRevision,
            clientOccurredAt: message.occurredAt
          }, controller.signal)
        : await httpClient.createSession({
            requestId, messageId, content, siteId: 'demo-bank',
            initialPath: safeInitialPath(), clientOccurredAt: message.occurredAt
          }, controller.signal);
      if (!current.sessionId) {
        apply({ type: 'SESSION_ASSIGNED', sessionId: ack.sessionId });
        startTransport(ack.sessionId);
      }
      apply({ type: 'MESSAGE_ACKNOWLEDGED', requestId, messageId, acceptedSequence: ack.acceptedSequence });
    } catch {
      if (!controller.signal.aborted) apply({ type: 'MESSAGE_SUBMIT_FAILED', requestId });
    } finally {
      if (requestAbort.current === controller) requestAbort.current = null;
      submitLock.current = false;
    }
  }, [apply, createId, dependencies, httpClient, pageProtection, startTransport]);

  const clearOverlay = useCallback(() => {
    apply({ type: 'OVERLAY_CLEARED_LOCAL' });
  }, [apply]);

  const observeTarget = useCallback((target: PublicOverlayTarget) => {
    const current = stateRef.current;
    const bridge = bridgeRef.current;
    if (!getConversationProtectionPolicy(current, pageProtection).canObserveTarget ||
        !bridge || current.observationPhase !== 'IDLE' || !current.activeTarget ||
        current.activeTarget.targetId !== target.targetId ||
        current.activeTarget.pageIdentity !== target.pageIdentity ||
        current.activeTarget.sourceSnapshotId !== target.sourceSnapshotId ||
        bridge.sessionId !== target.sessionId || bridge.pageIdentity !== target.pageIdentity ||
        Date.parse(target.expiresAt) <= Date.now()) return;
    const requestId = createId('observation-request');
    const observation = {
      requestId,
      targetId: target.targetId,
      pageIdentity: target.pageIdentity,
      sourceSnapshotId: target.sourceSnapshotId
    };
    apply({ type: 'OBSERVATION_STARTED', observation });
    const controller = new AbortController();
    observationAbort.current?.abort();
    observationAbort.current = controller;
    void overlayHttpClient.observeClick(bridge, {
      requestId,
      targetId: target.targetId,
      sourceSnapshotId: target.sourceSnapshotId,
      observationType: 'USER_CLICK',
      clientOccurredAt: new Date().toISOString()
    }, controller.signal).then((ack) => {
      if (!controller.signal.aborted) {
        apply({ type: 'OBSERVATION_ACKNOWLEDGED', requestId: ack.requestId, targetId: ack.targetId });
      }
    }).catch(() => {
      if (!controller.signal.aborted) {
        apply({ type: 'OBSERVATION_FAILED', requestId });
        apply({ type: 'SAFE_ERROR_SET', error: SAFE_RESPONSE_ERROR });
      }
    }).finally(() => {
      if (observationAbort.current === controller) observationAbort.current = null;
    });
  }, [apply, createId, overlayHttpClient, pageProtection]);

  const reconnect = useCallback(() => {
    const current = stateRef.current;
    if (current.sessionId && getConversationProtectionPolicy(current, pageProtection).canReconnect) {
      reconnectRecoveryPending.current = true;
      startTransport(current.sessionId, current.pageIdentity ?? undefined);
    }
    else apply({ type: 'SAFE_ERROR_SET', error: SAFE_CONNECTION_ERROR });
  }, [apply, pageProtection, startTransport]);

  useEffect(() => {
    if (protection.reason === 'NONE') return;
    if (!protection.canRestoreOverlay) {
      pendingInitialBridgeTarget.current = null;
      bootstrapAbort.current?.abort();
      bootstrapAbort.current = null;
      bridgeRecoveryGeneration.current += 1;
    }
    requestAbort.current?.abort();
    requestAbort.current = null;
    submitLock.current = false;
    observationAbort.current?.abort();
    observationAbort.current = null;
    apply({ type: 'PROTECTION_ENFORCED', clearDraft: protection.shouldClearDraft });
    if (protection.shouldStopTransport) stopTransport();
  }, [
    apply,
    protection.canRestoreOverlay,
    protection.reason,
    protection.shouldClearDraft,
    protection.shouldStopTransport,
    stopTransport
  ]);

  useEffect(() => {
    if (state.pendingObservation === null) {
      observationAbort.current?.abort();
      observationAbort.current = null;
    }
  }, [state.pendingObservation]);

  useEffect(() => () => {
    requestAbort.current?.abort();
    bootstrapAbort.current?.abort();
    observationAbort.current?.abort();
    bridgeRecoveryGeneration.current += 1;
    reconnectRecoveryPending.current = false;
    bridgeRef.current = null;
    stopTransport();
  }, [stopTransport]);

  return { state, protection, dispatch: apply, submit, reconnect, clearOverlay, observeTarget };
}
