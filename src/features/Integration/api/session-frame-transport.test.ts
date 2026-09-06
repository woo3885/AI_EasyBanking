import { describe, expect, it, vi } from 'vitest';

import {
  MAX_FRAME_BYTE_LENGTH,
  createSessionFrameTransport,
  validateFrameMetadata,
  type SessionFrameTransportEvent
} from './session-frame-transport';

class FakeSocket {
  binaryType: BinaryType = 'blob';
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  close = vi.fn();

  open() {
    this.onopen?.(new Event('open'));
  }

  message(data: unknown) {
    this.onmessage?.({ data } as MessageEvent<unknown>);
  }

  closed(code = 1006, wasClean = false, reason = 'raw close reason') {
    this.onclose?.({ code, wasClean, reason } as CloseEvent);
  }
}

const sessionId = 'session-123';

function metadata(sequence = 1, byteLength = 4) {
  return {
    type: 'BROWSER_FRAME',
    sessionId,
    frameId: `frm-${sequence}`,
    sequence,
    timestamp: 1_786_350_000_000,
    width: 1280,
    height: 720,
    mimeType: 'image/png',
    byteLength
  };
}

function setup() {
  const socket = new FakeSocket();
  const webSocketFactory = vi.fn().mockReturnValue(socket);
  let objectUrlIndex = 0;
  const objectUrlFactory = {
    create: vi.fn(() => `blob:frame-${++objectUrlIndex}`),
    revoke: vi.fn()
  };
  const transport = createSessionFrameTransport({
    webSocketUrl: `ws://127.0.0.1:8080/ws/sessions/${sessionId}/frames`,
    sessionId,
    webSocketFactory,
    objectUrlFactory
  });
  const listener = vi.fn<(event: SessionFrameTransportEvent) => void>();
  transport.subscribe(listener);
  return { transport, socket, webSocketFactory, objectUrlFactory, listener };
}

describe('session frame transport', () => {
  it('검증할 metadata 입력 객체를 변경하지 않는다', () => {
    const input = Object.freeze(metadata());
    const snapshot = { ...input };

    expect(validateFrameMetadata(input, sessionId)).toEqual(input);
    expect(input).toEqual(snapshot);
  });

  it('raw WebSocket URL, subprotocol, arraybuffer 설정으로 연결한다', () => {
    const { transport, socket, webSocketFactory, listener } = setup();
    transport.connect();
    socket.open();

    expect(webSocketFactory).toHaveBeenCalledWith(
      `ws://127.0.0.1:8080/ws/sessions/${sessionId}/frames`,
      'ddd.browser-frame.v1'
    );
    expect(socket.binaryType).toBe('arraybuffer');
    expect(listener).toHaveBeenCalledWith({ type: 'CONNECTED' });
  });

  it('metadata 다음 Binary를 ViewerFrame으로 변환한다', () => {
    const { transport, socket, objectUrlFactory, listener } = setup();
    transport.connect();
    socket.message(JSON.stringify(metadata()));
    socket.message(new Uint8Array([1, 2, 3, 4]).buffer);

    expect(objectUrlFactory.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'image/png', size: 4 })
    );
    expect(listener).toHaveBeenCalledWith({
      type: 'FRAME_RECEIVED',
      frame: {
        metadata: {
          type: 'BROWSER_FRAME',
          sessionId,
          frameId: 'frm-1',
          sequence: 1,
          timestamp: 1_786_350_000_000,
          width: 1280,
          height: 720,
          mimeType: 'image/png',
          byteLength: 4
        },
        imageSrc: 'blob:frame-1'
      }
    });
  });

  it('새 frame을 수용한 뒤 이전 Object URL만 revoke한다', () => {
    const { transport, socket, objectUrlFactory } = setup();
    transport.connect();
    socket.message(JSON.stringify(metadata(1)));
    socket.message(new Uint8Array(4).buffer);
    socket.message(JSON.stringify(metadata(2)));
    socket.message(new Uint8Array(4).buffer);

    expect(objectUrlFactory.revoke).toHaveBeenCalledTimes(1);
    expect(objectUrlFactory.revoke).toHaveBeenCalledWith('blob:frame-1');
  });

  it('같거나 더 작은 sequence는 Binary까지 소비한 뒤 무시한다', () => {
    const { transport, socket, objectUrlFactory, listener } = setup();
    transport.connect();
    socket.message(JSON.stringify(metadata(3)));
    socket.message(new Uint8Array(4).buffer);
    socket.message(JSON.stringify(metadata(3)));
    socket.message(new Uint8Array(4).buffer);
    socket.message(JSON.stringify(metadata(2)));
    socket.message(new Uint8Array(4).buffer);

    expect(objectUrlFactory.create).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls.filter(([event]) => event.type === 'FRAME_RECEIVED')).toHaveLength(1);
  });

  it('다음 frame은 metadata 전체를 하나의 ViewerFrame으로 교체한다', () => {
    const { transport, socket, listener } = setup();
    transport.connect();
    socket.message(JSON.stringify(metadata(1)));
    socket.message(new Uint8Array(4).buffer);
    socket.message(JSON.stringify(metadata(2)));
    socket.message(new Uint8Array(4).buffer);

    const frames = listener.mock.calls
      .map(([event]) => event)
      .filter((event) => event.type === 'FRAME_RECEIVED');

    expect(frames).toHaveLength(2);
    expect(frames[1]).toMatchObject({
      frame: {
        metadata: {
          frameId: 'frm-2',
          sequence: 2,
          timestamp: 1_786_350_000_000
        },
        imageSrc: 'blob:frame-2'
      }
    });
  });

  it('metadata 없는 Binary를 protocol error로 처리한다', () => {
    const { transport, socket, listener } = setup();
    transport.connect();
    socket.message(new Uint8Array(4).buffer);

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SAFE_ERROR', category: 'PROTOCOL' })
    );
  });

  it('Binary 대기 중 두 번째 metadata를 protocol error로 처리한다', () => {
    const { transport, socket, listener } = setup();
    transport.connect();
    socket.message(JSON.stringify(metadata(1)));
    socket.message(JSON.stringify(metadata(2)));

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SAFE_ERROR', category: 'PROTOCOL' })
    );
  });

  it('metadata와 Binary byteLength 불일치를 거부한다', () => {
    const { transport, socket, listener, objectUrlFactory } = setup();
    transport.connect();
    socket.message(JSON.stringify(metadata(1, 5)));
    socket.message(new Uint8Array(4).buffer);

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SAFE_ERROR', category: 'PROTOCOL' })
    );
    expect(objectUrlFactory.create).not.toHaveBeenCalled();
  });

  it.each([
    ['session mismatch', { ...metadata(), sessionId: 'other-session' }],
    ['invalid MIME', { ...metadata(), mimeType: 'image/jpeg' }],
    ['invalid width', { ...metadata(), width: 640 }],
    ['invalid sequence', { ...metadata(), sequence: 0 }],
    ['invalid timestamp', { ...metadata(), timestamp: 123 }],
    ['too large', { ...metadata(), byteLength: MAX_FRAME_BYTE_LENGTH + 1 }]
  ])('%s metadata를 거부한다', (_, value) => {
    expect(() => validateFrameMetadata(value, sessionId)).toThrow();
  });

  it('예상하지 않은 payload를 protocol error로 처리한다', () => {
    const { transport, socket, listener } = setup();
    transport.connect();
    socket.message(new Blob(['unexpected']));

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SAFE_ERROR', category: 'PROTOCOL' })
    );
  });

  it('disconnect는 멱등이며 현재 Object URL과 callback을 정리한다', () => {
    const { transport, socket, objectUrlFactory, listener } = setup();
    transport.connect();
    socket.message(JSON.stringify(metadata()));
    socket.message(new Uint8Array(4).buffer);
    listener.mockClear();

    transport.disconnect();
    transport.disconnect();
    socket.message(JSON.stringify(metadata(2)));

    expect(socket.close).toHaveBeenCalledTimes(1);
    expect(objectUrlFactory.revoke).toHaveBeenCalledTimes(1);
    expect(listener).not.toHaveBeenCalled();
  });

  it('close code와 clean 여부만 안전한 종료 구조로 전달한다', () => {
    const { transport, socket, listener } = setup();
    transport.connect();

    socket.closed(1012, false, 'private backend detail');

    expect(listener).toHaveBeenCalledWith({
      type: 'DISCONNECTED',
      close: { code: 1012, wasClean: false }
    });
    expect(JSON.stringify(listener.mock.calls)).not.toContain('private backend detail');
  });

  it('client 의도 종료는 비정상 DISCONNECTED callback을 만들지 않는다', () => {
    const { transport, socket, listener } = setup();
    transport.connect();
    listener.mockClear();

    transport.disconnect();
    socket.closed(1000, true);

    expect(listener).not.toHaveBeenCalled();
  });

  it('Binary 대기 중 close 시 불완전 frame을 폐기한다', () => {
    const { transport, socket, objectUrlFactory, listener } = setup();
    transport.connect();
    socket.message(JSON.stringify(metadata(1)));

    socket.closed();

    expect(objectUrlFactory.create).not.toHaveBeenCalled();
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'DISCONNECTED' })
    );
  });

  it('reconnect에서도 마지막 sequence를 유지하고 duplicate는 소비 후 무시한다', () => {
    const firstSocket = new FakeSocket();
    const secondSocket = new FakeSocket();
    const sockets = [firstSocket, secondSocket];
    const webSocketFactory = vi.fn(() => {
      const socket = sockets.shift();
      if (!socket) throw new Error('unexpected socket');
      return socket;
    });
    const objectUrlFactory = {
      create: vi.fn(() => 'blob:new-frame'),
      revoke: vi.fn()
    };
    const listener = vi.fn<(event: SessionFrameTransportEvent) => void>();
    const transport = createSessionFrameTransport({
      webSocketUrl: `ws://127.0.0.1:8080/ws/sessions/${sessionId}/frames`,
      sessionId,
      initialSequence: 5,
      webSocketFactory,
      objectUrlFactory
    });
    transport.subscribe(listener);

    transport.connect();
    firstSocket.message(JSON.stringify(metadata(5)));
    firstSocket.message(new Uint8Array(4).buffer);
    firstSocket.closed();
    transport.connect();
    secondSocket.message(JSON.stringify(metadata(5)));
    secondSocket.message(new Uint8Array(4).buffer);
    secondSocket.message(JSON.stringify(metadata(6)));
    secondSocket.message(new Uint8Array(4).buffer);

    expect(webSocketFactory).toHaveBeenCalledTimes(2);
    expect(objectUrlFactory.create).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls.filter(([event]) => event.type === 'FRAME_RECEIVED'))
      .toHaveLength(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'FRAME_RECEIVED',
        frame: expect.objectContaining({
          metadata: expect.objectContaining({ sequence: 6 })
        })
      })
    );
  });

  it('잘못된 initialSequence를 거부한다', () => {
    expect(() =>
      createSessionFrameTransport({
        webSocketUrl: `ws://127.0.0.1:8080/ws/sessions/${sessionId}/frames`,
        sessionId,
        initialSequence: -1
      })
    ).toThrow('마지막 화면 순서');
  });

  it('unsubscribe 이후 listener callback을 호출하지 않는다', () => {
    const socket = new FakeSocket();
    const transport = createSessionFrameTransport({
      webSocketUrl: 'ws://127.0.0.1:8080/ws/sessions/session-123/frames',
      sessionId,
      webSocketFactory: () => socket,
      objectUrlFactory: { create: () => 'blob:x', revoke: vi.fn() }
    });
    const listener = vi.fn();
    const unsubscribe = transport.subscribe(listener);
    transport.connect();
    unsubscribe();
    socket.open();

    expect(listener).not.toHaveBeenCalled();
  });

  it('중복 connect를 차단하고 자동 reconnect하지 않는다', () => {
    const { transport, webSocketFactory } = setup();
    transport.connect();
    expect(() => transport.connect()).toThrow('이미');
    expect(webSocketFactory).toHaveBeenCalledTimes(1);
  });
});
