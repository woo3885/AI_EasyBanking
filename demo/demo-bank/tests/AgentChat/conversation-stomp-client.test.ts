import { afterEach, describe, expect, it, vi } from 'vitest';

import { createNativeConversationStompClient, toConversationWebSocketUrl } from '../../src/features/AgentChat/api/conversation-stomp-client';

class FakeSocket {
  readyState = 1;
  sent: string[] = [];
  listeners = new Map<string, Array<(event: { data?: string }) => void>>();
  send = vi.fn((frame: string) => this.sent.push(frame));
  close = vi.fn();
  addEventListener(name: string, listener: (event: { data?: string }) => void) {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]);
  }
  emit(name: string, event: { data?: string } = {}) {
    for (const listener of this.listeners.get(name) ?? []) listener(event);
  }
}

describe('native conversation STOMP client', () => {
  afterEach(() => vi.useRealTimers());
  it('기존 /ws handshake와 session topic을 사용한다', () => {
    const socket = new FakeSocket(); const onMessage = vi.fn(); const onConnected = vi.fn();
    const client = createNativeConversationStompClient(() => socket as unknown as WebSocket);
    const subscription = client.subscribe({ webSocketUrl: 'ws://127.0.0.1:8080/ws',
      destination: '/topic/sessions/session-1/events', onConnected, onMessage,
      onDisconnected: vi.fn(), onError: vi.fn() });
    socket.emit('open');
    expect(socket.sent[0]).toContain('CONNECT\n');
    socket.emit('message', { data: 'CONNECTED\nversion:1.2\n\n\0' });
    expect(socket.sent[1]).toContain('destination:/topic/sessions/session-1/events');
    expect(onConnected).toHaveBeenCalledTimes(1);
    socket.emit('message', { data: 'MESSAGE\ndestination:/topic/sessions/session-1/events\n\n{"eventId":"event-1"}\0' });
    expect(onMessage).toHaveBeenCalledWith('{"eventId":"event-1"}');
    subscription.disconnect();
    expect(socket.sent.at(-1)).toContain('DISCONNECT');
    expect(socket.close).toHaveBeenCalled();
  });

  it('HTTP base URL을 ws 또는 wss /ws로 변환한다', () => {
    expect(toConversationWebSocketUrl('http://127.0.0.1:8080')).toBe('ws://127.0.0.1:8080/ws');
    expect(toConversationWebSocketUrl('https://example.test/api')).toBe('wss://example.test/ws');
  });

  it('여러 WebSocket message로 분할된 frame을 누적하고 복수 frame을 처리한다', () => {
    const socket = new FakeSocket(); const onMessage = vi.fn();
    createNativeConversationStompClient(() => socket as unknown as WebSocket).subscribe({
      webSocketUrl: 'ws://127.0.0.1:8080/ws', destination: '/topic/sessions/session-1/events',
      onConnected: vi.fn(), onMessage, onDisconnected: vi.fn(), onError: vi.fn()
    });
    socket.emit('message', { data: 'MESSAGE\ndestination:/topic\n\n{"eventId":' });
    expect(onMessage).not.toHaveBeenCalled();
    socket.emit('message', { data: '"event-1"}\0MESSAGE\ndestination:/topic\n\nsecond\0' });
    expect(onMessage.mock.calls.map(([body]) => body)).toEqual(['{"eventId":"event-1"}', 'second']);
  });

  it('UTF-8 byte 기준 content-length를 처리한다', () => {
    const socket = new FakeSocket(); const onMessage = vi.fn();
    createNativeConversationStompClient(() => socket as unknown as WebSocket).subscribe({
      webSocketUrl: 'ws://127.0.0.1:8080/ws', destination: '/topic', onConnected: vi.fn(),
      onMessage, onDisconnected: vi.fn(), onError: vi.fn()
    });
    const body = '{"text":"안내"}';
    const bytes = new TextEncoder().encode(body).byteLength;
    socket.emit('message', { data: `MESSAGE\ncontent-length:${bytes}\n\n${body}\0` });
    expect(onMessage).toHaveBeenCalledWith(body);
  });

  it('STOMP ERROR를 fail-closed 처리하고 reconnect하지 않는다', () => {
    vi.useFakeTimers();
    const socket = new FakeSocket(); const onError = vi.fn(); const onDisconnected = vi.fn();
    const factory = vi.fn(() => socket as unknown as WebSocket);
    createNativeConversationStompClient(factory, 10).subscribe({
      webSocketUrl: 'ws://127.0.0.1:8080/ws', destination: '/topic', onConnected: vi.fn(),
      onMessage: vi.fn(), onDisconnected, onError
    });
    socket.emit('message', { data: 'ERROR\nmessage:invalid\n\nblocked\0' });
    socket.emit('close');
    vi.advanceTimersByTime(20);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(socket.close).toHaveBeenCalledWith(1002, 'invalid STOMP frame');
    expect(onDisconnected).toHaveBeenCalledWith(false);
  });
});
