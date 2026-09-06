export interface StompSubscription {
  disconnect(): void;
}

export interface ConversationStompClient {
  subscribe(options: {
    webSocketUrl: string;
    destination: string;
    onConnected: () => void;
    onMessage: (body: string) => void;
    onDisconnected: (willReconnect: boolean) => void;
    onError: () => void;
  }): StompSubscription;
}

type WebSocketFactory = (url: string, protocols: string[]) => WebSocket;

function encodeFrame(command: string, headers: Record<string, string>, body = '') {
  const lines = [command, ...Object.entries(headers).map(([key, value]) => `${key}:${value}`), '', body];
  return `${lines.join('\n')}\0`;
}

interface ParsedStompFrame {
  command: string;
  headers: Record<string, string>;
  body: string;
}

function utf8BodyEnd(value: string, expectedBytes: number) {
  if (expectedBytes === 0) return 0;
  let bytes = 0;
  let codeUnits = 0;
  const encoder = new TextEncoder();
  for (const character of value) {
    const next = encoder.encode(character).byteLength;
    if (bytes + next > expectedBytes) throw new Error('INVALID_CONTENT_LENGTH');
    bytes += next;
    codeUnits += character.length;
    if (bytes === expectedBytes) return codeUnits;
  }
  return null;
}

class StompFrameDecoder {
  private buffer = '';

  push(chunk: string): ParsedStompFrame[] {
    this.buffer += chunk;
    const frames: ParsedStompFrame[] = [];
    while (true) {
      this.buffer = this.buffer.replace(/^(?:\r?\n)+/u, '');
      if (!this.buffer) break;
      const lf = this.buffer.indexOf('\n\n');
      const crlf = this.buffer.indexOf('\r\n\r\n');
      const headerEnd = lf < 0 ? crlf : crlf < 0 ? lf : Math.min(lf, crlf);
      if (headerEnd < 0) break;
      const delimiterLength = this.buffer.startsWith('\r\n\r\n', headerEnd) ? 4 : 2;
      const lines = this.buffer.slice(0, headerEnd).split(/\r?\n/u);
      const command = lines.shift();
      if (!command || !/^[A-Z]+$/u.test(command)) throw new Error('INVALID_STOMP_COMMAND');
      const headers: Record<string, string> = {};
      for (const line of lines) {
        const separator = line.indexOf(':');
        if (separator <= 0) throw new Error('INVALID_STOMP_HEADER');
        const key = line.slice(0, separator);
        if (Object.prototype.hasOwnProperty.call(headers, key)) throw new Error('DUPLICATE_STOMP_HEADER');
        headers[key] = line.slice(separator + 1);
      }
      const bodyStart = headerEnd + delimiterLength;
      let bodyEnd: number;
      const declaredLength = headers['content-length'];
      if (declaredLength !== undefined) {
        if (!/^\d+$/u.test(declaredLength)) throw new Error('INVALID_CONTENT_LENGTH');
        const relativeEnd = utf8BodyEnd(this.buffer.slice(bodyStart), Number(declaredLength));
        if (relativeEnd === null) break;
        bodyEnd = bodyStart + relativeEnd;
        if (this.buffer.length <= bodyEnd) break;
        if (this.buffer[bodyEnd] !== '\0') throw new Error('MISSING_STOMP_TERMINATOR');
      } else {
        bodyEnd = this.buffer.indexOf('\0', bodyStart);
        if (bodyEnd < 0) break;
      }
      frames.push({ command, headers, body: this.buffer.slice(bodyStart, bodyEnd) });
      this.buffer = this.buffer.slice(bodyEnd + 1);
    }
    return frames;
  }

  clear() {
    this.buffer = '';
  }
}

export function createNativeConversationStompClient(
  socketFactory: WebSocketFactory = (url, protocols) => new WebSocket(url, protocols),
  reconnectDelayMs = 2_000
): ConversationStompClient {
  return {
    subscribe(options) {
      let socket: WebSocket | null = null;
      let stopped = false;
      let reconnectTimer: number | null = null;
      let attempt = 0;
      const decoder = new StompFrameDecoder();

      const failClosed = () => {
        if (stopped) return;
        stopped = true;
        decoder.clear();
        if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
        options.onError();
        socket?.close(1002, 'invalid STOMP frame');
        socket = null;
      };

      const open = () => {
        if (stopped) return;
        reconnectTimer = null;
        const currentSocket = socketFactory(options.webSocketUrl, ['v12.stomp', 'v11.stomp', 'v10.stomp']);
        socket = currentSocket;
        let subscribed = false;
        currentSocket.addEventListener('open', () => {
          currentSocket.send(encodeFrame('CONNECT', {
            'accept-version': '1.2,1.1,1.0',
            'heart-beat': '0,0',
            host: window.location.host
          }));
        });
        currentSocket.addEventListener('message', (event) => {
          if (typeof event.data !== 'string') {
            failClosed();
            return;
          }
          let frames: ParsedStompFrame[];
          try {
            frames = decoder.push(event.data);
          } catch {
            failClosed();
            return;
          }
          for (const parsed of frames) {
            if (parsed.command === 'CONNECTED' && !subscribed) {
              subscribed = true;
              attempt += 1;
              currentSocket.send(encodeFrame('SUBSCRIBE', {
                id: `conversation-${attempt}`,
                destination: options.destination,
                ack: 'auto'
              }));
              options.onConnected();
            } else if (parsed.command === 'MESSAGE') {
              options.onMessage(parsed.body);
            } else if (parsed.command === 'ERROR') {
              failClosed();
              return;
            }
          }
        });
        currentSocket.addEventListener('error', failClosed);
        currentSocket.addEventListener('close', () => {
          if (socket !== currentSocket && socket !== null) return;
          socket = null;
          decoder.clear();
          const willReconnect = !stopped;
          options.onDisconnected(willReconnect);
          if (willReconnect && reconnectTimer === null) {
            reconnectTimer = window.setTimeout(open, reconnectDelayMs);
          }
        });
      };

      open();
      return {
        disconnect() {
          stopped = true;
          decoder.clear();
          if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
          reconnectTimer = null;
          if (socket?.readyState === 1) {
            socket.send(encodeFrame('DISCONNECT', { receipt: 'conversation-close' }));
          }
          socket?.close(1000, 'conversation closed');
          socket = null;
        }
      };
    }
  };
}

export function toConversationWebSocketUrl(httpBaseUrl: string) {
  const url = new URL(httpBaseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/ws';
  url.search = '';
  url.hash = '';
  return url.toString();
}
