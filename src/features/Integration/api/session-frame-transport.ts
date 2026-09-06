import type { ViewerFrame } from '@/features/F2_StreamViewer/model/viewer-frame';
import { FRAME_SUBPROTOCOL } from '@/features/Integration/api/session-rest-client';
import type { FrameConnectionClose } from '@/features/Integration/model/frame-reconnect-policy';

export const FRAME_WIDTH = 1280;
export const FRAME_HEIGHT = 720;
export const FRAME_MIME_TYPE = 'image/png';
export const MAX_FRAME_BYTE_LENGTH = 5 * 1024 * 1024;

const FRAME_ID_PATTERN = /^[A-Za-z0-9-]{1,128}$/;
const MIN_UNIX_EPOCH_MILLISECONDS = 1_000_000_000_000;

export interface BrowserFrameMetadataV1 {
  type: 'BROWSER_FRAME';
  sessionId: string;
  frameId: string;
  sequence: number;
  timestamp: number;
  width: typeof FRAME_WIDTH;
  height: typeof FRAME_HEIGHT;
  mimeType: typeof FRAME_MIME_TYPE;
  byteLength: number;
}

export interface SessionViewerFrame extends ViewerFrame {
  metadata: BrowserFrameMetadataV1;
}

export type SessionFrameTransportEvent =
  | { type: 'CONNECTED' }
  | { type: 'FRAME_RECEIVED'; frame: SessionViewerFrame }
  | { type: 'DISCONNECTED'; close: FrameConnectionClose }
  | {
      type: 'SAFE_ERROR';
      category: 'PROTOCOL' | 'UNSUPPORTED_FRAME' | 'CONNECTION';
      message: string;
    };

export type SessionFrameTransportListener = (
  event: SessionFrameTransportEvent
) => void;

export interface SessionFrameTransport {
  subscribe(listener: SessionFrameTransportListener): () => void;
  connect(): void;
  disconnect(): void;
}

interface WebSocketLike {
  binaryType: BinaryType;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: Event) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  close(code?: number, reason?: string): void;
}

export type WebSocketFactory = (
  url: string,
  protocol: string
) => WebSocketLike;

export interface ObjectUrlFactory {
  create(blob: Blob): string;
  revoke(url: string): void;
}

export interface SessionFrameTransportOptions {
  webSocketUrl: string;
  sessionId: string;
  protocol?: typeof FRAME_SUBPROTOCOL;
  webSocketFactory?: WebSocketFactory;
  objectUrlFactory?: ObjectUrlFactory;
  initialSequence?: number;
}

interface PendingFrame {
  metadata: BrowserFrameMetadataV1;
  ignored: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function protocolError(message: string): never {
  throw new Error(message);
}

export function validateFrameMetadata(
  value: unknown,
  expectedSessionId: string
): BrowserFrameMetadataV1 {
  if (!isRecord(value) || value.type !== 'BROWSER_FRAME') {
    return protocolError('화면 데이터 순서를 확인할 수 없습니다.');
  }
  if (value.sessionId !== expectedSessionId) {
    return protocolError('현재 세션과 다른 화면 데이터가 수신되었습니다.');
  }
  if (typeof value.frameId !== 'string' || !FRAME_ID_PATTERN.test(value.frameId)) {
    return protocolError('화면 식별 정보를 확인할 수 없습니다.');
  }
  if (!Number.isSafeInteger(value.sequence) || Number(value.sequence) < 1) {
    return protocolError('화면 순서 정보를 확인할 수 없습니다.');
  }
  if (
    !Number.isSafeInteger(value.timestamp) ||
    Number(value.timestamp) < MIN_UNIX_EPOCH_MILLISECONDS
  ) {
    return protocolError('화면 시각 정보를 확인할 수 없습니다.');
  }
  if (value.width !== FRAME_WIDTH || value.height !== FRAME_HEIGHT) {
    return protocolError('지원하지 않는 화면 해상도입니다.');
  }
  if (value.mimeType !== FRAME_MIME_TYPE) {
    return protocolError('지원하지 않는 화면 형식입니다.');
  }
  if (
    !Number.isSafeInteger(value.byteLength) ||
    Number(value.byteLength) < 1 ||
    Number(value.byteLength) > MAX_FRAME_BYTE_LENGTH
  ) {
    return protocolError('지원하지 않는 화면 크기입니다.');
  }

  return {
    type: 'BROWSER_FRAME',
    sessionId: expectedSessionId,
    frameId: value.frameId,
    sequence: Number(value.sequence),
    timestamp: Number(value.timestamp),
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    mimeType: FRAME_MIME_TYPE,
    byteLength: Number(value.byteLength)
  };
}

const defaultObjectUrlFactory: ObjectUrlFactory = {
  create: (blob) => URL.createObjectURL(blob),
  revoke: (url) => URL.revokeObjectURL(url)
};

export function createSessionFrameTransport(
  options: SessionFrameTransportOptions
): SessionFrameTransport {
  const protocol = options.protocol ?? FRAME_SUBPROTOCOL;
  const socketFactory =
    options.webSocketFactory ?? ((url, selectedProtocol) => new WebSocket(url, selectedProtocol));
  const objectUrls = options.objectUrlFactory ?? defaultObjectUrlFactory;
  const listeners = new Set<SessionFrameTransportListener>();
  const initialSequence = options.initialSequence ?? 0;

  if (!Number.isSafeInteger(initialSequence) || initialSequence < 0) {
    throw new Error('마지막 화면 순서는 0 이상의 안전한 정수여야 합니다.');
  }

  let socket: WebSocketLike | null = null;
  let active = false;
  let pending: PendingFrame | null = null;
  let latestSequence = initialSequence;
  let currentObjectUrl: string | null = null;

  const emit = (event: SessionFrameTransportEvent) => {
    if (!active) return;
    listeners.forEach((listener) => listener(event));
  };

  const revokeCurrentObjectUrl = () => {
    const url = currentObjectUrl;
    currentObjectUrl = null;
    if (url !== null) objectUrls.revoke(url);
  };

  const detachSocket = () => {
    if (!socket) return;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
  };

  const notifyDisconnected = (
    close: FrameConnectionClose,
    closeSocket = false
  ) => {
    if (!active) return;

    const closingSocket = socket;
    active = false;
    pending = null;
    detachSocket();
    socket = null;
    revokeCurrentObjectUrl();

    if (closeSocket) closingSocket?.close();
    listeners.forEach((listener) => listener({ type: 'DISCONNECTED', close }));
  };

  const fail = (
    category: 'PROTOCOL' | 'UNSUPPORTED_FRAME' | 'CONNECTION',
    message: string
  ) => {
    emit({ type: 'SAFE_ERROR', category, message });
    active = false;
    pending = null;
    detachSocket();
    socket?.close(1002, 'frame protocol error');
    socket = null;
    revokeCurrentObjectUrl();
  };

  const handleText = (rawText: string) => {
    if (pending !== null) {
      fail('PROTOCOL', '화면 데이터 순서가 올바르지 않습니다.');
      return;
    }

    let rawMetadata: unknown;
    try {
      rawMetadata = JSON.parse(rawText);
    } catch {
      fail('PROTOCOL', '화면 정보를 해석할 수 없습니다.');
      return;
    }

    try {
      const metadata = validateFrameMetadata(rawMetadata, options.sessionId);
      pending = {
        metadata,
        ignored: metadata.sequence <= latestSequence
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '화면 정보를 확인할 수 없습니다.';
      const unsupported = message.includes('지원하지 않는');
      fail(unsupported ? 'UNSUPPORTED_FRAME' : 'PROTOCOL', message);
    }
  };

  const handleBinary = (bytes: ArrayBuffer) => {
    const frame = pending;
    pending = null;
    if (!frame) {
      fail('PROTOCOL', '화면 정보보다 이미지가 먼저 수신되었습니다.');
      return;
    }
    if (bytes.byteLength !== frame.metadata.byteLength) {
      fail('PROTOCOL', '화면 이미지 크기가 정보와 일치하지 않습니다.');
      return;
    }
    if (frame.ignored) return;

    let nextObjectUrl: string | null = null;
    try {
      const blob = new Blob([bytes], { type: frame.metadata.mimeType });
      nextObjectUrl = objectUrls.create(blob);
      const previousObjectUrl = currentObjectUrl;
      currentObjectUrl = nextObjectUrl;
      latestSequence = frame.metadata.sequence;

      emit({
        type: 'FRAME_RECEIVED',
        frame: {
          metadata: frame.metadata,
          imageSrc: nextObjectUrl
        }
      });

      if (previousObjectUrl !== null && previousObjectUrl !== nextObjectUrl) {
        objectUrls.revoke(previousObjectUrl);
      }
    } catch {
      if (nextObjectUrl !== null && nextObjectUrl !== currentObjectUrl) {
        objectUrls.revoke(nextObjectUrl);
      }
      fail('UNSUPPORTED_FRAME', '화면 이미지를 준비하지 못했습니다.');
    }
  };

  return {
    subscribe(listener) {
      let subscribed = true;
      const guardedListener: SessionFrameTransportListener = (event) => {
        if (subscribed) listener(event);
      };
      listeners.add(guardedListener);
      return () => {
        subscribed = false;
        listeners.delete(guardedListener);
      };
    },

    connect() {
      if (active || socket !== null) {
        throw new Error('화면 연결이 이미 시작되었습니다.');
      }
      active = true;
      pending = null;

      try {
        socket = socketFactory(options.webSocketUrl, protocol);
        socket.binaryType = 'arraybuffer';
        socket.onopen = () => emit({ type: 'CONNECTED' });
        socket.onmessage = (event) => {
          if (!active) return;
          if (typeof event.data === 'string') {
            handleText(event.data);
          } else if (event.data instanceof ArrayBuffer) {
            handleBinary(event.data);
          } else {
            fail('PROTOCOL', '지원하지 않는 WebSocket 메시지입니다.');
          }
        };
        socket.onerror = () => {
          notifyDisconnected({ code: 1006, wasClean: false }, true);
        };
        socket.onclose = (event) => {
          const code =
            Number.isSafeInteger(event.code) && event.code >= 1000 && event.code <= 4999
              ? event.code
              : 1005;
          notifyDisconnected({ code, wasClean: event.wasClean === true });
        };
      } catch {
        notifyDisconnected({ code: 1006, wasClean: false }, true);
      }
    },

    disconnect() {
      if (!active && socket === null && currentObjectUrl === null) return;
      active = false;
      pending = null;
      detachSocket();
      socket?.close(1000, 'client disconnect');
      socket = null;
      revokeCurrentObjectUrl();
    }
  };
}
