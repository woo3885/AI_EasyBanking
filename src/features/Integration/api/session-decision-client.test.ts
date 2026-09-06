import { describe, expect, it, vi } from 'vitest';

import {
  SessionDecisionClient,
  SessionDecisionClientError,
  type SessionDecisionRequest
} from './session-decision-client';

const SESSION_ID = 'session-001';
const REQUEST: SessionDecisionRequest = {
  requestId: 'req-001',
  decisionId: 'dec-001',
  decisionType: 'TERMS_AGREEMENT',
  selectedOptionIds: ['term-002', 'term-001'],
  expectedFrameId: 'frm-001',
  expectedSequence: 7
};

function successResponse(overrides: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      success: true,
      data: {
        sessionId: SESSION_ID,
        userRequest: '예금 가입을 진행해 주세요.',
        status: 'AI_EXECUTING',
        createdAt: '2026-08-20T10:00:00Z',
        updatedAt: '2026-08-20T10:00:01Z',
        frameWebSocketPath: `/ws/sessions/${SESSION_ID}/frames`,
        frameProtocol: 'ddd.browser-frame.v1',
        ...overrides
      },
      errorCode: null,
      message: null
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

function createClient(fetchImpl: typeof fetch, timeoutMs = 1_000) {
  return new SessionDecisionClient({
    baseUrl: 'http://127.0.0.1:8080',
    timeoutMs,
    fetchImpl
  });
}

describe('SessionDecisionClient', () => {
  it('정확한 endpoint와 DTO로 선택 ID 순서를 보존해 한 번만 제출한다', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(successResponse());
    const client = createClient(fetchImpl);

    await expect(
      client.submitDecision({ sessionId: SESSION_ID, request: REQUEST })
    ).resolves.toEqual({ sessionId: SESSION_ID, status: 'AI_EXECUTING' });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe(
      `http://127.0.0.1:8080/api/v1/sessions/${SESSION_ID}/decisions`
    );
    expect(init).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(init?.body))).toEqual(REQUEST);
  });

  it.each([
    [400, 'COMMON_400', 'INVALID_REQUEST'],
    [404, 'SESSION_404', 'SESSION_NOT_FOUND'],
    [409, 'DECISION_409_RESUME_FAILED', 'DECISION_CONFLICT'],
    [500, 'COMMON_500', 'SERVER_ERROR']
  ] as const)('Backend %s 오류를 %s로 안전하게 매핑한다', async (status, backendCode, expectedCode) => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          data: null,
          errorCode: backendCode,
          message: `내부 식별자 ${SESSION_ID}`
        }),
        { status, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const error = await createClient(fetchImpl)
      .submitDecision({ sessionId: SESSION_ID, request: REQUEST })
      .catch((value: unknown) => value);
    expect(error).toBeInstanceOf(SessionDecisionClientError);
    expect(error).toMatchObject({ code: expectedCode });
    expect(String((error as Error).message)).not.toContain(SESSION_ID);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('timeout 시 요청을 중단하고 retry하지 않는다', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn((_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError'))
        );
      })
    );
    const promise = createClient(fetchImpl, 50).submitDecision({
      sessionId: SESSION_ID,
      request: REQUEST
    });
    const rejection = expect(promise).rejects.toMatchObject({
      code: 'REQUEST_TIMEOUT'
    });
    await vi.advanceTimersByTimeAsync(50);
    await rejection;
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('호출자 abort를 안전한 오류로 변환한다', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn((_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError'))
        );
      })
    );
    const promise = createClient(fetchImpl).submitDecision({
      sessionId: SESSION_ID,
      request: REQUEST,
      signal: controller.signal
    });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ code: 'REQUEST_ABORTED' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('응답 계약이 다르면 raw body 없이 INVALID_RESPONSE로 차단한다', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(successResponse({ frameProtocol: 'wrong-protocol' }));
    const error = await createClient(fetchImpl)
      .submitDecision({ sessionId: SESSION_ID, request: REQUEST })
      .catch((value: unknown) => value);
    expect(error).toMatchObject({ code: 'INVALID_RESPONSE' });
    expect((error as Error).message).not.toContain('wrong-protocol');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('유효하지 않은 선택 요청은 네트워크 호출 전에 차단한다', async () => {
    const fetchImpl = vi.fn();
    await expect(
      createClient(fetchImpl).submitDecision({
        sessionId: SESSION_ID,
        request: { ...REQUEST, selectedOptionIds: ['term-001', 'term-001'] }
      })
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
