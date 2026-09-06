import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  FRAME_SUBPROTOCOL,
  SessionRestClient,
  SessionRestError,
  createFrameWebSocketUrl,
  resolveBackendBaseUrl
} from './session-rest-client';

const sessionId = 'session-123';
const validData = {
  sessionId,
  status: 'SESSION_CREATED',
  frameWebSocketPath: `/ws/sessions/${sessionId}/frames`,
  frameProtocol: FRAME_SUBPROTOCOL
};

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe('SessionRestClient', () => {
  it('확정 request를 POST하고 정상 envelope를 안전한 session으로 변환한다', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ success: true, data: validData }, { status: 201 })
    );
    const client = new SessionRestClient({ fetchImpl });

    const result = await client.createSession({
      userRequest: '계좌 선택 화면을 확인합니다.',
      siteId: 'demo-bank',
      initialPath: '/transfer/accounts'
    });

    const [url, request] = fetchImpl.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('http://127.0.0.1:8080/api/v1/sessions');
    expect(request.method).toBe('POST');
    expect(JSON.parse(String(request.body))).toEqual({
      userRequest: '계좌 선택 화면을 확인합니다.',
      siteId: 'demo-bank',
      initialPath: '/transfer/accounts'
    });
    expect(result).toEqual({
      ...validData,
      frameWebSocketUrl: `ws://127.0.0.1:8080/ws/sessions/${sessionId}/frames`
    });
  });

  it('조회와 취소 endpoint에 검증된 sessionId만 사용한다', async () => {
    const fetchImpl = vi.fn().mockImplementation(() =>
      Promise.resolve(jsonResponse({ success: true, data: validData }))
    );
    const client = new SessionRestClient({ fetchImpl });

    await client.getSession(sessionId);
    await client.cancelSession(sessionId);

    expect(String(fetchImpl.mock.calls[0][0])).toContain(`/api/v1/sessions/${sessionId}`);
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ method: 'GET' });
    expect(String(fetchImpl.mock.calls[1][0])).toContain(
      `/api/v1/sessions/${sessionId}/cancel`
    );
    expect(fetchImpl.mock.calls[1][1]).toMatchObject({ method: 'POST' });
  });

  it.each([
    ['HTTP 오류', new Response('secret backend error', { status: 500 })],
    [
      '예상과 다른 성공 status',
      jsonResponse({ success: true, data: validData }, { status: 202 })
    ],
    [
      'Content-Type 오류',
      new Response('not json', { status: 200, headers: { 'Content-Type': 'text/plain' } })
    ],
    [
      'malformed JSON',
      new Response('{bad', {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    ],
    ['success=false', jsonResponse({ success: false, data: null, message: 'raw secret' })]
  ])('%s를 안전한 오류로 변환하고 raw 응답을 노출하지 않는다', async (_, response) => {
    const client = new SessionRestClient({ fetchImpl: vi.fn().mockResolvedValue(response) });
    const error = await client.getSession(sessionId).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(SessionRestError);
    expect(String((error as Error).message)).not.toMatch(/secret|raw|\{bad/);
  });

  it.each([
    ['invalid sessionId', { ...validData, sessionId: 'bad/session' }],
    ['invalid status', { ...validData, status: 'UNKNOWN' }],
    ['다른 session frame path', { ...validData, frameWebSocketPath: '/ws/sessions/other/frames' }],
    ['절대 frame URL', { ...validData, frameWebSocketPath: 'https://evil.test/frames' }],
    ['query frame path', { ...validData, frameWebSocketPath: `${validData.frameWebSocketPath}?x=1` }],
    ['path traversal', { ...validData, frameWebSocketPath: '/ws/../frames' }],
    ['invalid protocol', { ...validData, frameProtocol: 'wrong.protocol' }]
  ])('%s 응답을 거부한다', async (_, data) => {
    const client = new SessionRestClient({
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse({ success: true, data }))
    });
    await expect(client.getSession(sessionId)).rejects.toBeInstanceOf(SessionRestError);
  });

  it('요청 timeout에서 AbortController를 중단한다', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      })
    );
    const client = new SessionRestClient({ fetchImpl, timeoutMs: 100 });
    const request = expect(client.getSession(sessionId)).rejects.toMatchObject({
      code: 'REQUEST_TIMEOUT'
    });
    await vi.advanceTimersByTimeAsync(100);

    await request;
  });

  it('호출자가 요청을 abort할 수 있다', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      })
    );
    const client = new SessionRestClient({ fetchImpl });
    const request = client.getSession(sessionId, { signal: controller.signal });
    controller.abort();

    await expect(request).rejects.toMatchObject({ code: 'REQUEST_ABORTED' });
  });
});

describe('Backend 및 WebSocket URL 검증', () => {
  it('https origin을 같은 host의 wss URL로 변환한다', () => {
    expect(
      createFrameWebSocketUrl(
        resolveBackendBaseUrl('https://backend.example.test:8443'),
        `/ws/sessions/${sessionId}/frames`
      )
    ).toBe(`wss://backend.example.test:8443/ws/sessions/${sessionId}/frames`);
  });

  it.each([
    'ftp://127.0.0.1:8080',
    'http://user@127.0.0.1:8080',
    'http://127.0.0.1:8080/api',
    'http://127.0.0.1:8080?token=secret',
    'not a url'
  ])('위험하거나 잘못된 Backend base URL을 거부한다: %s', (baseUrl) => {
    expect(() => resolveBackendBaseUrl(baseUrl)).toThrow(SessionRestError);
  });
});
