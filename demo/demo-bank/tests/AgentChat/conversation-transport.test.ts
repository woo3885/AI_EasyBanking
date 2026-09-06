import { describe, expect, it, vi } from 'vitest';

import { createConversationTransport } from '../../src/features/AgentChat/api/conversation-transport';
import type { ConversationHttpClient } from '../../src/features/AgentChat/api/conversation-http-client';
import type { ConversationStompClient } from '../../src/features/AgentChat/api/conversation-stomp-client';
import type { ConversationSnapshot } from '../../src/features/AgentChat/model/conversation-types';

const snapshot: ConversationSnapshot = { snapshotId: 'snapshot-1', sessionId: 'session-1', eventSequence: 2,
  conversationSequence: 1, goalRevision: 0, userGoal: { goalId: 'goal-1' }, activeQuestion: null,
  recentSafeMessages: [{ messageId: 'message-1', requestId: 'request-1', role: 'USER', kind: 'MESSAGE',
    sequence: 1, text: '100만원으로 예금 가입해줘', questionId: null, goalRevision: 0,
    occurredAt: '2026-09-03T00:00:00Z' }], workflowStatus: 'AI_EXECUTING', expiresAt: '2026-09-03T01:00:00Z' };

describe('conversation transport', () => {
  it('구독 후 snapshot을 조회하고 동기화 중 live event를 순서대로 병합한다', async () => {
    let resolveSnapshot!: (value: ConversationSnapshot) => void;
    const getSnapshot = vi.fn(() => new Promise<ConversationSnapshot>((resolve) => { resolveSnapshot = resolve; }));
    let handlers!: Parameters<ConversationStompClient['subscribe']>[0];
    const stompClient: ConversationStompClient = { subscribe: vi.fn((value) => { handlers = value; return { disconnect: vi.fn() }; }) };
    const received: string[] = [];
    const transport = createConversationTransport({
      httpClient: { getSnapshot, createSession: vi.fn(), sendMessage: vi.fn() } as unknown as ConversationHttpClient,
      stompClient, webSocketUrl: 'ws://127.0.0.1:8080/ws',
      callbacks: { onConnected: vi.fn(), onReconnecting: vi.fn(), onSafeError: vi.fn(),
        onSnapshot: () => received.push('snapshot'), onEvent: (event) => received.push(event.eventId) }
    });
    transport.start('session-1');
    expect(handlers.destination).toBe('/topic/sessions/session-1/events');
    handlers.onConnected();
    handlers.onMessage(JSON.stringify({ eventId: 'event-3', eventSequence: 3, eventType: 'AI_MESSAGE',
      sessionId: 'session-1', workflowStatus: 'AI_EXECUTING', occurredAt: '2026-09-03T00:00:02Z',
      messageId: 'ai-2', sequence: 2, text: '안내', kind: 'MESSAGE', goalRevision: 1, errorCode: null }));
    resolveSnapshot(snapshot);
    await Promise.resolve(); await Promise.resolve();
    expect(received).toEqual(['snapshot', 'event-3']);
  });

  it('다른 session과 malformed event를 전달하지 않는다', () => {
    let handlers!: Parameters<ConversationStompClient['subscribe']>[0];
    const onEvent = vi.fn(); const onSafeError = vi.fn();
    const transport = createConversationTransport({
      httpClient: { getSnapshot: vi.fn(), createSession: vi.fn(), sendMessage: vi.fn() } as unknown as ConversationHttpClient,
      stompClient: { subscribe(value) { handlers = value; return { disconnect: vi.fn() }; } },
      webSocketUrl: 'ws://127.0.0.1:8080/ws',
      callbacks: { onConnected: vi.fn(), onReconnecting: vi.fn(), onSnapshot: vi.fn(), onEvent, onSafeError }
    });
    transport.start('session-1');
    handlers.onMessage('{}');
    handlers.onMessage(JSON.stringify({ ...snapshot, eventType: 'AI_MESSAGE', sessionId: 'foreign' }));
    expect(onEvent).not.toHaveBeenCalled();
    expect(onSafeError).toHaveBeenCalledTimes(2);
  });

  it('reconnect 뒤 다시 snapshot을 조회한다', async () => {
    let handlers!: Parameters<ConversationStompClient['subscribe']>[0];
    const getSnapshot = vi.fn().mockResolvedValue(snapshot);
    const onReconnecting = vi.fn();
    const transport = createConversationTransport({
      httpClient: { getSnapshot, createSession: vi.fn(), sendMessage: vi.fn() } as unknown as ConversationHttpClient,
      stompClient: { subscribe(value) { handlers = value; return { disconnect: vi.fn() }; } },
      webSocketUrl: 'ws://127.0.0.1:8080/ws',
      callbacks: { onConnected: vi.fn(), onReconnecting, onSnapshot: vi.fn(), onEvent: vi.fn(), onSafeError: vi.fn() }
    });
    transport.start('session-1');
    handlers.onConnected();
    await Promise.resolve(); await Promise.resolve();
    handlers.onDisconnected(true);
    handlers.onConnected();
    await Promise.resolve(); await Promise.resolve();
    expect(onReconnecting).toHaveBeenCalledTimes(1);
    expect(getSnapshot).toHaveBeenCalledTimes(2);
  });

  it('page identity와 viewport를 기준으로 live OVERLAY_TARGET을 전달한다', () => {
    let handlers!: Parameters<ConversationStompClient['subscribe']>[0];
    const onEvent = vi.fn();
    const transport = createConversationTransport({
      httpClient: { getSnapshot: vi.fn(), createSession: vi.fn(), sendMessage: vi.fn() } as unknown as ConversationHttpClient,
      stompClient: { subscribe(value) { handlers = value; return { disconnect: vi.fn() }; } },
      webSocketUrl: 'ws://127.0.0.1:8080/ws', callbacks: {
        onConnected: vi.fn(), onReconnecting: vi.fn(), onSnapshot: vi.fn(), onEvent, onSafeError: vi.fn()
      }
    });
    transport.start('session-1', {
      sessionId: 'session-1', browserBindingId: 'binding-1', bridgeToken: 'token-1',
      pageIdentity: 'page-1', expiresAt: '2099-01-01T00:00:00Z',
      recoveryPath: '/api/v1/sessions/session-1/conversation/bridge', pageReadyStatus: 'READY'
    });
    handlers.onMessage(JSON.stringify({ eventId: 'event-overlay', eventSequence: 3, eventType: 'OVERLAY_TARGET',
      sessionId: 'session-1', workflowStatus: 'USER_DECISION_REQUIRED', targetId: 'target-1',
      pageIdentity: 'page-1', sourceSnapshotId: 'snap-1', coordinateSpace: 'VIEWPORT_CSS_PX',
      rectangle: { x: 10, y: 20, width: 100, height: 50 },
      viewport: { width: window.innerWidth, height: window.innerHeight }, role: 'button', label: '상품 선택',
      guide: '버튼을 직접 눌러 주세요.', actionMode: 'GUIDE_USER_CLICK',
      expiresAt: '2099-01-01T00:00:00Z', occurredAt: '2026-09-06T12:00:00Z' }));
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'OVERLAY_TARGET', targetId: 'target-1' }));
  });

  it('STOMP 오류를 connection ERROR callback으로 전달한다', () => {
    let handlers!: Parameters<ConversationStompClient['subscribe']>[0];
    const onConnectionError = vi.fn();
    const transport = createConversationTransport({
      httpClient: { getSnapshot: vi.fn(), createSession: vi.fn(), sendMessage: vi.fn() } as unknown as ConversationHttpClient,
      stompClient: { subscribe(value) { handlers = value; return { disconnect: vi.fn() }; } },
      webSocketUrl: 'ws://127.0.0.1:8080/ws', callbacks: {
        onConnected: vi.fn(), onReconnecting: vi.fn(), onSnapshot: vi.fn(), onEvent: vi.fn(),
        onSafeError: vi.fn(), onConnectionError
      }
    });
    transport.start('session-1');
    handlers.onError();
    expect(onConnectionError).toHaveBeenCalledTimes(1);
  });
});
