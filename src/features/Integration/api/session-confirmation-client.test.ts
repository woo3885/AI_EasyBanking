import { describe, expect, it, vi } from 'vitest';

import {
  SessionConfirmationClient,
  SessionConfirmationClientError,
  type SubmitSessionConfirmationRequest
} from './session-confirmation-client';

const SESSION_ID = 'session-001';
const REQUEST: SubmitSessionConfirmationRequest = {
  requestId: 'confirm-request-001',
  confirmationId: 'confirm-001',
  approved: true,
  expectedFrameId: 'frm-001',
  expectedSequence: 7
};

function responseData(
  status: 'APPROVAL_ACCEPTED' | 'REJECTION_ACCEPTED' = 'APPROVAL_ACCEPTED'
) {
  return {
    sessionId: SESSION_ID,
    requestId: REQUEST.requestId,
    confirmationId: REQUEST.confirmationId,
    sourceFrameId: REQUEST.expectedFrameId,
    sourceFrameSequence: REQUEST.expectedSequence,
    status,
    message: '최종 확인 요청을 처리하고 있습니다.'
  };
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('SessionConfirmationClient', () => {
  it.each([
    ['APPROVE', 'confirm', true, 'APPROVAL_ACCEPTED'],
    ['REJECT', 'reject', false, 'REJECTION_ACCEPTED']
  ] as const)(
    '%s 요청을 정확한 endpoint와 금융정보 없는 payload로 한 번만 보낸다',
    async (action, path, approved, status) => {
      const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          `http://127.0.0.1:8080/api/v1/sessions/${SESSION_ID}/${path}`
        );
        expect(init?.method).toBe('POST');
        expect(JSON.parse(String(init?.body))).toEqual({
          ...REQUEST,
          approved
        });
        expect(String(init?.body)).not.toMatch(
          /summary|amount|product|password|otp/i
        );
        return jsonResponse({
          success: true,
          data: responseData(status),
          errorCode: null
        });
      });
      const client = new SessionConfirmationClient({ fetchImpl });

      const result = await client.submit({
        sessionId: SESSION_ID,
        action,
        request: { ...REQUEST, approved }
      });

      expect(result.status).toBe(status);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    }
  );

  it('action과 approved가 다르거나 request key가 추가되면 전송 전에 차단한다', async () => {
    const fetchImpl = vi.fn();
    const client = new SessionConfirmationClient({ fetchImpl });

    await expect(
      client.submit({
        sessionId: SESSION_ID,
        action: 'REJECT',
        request: REQUEST
      })
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    await expect(
      client.submit({
        sessionId: SESSION_ID,
        action: 'APPROVE',
        request: { ...REQUEST, summary: '금융정보' } as never
      })
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('응답의 session·request·confirmation·frame identity mismatch를 차단한다', async () => {
    const fields = [
      ['sessionId', 'session-other'],
      ['requestId', 'confirm-request-other'],
      ['confirmationId', 'confirm-other'],
      ['sourceFrameId', 'frm-other'],
      ['sourceFrameSequence', 8]
    ] as const;

    for (const [field, value] of fields) {
      const client = new SessionConfirmationClient({
        fetchImpl: async () =>
          jsonResponse({
            success: true,
            data: { ...responseData(), [field]: value },
            errorCode: null
          })
      });
      await expect(
        client.submit({ sessionId: SESSION_ID, action: 'APPROVE', request: REQUEST })
      ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    }
  });

  it('Backend 전용 오류를 안전한 오류로 매핑하고 raw body를 노출하지 않는다', async () => {
    const client = new SessionConfirmationClient({
      fetchImpl: async () =>
        jsonResponse(
          {
            success: false,
            data: null,
            errorCode: 'CONFIRMATION_STALE_FRAME',
            message: 'selector=#secret stack=internal'
          },
          409
        )
    });

    const error = await client
      .submit({ sessionId: SESSION_ID, action: 'APPROVE', request: REQUEST })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(SessionConfirmationClientError);
    expect(error).toMatchObject({ code: 'STALE_FRAME' });
    expect(String(error)).not.toContain('selector');
    expect(String(error)).not.toContain('stack');
  });

  it('timeout과 caller abort를 구분하고 자동 retry하지 않는다', async () => {
    const timeoutFetch = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        })
    );
    const timeoutClient = new SessionConfirmationClient({
      fetchImpl: timeoutFetch,
      timeoutMs: 5
    });
    await expect(
      timeoutClient.submit({
        sessionId: SESSION_ID,
        action: 'APPROVE',
        request: REQUEST
      })
    ).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT' });
    expect(timeoutFetch).toHaveBeenCalledTimes(1);

    const caller = new AbortController();
    const abortFetch = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        })
    );
    const abortClient = new SessionConfirmationClient({ fetchImpl: abortFetch });
    const pending = abortClient.submit({
      sessionId: SESSION_ID,
      action: 'APPROVE',
      request: REQUEST,
      signal: caller.signal
    });
    caller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'REQUEST_ABORTED' });
    expect(abortFetch).toHaveBeenCalledTimes(1);
  });

  it('malformed response와 예상하지 않은 status를 fail-closed한다', async () => {
    const client = new SessionConfirmationClient({
      fetchImpl: async () =>
        jsonResponse({
          success: true,
          data: { ...responseData(), status: 'COMPLETED' },
          errorCode: null
        })
    });
    await expect(
      client.submit({ sessionId: SESSION_ID, action: 'APPROVE', request: REQUEST })
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});
