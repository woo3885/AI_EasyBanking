import { parseConversationEvent } from './conversation-contract';
import type { ConversationHttpClient } from './conversation-http-client';
import type { ConversationStompClient, StompSubscription } from './conversation-stomp-client';
import type { ConversationServerEvent, ConversationSnapshot } from '../model/conversation-types';
import type { DemoAgentBridgeBinding } from '../model/overlay-types';

export interface ConversationTransportCallbacks {
  onConnected: () => void;
  onReconnecting: () => void;
  onSnapshot: (snapshot: ConversationSnapshot) => void;
  onEvent: (event: ConversationServerEvent) => void;
  onSafeError: () => void;
  onConnectionError?: () => void;
}

export interface ConversationTransport {
  start(sessionId: string, bridgeBinding?: DemoAgentBridgeBinding): void;
  updateBridgeBinding(bridgeBinding: DemoAgentBridgeBinding): void;
  refreshSnapshot(): Promise<ConversationSnapshot | null>;
  disconnect(): void;
}

export function createConversationTransport(options: {
  httpClient: ConversationHttpClient;
  stompClient: ConversationStompClient;
  webSocketUrl: string;
  callbacks: ConversationTransportCallbacks;
}): ConversationTransport {
  let sessionId: string | null = null;
  let bridgeBinding: DemoAgentBridgeBinding | null = null;
  let subscription: StompSubscription | null = null;
  let snapshotAbort: AbortController | null = null;
  let syncing = false;
  let bufferedEvents: ConversationServerEvent[] = [];

  const refreshSnapshot = async () => {
    if (!sessionId) return null;
    snapshotAbort?.abort();
    const controller = new AbortController();
    snapshotAbort = controller;
    try {
      const snapshot = await options.httpClient.getSnapshot(sessionId, controller.signal);
      if (controller.signal.aborted) return null;
      options.callbacks.onSnapshot(snapshot);
      return snapshot;
    } catch {
      if (!controller.signal.aborted) options.callbacks.onSafeError();
      return null;
    } finally {
      if (snapshotAbort === controller) snapshotAbort = null;
    }
  };

  const synchronize = async () => {
    syncing = true;
    bufferedEvents = [];
    const snapshot = await refreshSnapshot();
    if (!snapshot) {
      syncing = false;
      return;
    }
    const queued = bufferedEvents
      .filter((event) => event.sessionId === snapshot.sessionId && event.eventSequence > snapshot.eventSequence)
      .sort((left, right) => left.eventSequence - right.eventSequence);
    bufferedEvents = [];
    syncing = false;
    const eventIds = new Set<string>();
    for (const event of queued) {
      if (!eventIds.has(event.eventId)) {
        eventIds.add(event.eventId);
        options.callbacks.onEvent(event);
      }
    }
  };

  return {
    start(nextSessionId, nextBridgeBinding) {
      subscription?.disconnect();
      snapshotAbort?.abort();
      sessionId = nextSessionId;
      bridgeBinding = nextBridgeBinding ?? null;
      subscription = options.stompClient.subscribe({
        webSocketUrl: options.webSocketUrl,
        destination: `/topic/sessions/${nextSessionId}/events`,
        onConnected() {
          options.callbacks.onConnected();
          void synchronize();
        },
        onMessage(body) {
          let payload: unknown;
          try { payload = JSON.parse(body); } catch { options.callbacks.onSafeError(); return; }
          const event = parseConversationEvent(payload, bridgeBinding ? {
            sessionId: nextSessionId,
            pageIdentity: bridgeBinding.pageIdentity,
            viewport: { width: window.innerWidth, height: window.innerHeight }
          } : undefined, bridgeBinding ? {
            sessionId: nextSessionId,
            browserBindingId: bridgeBinding.browserBindingId,
            pageIdentity: bridgeBinding.pageIdentity
          } : undefined);
          if (!event || event.sessionId !== nextSessionId) {
            options.callbacks.onSafeError();
            return;
          }
          if (syncing) bufferedEvents.push(event);
          else options.callbacks.onEvent(event);
        },
        onDisconnected(willReconnect) {
          if (willReconnect) options.callbacks.onReconnecting();
        },
        onError() {
          options.callbacks.onConnectionError?.();
          options.callbacks.onSafeError();
        }
      });
    },
    updateBridgeBinding(nextBridgeBinding) {
      if (sessionId === nextBridgeBinding.sessionId) bridgeBinding = nextBridgeBinding;
    },
    refreshSnapshot,
    disconnect() {
      subscription?.disconnect();
      subscription = null;
      snapshotAbort?.abort();
      snapshotAbort = null;
      sessionId = null;
      bridgeBinding = null;
      syncing = false;
      bufferedEvents = [];
    }
  };
}
