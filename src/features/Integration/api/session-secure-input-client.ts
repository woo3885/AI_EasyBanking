import { resolveBackendBaseUrl } from './session-rest-client';

export const DEFAULT_SECURE_INPUT_REQUEST_TIMEOUT_MS = 10_000;

const SAFE_ID_PATTERN = /^[A-Za-z0-9-]{1,100}$/;
const REQUEST_KEYS = ['expectedFrameId', 'expectedSequence', 'requestId'] as const;
const RESPONSE_KEYS = [
  'message',
  'requestId',
  'secureRequestId',
  'sessionId',
  'status'
] as const;

export type SessionSecureInputErrorCode =
  | 'INVALID_REQUEST'
  | 'SESSION_NOT_FOUND'
  | 'SECURE_REQUEST_NOT_FOUND'
  | 'SECURE_REQUEST_MISMATCH'
  | 'STALE_FRAME'
  | 'DUPLICATE_REQUEST'
  | 'COMPLETION_BUSY'
  | 'MARKER_MISSING'
  | 'INPUT_STILL_ACTIVE'
  | 'SESSION_TERMINATED'
  | 'INVALID_STATUS'
  | 'COMPLETION_TIMEOUT'
  | 'SAFE_FRAME_FAILED'
  | 'REQUEST_ABORTED'
  | 'REQUEST_TIMEOUT'
  | 'SERVER_ERROR'
  | 'INVALID_RESPONSE';

export interface CompleteSessionSecureInputRequest {
  requestId: string;
  expectedFrameId: string;
  expectedSequence: number;
}

export interface CompleteSessionSecureInputResponse {
  sessionId: string;
  requestId: string;
  secureRequestId: string;
  status: 'COMPLETION_ACCEPTED';
  message: string;
}

export interface CompleteSessionSecureInputOptions {
  sessionId: string;
  secureRequestId: string;
  request: CompleteSessionSecureInputRequest;
  signal?: AbortSignal;
}

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export interface SessionSecureInputClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}

export class SessionSecureInputClientError extends Error {
  constructor(
    public readonly code: SessionSecureInputErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'SessionSecureInputClientError';
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
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

function safeMessage(code: SessionSecureInputErrorCode): string {
  const messages: Record<SessionSecureInputErrorCode, string> = {
    INVALID_REQUEST: '보안 입력 완료 요청을 안전하게 확인하지 못했습니다.',
    SESSION_NOT_FOUND: '진행 중인 업무 세션을 찾을 수 없습니다.',
    SECURE_REQUEST_NOT_FOUND: '현재 보안 입력 요청을 찾을 수 없습니다.',
    SECURE_REQUEST_MISMATCH: '보안 입력 화면이 변경되었습니다. 최신 화면을 확인해 주세요.',
    STALE_FRAME: '보안 입력 화면이 변경되었습니다. 최신 화면을 확인해 주세요.',
    DUPLICATE_REQUEST: '이미 처리한 완료 요청입니다. 다음 상태를 기다려 주세요.',
    COMPLETION_BUSY: '보안 입력 완료 여부를 확인하고 있습니다.',
    MARKER_MISSING: '입력 완료 표시를 확인할 수 없습니다. 다시 확인해 주세요.',
    INPUT_STILL_ACTIVE: '보안 입력이 아직 끝나지 않았습니다. 원격 화면을 확인해 주세요.',
    SESSION_TERMINATED: '종료된 업무에서는 완료 요청을 보낼 수 없습니다.',
    INVALID_STATUS: '현재 업무 상태에서는 완료 요청을 보낼 수 없습니다.',
    COMPLETION_TIMEOUT: '완료 확인 시간이 지났습니다. 최신 상태를 확인해 주세요.',
    SAFE_FRAME_FAILED: '안전한 다음 화면을 확인하지 못했습니다.',
    REQUEST_ABORTED: '보안 입력 완료 요청을 중단했습니다.',
    REQUEST_TIMEOUT: '완료 요청 시간이 초과되었습니다. 연결 상태를 확인해 주세요.',
    SERVER_ERROR: '보안 입력 완료 여부를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    INVALID_RESPONSE: '보안 입력 처리 결과를 안전하게 확인하지 못했습니다.'
  };
  return messages[code];
}

function fail(code: SessionSecureInputErrorCode): never {
  throw new SessionSecureInputClientError(code, safeMessage(code));
}

function validateId(value: unknown): string {
  if (typeof value !== 'string' || !SAFE_ID_PATTERN.test(value)) {
    return fail('INVALID_REQUEST');
  }
  return value;
}

function validateRequest(value: CompleteSessionSecureInputRequest) {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, REQUEST_KEYS) ||
    !Number.isSafeInteger(value.expectedSequence) ||
    value.expectedSequence < 1
  ) {
    return fail('INVALID_REQUEST');
  }
  return {
    requestId: validateId(value.requestId),
    expectedFrameId: validateId(value.expectedFrameId),
    expectedSequence: value.expectedSequence
  };
}

const BACKEND_ERROR_CODES: Readonly<Record<string, SessionSecureInputErrorCode>> = {
  SECURE_404_REQUEST_NOT_FOUND: 'SECURE_REQUEST_NOT_FOUND',
  SECURE_409_REQUEST_MISMATCH: 'SECURE_REQUEST_MISMATCH',
  SECURE_409_STALE_FRAME: 'STALE_FRAME',
  SECURE_409_DUPLICATE_REQUEST: 'DUPLICATE_REQUEST',
  SECURE_409_COMPLETION_BUSY: 'COMPLETION_BUSY',
  SECURE_409_MARKER_MISSING: 'MARKER_MISSING',
  SECURE_409_INPUT_ACTIVE: 'INPUT_STILL_ACTIVE',
  SECURE_409_SESSION_TERMINATED: 'SESSION_TERMINATED',
  SECURE_409_INVALID_STATUS: 'INVALID_STATUS',
  SECURE_408_COMPLETION_TIMEOUT: 'COMPLETION_TIMEOUT',
  SECURE_503_SAFE_FRAME_FAILED: 'SAFE_FRAME_FAILED',
  SECURE_409_REQUEST_ABORTED: 'REQUEST_ABORTED'
};

async function backendErrorCode(response: Response): Promise<SessionSecureInputErrorCode> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.toLowerCase().includes('application/json')) {
    try {
      const body: unknown = await response.json();
      if (isRecord(body) && typeof body.errorCode === 'string') {
        const mapped = BACKEND_ERROR_CODES[body.errorCode];
        if (mapped) return mapped;
      }
    } catch {
      // Backend 본문은 사용자에게 노출하지 않는다.
    }
  }
  if (response.status === 404) return 'SESSION_NOT_FOUND';
  if (response.status === 400) return 'INVALID_REQUEST';
  return 'SERVER_ERROR';
}

function validateResponse(
  value: unknown,
  expected: { sessionId: string; requestId: string; secureRequestId: string }
): CompleteSessionSecureInputResponse {
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
  if (
    data.sessionId !== expected.sessionId ||
    data.requestId !== expected.requestId ||
    data.secureRequestId !== expected.secureRequestId ||
    data.status !== 'COMPLETION_ACCEPTED' ||
    typeof data.message !== 'string' ||
    data.message.trim() === '' ||
    data.message.length > 500
  ) {
    return fail('INVALID_RESPONSE');
  }
  return data as unknown as CompleteSessionSecureInputResponse;
}

export class SessionSecureInputClient {
  private readonly backendBaseUrl: URL;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;

  constructor(options: SessionSecureInputClientOptions = {}) {
    this.backendBaseUrl = resolveBackendBaseUrl(
      options.baseUrl ?? import.meta.env.VITE_BACKEND_BASE_URL
    );
    this.timeoutMs = options.timeoutMs ?? DEFAULT_SECURE_INPUT_REQUEST_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs <= 0) {
      fail('INVALID_REQUEST');
    }
  }

  async complete({
    sessionId: rawSessionId,
    secureRequestId: rawSecureRequestId,
    request: rawRequest,
    signal
  }: CompleteSessionSecureInputOptions): Promise<CompleteSessionSecureInputResponse> {
    const sessionId = validateId(rawSessionId);
    const secureRequestId = validateId(rawSecureRequestId);
    const request = validateRequest(rawRequest);
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
          `/api/v1/sessions/${sessionId}/secure-inputs/${secureRequestId}/complete`,
          this.backendBaseUrl
        ),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(request),
          signal: controller.signal
        }
      );
      if (!response.ok || response.status !== 200) {
        const code = await backendErrorCode(response);
        fail(code);
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
      return validateResponse(body, {
        sessionId,
        requestId: request.requestId,
        secureRequestId
      });
    } catch (error) {
      if (error instanceof SessionSecureInputClientError) throw error;
      if (timedOut) fail('REQUEST_TIMEOUT');
      if (controller.signal.aborted) fail('REQUEST_ABORTED');
      return fail('SERVER_ERROR');
    } finally {
      globalThis.clearTimeout(timeoutId);
      signal?.removeEventListener('abort', abortFromCaller);
    }
  }
}

export const defaultSessionSecureInputClient = new SessionSecureInputClient();
