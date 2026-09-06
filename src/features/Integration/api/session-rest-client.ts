import type { WorkflowStatus } from '@/types/frontend-state';

export const DEFAULT_BACKEND_BASE_URL = 'http://127.0.0.1:8080';
export const FRAME_SUBPROTOCOL = 'ddd.browser-frame.v1';
export const DEFAULT_SESSION_REQUEST_TIMEOUT_MS = 10_000;

const SESSION_ID_PATTERN = /^[A-Za-z0-9-]{1,100}$/;
const WORKFLOW_STATUSES: ReadonlySet<WorkflowStatus> = new Set([
  'SESSION_CREATED',
  'PAGE_LOADING',
  'AI_EXECUTING',
  'USER_DECISION_REQUIRED',
  'SECURE_INPUT_REQUIRED',
  'FINAL_CONFIRMATION_REQUIRED',
  'ADDITIONAL_INFORMATION_REQUIRED',
  'RISK_WARNING',
  'COMPLETED',
  'CANCELLED',
  'ERROR',
  'TERMINATED'
]);

export interface CreateBackendSessionRequest {
  userRequest: string;
  siteId: 'demo-bank';
  initialPath: '/deposit/products' | '/transfer/accounts';
}

export interface BackendSession {
  sessionId: string;
  status: WorkflowStatus;
  frameWebSocketPath: string;
  frameProtocol: typeof FRAME_SUBPROTOCOL;
  frameWebSocketUrl: string;
}

export type SessionRestErrorCode =
  | 'INVALID_CONFIGURATION'
  | 'INVALID_RESPONSE'
  | 'REQUEST_FAILED'
  | 'REQUEST_TIMEOUT'
  | 'REQUEST_ABORTED';

export class SessionRestError extends Error {
  constructor(
    public readonly code: SessionRestErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'SessionRestError';
  }
}

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export interface SessionRestClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}

export interface SessionRequestOptions {
  signal?: AbortSignal;
}

interface ApiEnvelope {
  success: boolean;
  data: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function resolveBackendBaseUrl(rawBaseUrl?: string): URL {
  const value = rawBaseUrl?.trim() || DEFAULT_BACKEND_BASE_URL;
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new SessionRestError(
      'INVALID_CONFIGURATION',
      'Backend 연결 주소 설정을 확인해 주세요.'
    );
  }

  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username !== '' ||
    url.password !== '' ||
    url.search !== '' ||
    url.hash !== '' ||
    (url.pathname !== '' && url.pathname !== '/')
  ) {
    throw new SessionRestError(
      'INVALID_CONFIGURATION',
      'Backend 연결 주소 설정을 확인해 주세요.'
    );
  }

  url.pathname = '/';
  return url;
}

function validateSessionId(value: unknown): string {
  if (typeof value !== 'string' || !SESSION_ID_PATTERN.test(value)) {
    throw new SessionRestError(
      'INVALID_RESPONSE',
      '세션 응답을 확인할 수 없습니다.'
    );
  }
  return value;
}

function validateWorkflowStatus(value: unknown): WorkflowStatus {
  if (typeof value !== 'string' || !WORKFLOW_STATUSES.has(value as WorkflowStatus)) {
    throw new SessionRestError(
      'INVALID_RESPONSE',
      '세션 상태를 확인할 수 없습니다.'
    );
  }
  return value as WorkflowStatus;
}

function validateFramePath(value: unknown, sessionId: string): string {
  const canonicalPath = `/ws/sessions/${sessionId}/frames`;
  if (
    typeof value !== 'string' ||
    value !== canonicalPath ||
    !value.startsWith('/') ||
    value.includes('\\') ||
    value.includes('..') ||
    value.includes('?') ||
    value.includes('#')
  ) {
    throw new SessionRestError(
      'INVALID_RESPONSE',
      '화면 연결 정보를 확인할 수 없습니다.'
    );
  }
  return value;
}

export function createFrameWebSocketUrl(
  backendBaseUrl: URL,
  frameWebSocketPath: string
): string {
  const result = new URL(frameWebSocketPath, backendBaseUrl);
  result.protocol = backendBaseUrl.protocol === 'https:' ? 'wss:' : 'ws:';

  if (
    result.host !== backendBaseUrl.host ||
    result.username !== '' ||
    result.password !== '' ||
    result.search !== '' ||
    result.hash !== ''
  ) {
    throw new SessionRestError(
      'INVALID_RESPONSE',
      '화면 연결 정보를 확인할 수 없습니다.'
    );
  }

  return result.toString();
}

function parseSessionData(data: unknown, backendBaseUrl: URL): BackendSession {
  if (!isRecord(data)) {
    throw new SessionRestError('INVALID_RESPONSE', '세션 응답을 확인할 수 없습니다.');
  }

  const sessionId = validateSessionId(data.sessionId);
  const status = validateWorkflowStatus(data.status);
  const frameWebSocketPath = validateFramePath(data.frameWebSocketPath, sessionId);

  if (data.frameProtocol !== FRAME_SUBPROTOCOL) {
    throw new SessionRestError(
      'INVALID_RESPONSE',
      '지원하지 않는 화면 연결 방식입니다.'
    );
  }

  return {
    sessionId,
    status,
    frameWebSocketPath,
    frameProtocol: FRAME_SUBPROTOCOL,
    frameWebSocketUrl: createFrameWebSocketUrl(backendBaseUrl, frameWebSocketPath)
  };
}

export class SessionRestClient {
  private readonly backendBaseUrl: URL;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;

  constructor(options: SessionRestClientOptions = {}) {
    this.backendBaseUrl = resolveBackendBaseUrl(
      options.baseUrl ?? import.meta.env.VITE_BACKEND_BASE_URL
    );
    this.timeoutMs = options.timeoutMs ?? DEFAULT_SESSION_REQUEST_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));

    if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs <= 0) {
      throw new SessionRestError(
        'INVALID_CONFIGURATION',
        'Backend 요청 제한시간 설정을 확인해 주세요.'
      );
    }
  }

  createSession(
    request: CreateBackendSessionRequest,
    options?: SessionRequestOptions
  ): Promise<BackendSession> {
    return this.request('/api/v1/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(request),
      signal: options?.signal
    }, 201);
  }

  getSession(sessionId: string, options?: SessionRequestOptions): Promise<BackendSession> {
    const safeSessionId = validateSessionId(sessionId);
    return this.request(`/api/v1/sessions/${safeSessionId}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: options?.signal
    }, 200);
  }

  cancelSession(
    sessionId: string,
    options?: SessionRequestOptions
  ): Promise<BackendSession> {
    const safeSessionId = validateSessionId(sessionId);
    return this.request(`/api/v1/sessions/${safeSessionId}/cancel`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      signal: options?.signal
    }, 200);
  }

  private async request(
    path: string,
    init: RequestInit,
    expectedStatus: number
  ): Promise<BackendSession> {
    const controller = new AbortController();
    let timedOut = false;
    const externalSignal = init.signal;
    const abortFromCaller = () => controller.abort();
    externalSignal?.addEventListener('abort', abortFromCaller, { once: true });
    if (externalSignal?.aborted) controller.abort();
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);

    try {
      const response = await this.fetchImpl(new URL(path, this.backendBaseUrl), {
        ...init,
        signal: controller.signal
      });

      if (!response.ok || response.status !== expectedStatus) {
        throw new SessionRestError(
          'REQUEST_FAILED',
          '세션 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
        );
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.toLowerCase().includes('application/json')) {
        throw new SessionRestError(
          'INVALID_RESPONSE',
          '세션 응답 형식을 확인할 수 없습니다.'
        );
      }

      let json: unknown;
      try {
        json = await response.json();
      } catch {
        throw new SessionRestError(
          'INVALID_RESPONSE',
          '세션 응답 형식을 확인할 수 없습니다.'
        );
      }

      if (!isRecord(json) || typeof json.success !== 'boolean' || !('data' in json)) {
        throw new SessionRestError('INVALID_RESPONSE', '세션 응답을 확인할 수 없습니다.');
      }

      const envelope = json as unknown as ApiEnvelope;
      if (envelope.success !== true) {
        throw new SessionRestError(
          'REQUEST_FAILED',
          '세션 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
        );
      }

      return parseSessionData(envelope.data, this.backendBaseUrl);
    } catch (error) {
      if (error instanceof SessionRestError) {
        throw error;
      }
      if (timedOut) {
        throw new SessionRestError('REQUEST_TIMEOUT', '세션 요청 시간이 초과되었습니다.');
      }
      if (controller.signal.aborted) {
        throw new SessionRestError('REQUEST_ABORTED', '세션 요청이 중단되었습니다.');
      }
      throw new SessionRestError(
        'REQUEST_FAILED',
        'Backend에 연결할 수 없습니다. 실행 상태를 확인해 주세요.'
      );
    } finally {
      window.clearTimeout(timeoutId);
      externalSignal?.removeEventListener('abort', abortFromCaller);
    }
  }
}

export const defaultSessionRestClient = new SessionRestClient();
