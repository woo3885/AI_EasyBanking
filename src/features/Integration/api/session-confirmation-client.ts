import { resolveBackendBaseUrl } from './session-rest-client';

export const DEFAULT_CONFIRMATION_REQUEST_TIMEOUT_MS = 10_000;

const SAFE_ID_PATTERN = /^[A-Za-z0-9-]{1,128}$/;
const REQUEST_KEYS = [
  'approved',
  'confirmationId',
  'expectedFrameId',
  'expectedSequence',
  'requestId'
] as const;
const RESPONSE_KEYS = [
  'confirmationId',
  'message',
  'requestId',
  'sessionId',
  'sourceFrameId',
  'sourceFrameSequence',
  'status'
] as const;

export type SessionConfirmationAction = 'APPROVE' | 'REJECT';

export type SessionConfirmationErrorCode =
  | 'INVALID_REQUEST'
  | 'SESSION_NOT_FOUND'
  | 'CONFIRMATION_NOT_FOUND'
  | 'CONFIRMATION_ID_MISMATCH'
  | 'STALE_FRAME'
  | 'DUPLICATE_REQUEST'
  | 'REQUEST_IN_PROGRESS'
  | 'CONFIRMATION_EXPIRED'
  | 'WORKFLOW_CONFLICT'
  | 'TARGET_NOT_FOUND'
  | 'TARGET_DISABLED'
  | 'POLICY_MISMATCH'
  | 'ACTION_FAILED'
  | 'FRAME_CAPTURE_FAILED'
  | 'REQUEST_ABORTED'
  | 'REQUEST_TIMEOUT'
  | 'SERVER_ERROR'
  | 'INVALID_RESPONSE';

export interface SubmitSessionConfirmationRequest {
  requestId: string;
  confirmationId: string;
  approved: boolean;
  expectedFrameId: string;
  expectedSequence: number;
}

export interface SubmitSessionConfirmationResponse {
  sessionId: string;
  requestId: string;
  confirmationId: string;
  sourceFrameId: string;
  sourceFrameSequence: number;
  status: 'APPROVAL_ACCEPTED' | 'REJECTION_ACCEPTED';
  message: string;
}

export interface SubmitSessionConfirmationOptions {
  sessionId: string;
  action: SessionConfirmationAction;
  request: SubmitSessionConfirmationRequest;
  signal?: AbortSignal;
}

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export interface SessionConfirmationClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}

export class SessionConfirmationClientError extends Error {
  constructor(
    public readonly code: SessionConfirmationErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'SessionConfirmationClientError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[]
): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === expected.length &&
    keys.every((key, index) => key === expected[index]);
}

function safeMessage(code: SessionConfirmationErrorCode): string {
  const messages: Record<SessionConfirmationErrorCode, string> = {
    INVALID_REQUEST: '최종 확인 요청을 안전하게 확인하지 못했습니다.',
    SESSION_NOT_FOUND: '진행 중인 업무 세션을 찾을 수 없습니다.',
    CONFIRMATION_NOT_FOUND: '현재 최종 확인 요청을 찾을 수 없습니다.',
    CONFIRMATION_ID_MISMATCH: '최종 확인 화면이 변경되었습니다. 최신 상태를 확인해 주세요.',
    STALE_FRAME: '최종 확인 화면이 변경되었습니다. 최신 화면을 확인해 주세요.',
    DUPLICATE_REQUEST: '이미 처리한 최종 확인 요청입니다. 다음 상태를 기다려 주세요.',
    REQUEST_IN_PROGRESS: '다른 최종 확인 요청을 처리하고 있습니다.',
    CONFIRMATION_EXPIRED: '최종 확인 시간이 지났습니다. 최신 상태를 확인해 주세요.',
    WORKFLOW_CONFLICT: '현재 업무 상태에서는 최종 확인을 처리할 수 없습니다.',
    TARGET_NOT_FOUND: '최종 실행 대상을 안전하게 확인할 수 없습니다.',
    TARGET_DISABLED: '현재 최종 실행 대상을 사용할 수 없습니다.',
    POLICY_MISMATCH: '최종 실행 안전 상태가 변경되었습니다.',
    ACTION_FAILED: '최종 실행을 안전하게 완료하지 못했습니다.',
    FRAME_CAPTURE_FAILED: '실행 이후 안전한 화면을 확인하지 못했습니다.',
    REQUEST_ABORTED: '최종 확인 요청을 중단했습니다.',
    REQUEST_TIMEOUT: '최종 확인 요청 시간이 초과되었습니다. 연결 상태를 확인해 주세요.',
    SERVER_ERROR: '최종 확인 요청을 처리하지 못했습니다. 잠시 후 다시 확인해 주세요.',
    INVALID_RESPONSE: '최종 확인 처리 결과를 안전하게 확인하지 못했습니다.'
  };
  return messages[code];
}

function fail(code: SessionConfirmationErrorCode): never {
  throw new SessionConfirmationClientError(code, safeMessage(code));
}

function validateId(value: unknown): string {
  if (typeof value !== 'string' || !SAFE_ID_PATTERN.test(value)) {
    return fail('INVALID_REQUEST');
  }
  return value;
}

function validateRequest(
  value: SubmitSessionConfirmationRequest,
  action: SessionConfirmationAction
): SubmitSessionConfirmationRequest {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, REQUEST_KEYS) ||
    value.approved !== (action === 'APPROVE') ||
    !Number.isSafeInteger(value.expectedSequence) ||
    value.expectedSequence < 1
  ) {
    return fail('INVALID_REQUEST');
  }
  return {
    requestId: validateId(value.requestId),
    confirmationId: validateId(value.confirmationId),
    approved: value.approved,
    expectedFrameId: validateId(value.expectedFrameId),
    expectedSequence: value.expectedSequence
  };
}

const BACKEND_ERROR_CODES: Readonly<
  Record<string, SessionConfirmationErrorCode>
> = {
  CONFIRMATION_NOT_FOUND: 'CONFIRMATION_NOT_FOUND',
  CONFIRMATION_ID_MISMATCH: 'CONFIRMATION_ID_MISMATCH',
  CONFIRMATION_STALE_FRAME: 'STALE_FRAME',
  CONFIRMATION_DUPLICATE_REQUEST: 'DUPLICATE_REQUEST',
  CONFIRMATION_REQUEST_IN_PROGRESS: 'REQUEST_IN_PROGRESS',
  CONFIRMATION_EXPIRED: 'CONFIRMATION_EXPIRED',
  CONFIRMATION_WORKFLOW_CONFLICT: 'WORKFLOW_CONFLICT',
  CONFIRMATION_TARGET_NOT_FOUND: 'TARGET_NOT_FOUND',
  CONFIRMATION_TARGET_DISABLED: 'TARGET_DISABLED',
  CONFIRMATION_POLICY_MISMATCH: 'POLICY_MISMATCH',
  CONFIRMATION_ACTION_FAILED: 'ACTION_FAILED',
  CONFIRMATION_FRAME_CAPTURE_FAILED: 'FRAME_CAPTURE_FAILED'
};

async function backendErrorCode(
  response: Response
): Promise<SessionConfirmationErrorCode> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.toLowerCase().includes('application/json')) {
    try {
      const body: unknown = await response.json();
      if (isRecord(body) && typeof body.errorCode === 'string') {
        const mapped = BACKEND_ERROR_CODES[body.errorCode];
        if (mapped) return mapped;
      }
    } catch {
      // Backend 원문은 사용자에게 노출하지 않는다.
    }
  }
  if (response.status === 404) return 'SESSION_NOT_FOUND';
  if (response.status === 400) return 'INVALID_REQUEST';
  return 'SERVER_ERROR';
}

function validateResponse(
  value: unknown,
  expected: {
    sessionId: string;
    request: SubmitSessionConfirmationRequest;
    action: SessionConfirmationAction;
  }
): SubmitSessionConfirmationResponse {
  if (
    !isRecord(value) ||
    value.success !== true ||
    value.errorCode !== null ||
    !isRecord(value.data) ||
    !hasExactKeys(value.data, RESPONSE_KEYS)
  ) {
    return fail('INVALID_RESPONSE');
  }
  const data = value.data;
  const expectedStatus = expected.action === 'APPROVE'
    ? 'APPROVAL_ACCEPTED'
    : 'REJECTION_ACCEPTED';
  if (
    data.sessionId !== expected.sessionId ||
    data.requestId !== expected.request.requestId ||
    data.confirmationId !== expected.request.confirmationId ||
    data.sourceFrameId !== expected.request.expectedFrameId ||
    data.sourceFrameSequence !== expected.request.expectedSequence ||
    data.status !== expectedStatus ||
    typeof data.message !== 'string' ||
    data.message.trim() === '' ||
    Array.from(data.message).length > 500
  ) {
    return fail('INVALID_RESPONSE');
  }
  return data as unknown as SubmitSessionConfirmationResponse;
}

export class SessionConfirmationClient {
  private readonly backendBaseUrl: URL;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;

  constructor(options: SessionConfirmationClientOptions = {}) {
    this.backendBaseUrl = resolveBackendBaseUrl(
      options.baseUrl ?? import.meta.env.VITE_BACKEND_BASE_URL
    );
    this.timeoutMs = options.timeoutMs ?? DEFAULT_CONFIRMATION_REQUEST_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs <= 0) {
      fail('INVALID_REQUEST');
    }
  }

  async submit({
    sessionId: rawSessionId,
    action,
    request: rawRequest,
    signal
  }: SubmitSessionConfirmationOptions): Promise<SubmitSessionConfirmationResponse> {
    const sessionId = validateId(rawSessionId);
    const request = validateRequest(rawRequest, action);
    const controller = new AbortController();
    let timedOut = false;
    const abortFromCaller = () => controller.abort();
    signal?.addEventListener('abort', abortFromCaller, { once: true });
    if (signal?.aborted) controller.abort();
    const timeoutId = globalThis.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);

    try {
      const response = await this.fetchImpl(
        new URL(
          `/api/v1/sessions/${sessionId}/${
            action === 'APPROVE' ? 'confirm' : 'reject'
          }`,
          this.backendBaseUrl
        ),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify(request),
          signal: controller.signal
        }
      );
      if (!response.ok || response.status !== 200) {
        fail(await backendErrorCode(response));
      }
      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.toLowerCase().includes('application/json')) {
        fail('INVALID_RESPONSE');
      }
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        fail('INVALID_RESPONSE');
      }
      return validateResponse(body, { sessionId, request, action });
    } catch (error) {
      if (error instanceof SessionConfirmationClientError) throw error;
      if (timedOut) fail('REQUEST_TIMEOUT');
      if (controller.signal.aborted) fail('REQUEST_ABORTED');
      return fail('SERVER_ERROR');
    } finally {
      globalThis.clearTimeout(timeoutId);
      signal?.removeEventListener('abort', abortFromCaller);
    }
  }
}

export const defaultSessionConfirmationClient =
  new SessionConfirmationClient();
