import { describe, expect, it, vi } from 'vitest';

import {
  SessionSecureInputClient,
  SessionSecureInputClientError,
  type CompleteSessionSecureInputRequest
} from './session-secure-input-client';

const SESSION_ID = 'session-001';
const SECURE_REQUEST_ID = 'secure-request-001';
const REQUEST: CompleteSessionSecureInputRequest = {
  requestId: 'completion-request-001',
  expectedFrameId: 'frame-001',
  expectedSequence: 7
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function successBody() {
  return {
    success: true,
    data: {
      sessionId: SESSION_ID,
      requestId: REQUEST.requestId,
      secureRequestId: SECURE_REQUEST_ID,
      status: 'COMPLETION_ACCEPTED',
      message: '보안 입력 완료 여부를 확인하고 있습니다.'
    },
    errorCode: null,
    message: '요청을 접수했습니다.'
  };
}

describe('SessionSecureInputClient', () => {
  it('보안 값 없이 정확한 3개 필드만 완료 endpoint로 전송한다', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(successBody()));
    const client = new SessionSecureInputClient({
      baseUrl: 'http://127.0.0.1:8080',
      fetchImpl
    });

    await expect(
      client.complete({
        sessionId: SESSION_ID,
        secureRequestId: SECURE_REQUEST_ID,
        request: REQUEST
      })
    ).resolves.toMatchObject({ status: 'COMPLETION_ACCEPTED' });

    const [url, init] = fetchImpl.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(
      `http://127.0.0.1:8080/api/v1/sessions/${SESSION_ID}/secure-inputs/${SECURE_REQUEST_ID}/complete`
    );
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual(REQUEST);
    expect(Object.keys(JSON.parse(String(init.body))).sort()).toEqual([
      'expectedFrameId',
      'expectedSequence',
      'requestId'
    ]);
  });

  it('보안 값이나 알 수 없는 필드가 섞인 요청은 fetch 전에 차단한다', async () => {
    const fetchImpl = vi.fn();
    const client = new SessionSecureInputClient({ fetchImpl });
    const unsafeRequest = { ...REQUEST, unexpectedField: 'not-transmitted' };

    await expect(
      client.complete({
        sessionId: SESSION_ID,
        secureRequestId: SECURE_REQUEST_ID,
        request: unsafeRequest as CompleteSessionSecureInputRequest
      })
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('stale 응답은 안전한 오류 코드와 고정 문장으로 변환한다', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          success: false,
          data: null,
          errorCode: 'SECURE_409_STALE_FRAME',
          message: 'internal-sensitive-detail'
        },
        409
      )
    );
    const client = new SessionSecureInputClient({ fetchImpl });

    const error = await client
      .complete({
        sessionId: SESSION_ID,
        secureRequestId: SECURE_REQUEST_ID,
        request: REQUEST
      })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(SessionSecureInputClientError);
    expect(error).toMatchObject({ code: 'STALE_FRAME' });
    expect((error as Error).message).not.toContain('internal-sensitive-detail');
  });

  it('session·request identity가 다른 성공 응답을 fail-closed 처리한다', async () => {
    const body = successBody();
    body.data.secureRequestId = 'another-request';
    const client = new SessionSecureInputClient({
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse(body))
    });

    await expect(
      client.complete({
        sessionId: SESSION_ID,
        secureRequestId: SECURE_REQUEST_ID,
        request: REQUEST
      })
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it.each([
    ['SECURE_409_DUPLICATE_REQUEST', 'DUPLICATE_REQUEST'],
    ['SECURE_409_COMPLETION_BUSY', 'COMPLETION_BUSY'],
    ['SECURE_409_REQUEST_MISMATCH', 'SECURE_REQUEST_MISMATCH']
  ])('%s conflict를 %s 안전 오류로 구분하고 retry하지 않는다', async (backendCode, code) => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ success: false, data: null, errorCode: backendCode, message: 'detail' }, 409)
    );
    const client = new SessionSecureInputClient({ fetchImpl });
    await expect(
      client.complete({ sessionId: SESSION_ID, secureRequestId: SECURE_REQUEST_ID, request: REQUEST })
    ).rejects.toMatchObject({ code });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('malformed JSON과 unknown response field를 거부한다', async () => {
    const malformed = new SessionSecureInputClient({
      fetchImpl: vi.fn().mockResolvedValue(
        new Response('{', { status: 200, headers: { 'Content-Type': 'application/json' } })
      )
    });
    await expect(
      malformed.complete({ sessionId: SESSION_ID, secureRequestId: SECURE_REQUEST_ID, request: REQUEST })
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });

    const body = successBody();
    const unknown = new SessionSecureInputClient({
      fetchImpl: vi.fn().mockResolvedValue(
        jsonResponse({ ...body, data: { ...body.data, unexpected: true } })
      )
    });
    await expect(
      unknown.complete({ sessionId: SESSION_ID, secureRequestId: SECURE_REQUEST_ID, request: REQUEST })
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });

    const missing = successBody();
    const { message: _omitted, ...missingData } = missing.data;
    const missingField = new SessionSecureInputClient({
      fetchImpl: vi.fn().mockResolvedValue(jsonResponse({ ...missing, data: missingData }))
    });
    await expect(
      missingField.complete({ sessionId: SESSION_ID, secureRequestId: SECURE_REQUEST_ID, request: REQUEST })
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('caller abort를 구분하고 자동 재시도하지 않는다', async () => {
    const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      })
    );
    const client = new SessionSecureInputClient({ fetchImpl });
    const controller = new AbortController();
    const promise = client.complete({
      sessionId: SESSION_ID,
      secureRequestId: SECURE_REQUEST_ID,
      request: REQUEST,
      signal: controller.signal
    });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ code: 'REQUEST_ABORTED' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('timeout을 구분하고 자동 재시도하지 않는다', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        })
      );
      const client = new SessionSecureInputClient({ fetchImpl, timeoutMs: 50 });
      const promise = client.complete({
        sessionId: SESSION_ID,
        secureRequestId: SECURE_REQUEST_ID,
        request: REQUEST
      });
      const rejection = expect(promise).rejects.toMatchObject({
        code: 'REQUEST_TIMEOUT'
      });
      await vi.advanceTimersByTimeAsync(50);
      await rejection;
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
