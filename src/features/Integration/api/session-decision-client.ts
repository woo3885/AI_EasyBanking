import type { WorkflowStatus } from '@/types/frontend-state';

import { resolveBackendBaseUrl } from './session-rest-client';

export const DEFAULT_DECISION_REQUEST_TIMEOUT_MS = 10_000;

const SAFE_ID_PATTERN = /^[A-Za-z0-9-]{1,100}$/;
const SUPPORTED_DECISION_TYPES = new Set<SessionDecisionRequest['decisionType']>([
  'PRODUCT_SELECTION',
  'SOURCE_ACCOUNT_SELECTION',
  'RECIPIENT_SELECTION',
  'TERMS_AGREEMENT'
]);
const WORKFLOW_STATUSES = new Set<WorkflowStatus>([
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

export type SessionDecisionErrorCode =
  | 'INVALID_REQUEST'
  | 'SESSION_NOT_FOUND'
  | 'DECISION_CONFLICT'
  | 'REQUEST_TIMEOUT'
  | 'REQUEST_ABORTED'
  | 'SERVER_ERROR'
  | 'INVALID_RESPONSE';

export interface SessionDecisionRequest {
  requestId: string;
  decisionId: string;
  decisionType:
    | 'PRODUCT_SELECTION'
    | 'SOURCE_ACCOUNT_SELECTION'
    | 'RECIPIENT_SELECTION'
    | 'TERMS_AGREEMENT';
  selectedOptionIds: readonly string[];
  expectedFrameId: string;
  expectedSequence: number;
}

export interface SessionDecisionResponse {
  sessionId: string;
  status: WorkflowStatus;
}

export interface SubmitSessionDecisionOptions {
  sessionId: string;
  request: SessionDecisionRequest;
  signal?: AbortSignal;
}

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export interface SessionDecisionClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}

export class SessionDecisionClientError extends Error {
  constructor(
    public readonly code: SessionDecisionErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'SessionDecisionClientError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalidRequest(): never {
  throw new SessionDecisionClientError(
    'INVALID_REQUEST',
    '선택 요청을 안전하게 확인할 수 없습니다.'
  );
}

function validateId(value: unknown): string {
  if (typeof value !== 'string' || !SAFE_ID_PATTERN.test(value)) {
    return invalidRequest();
  }
  return value;
}

function validateRequest(value: SessionDecisionRequest): SessionDecisionRequest {
  if (
    !isRecord(value) ||
    !SUPPORTED_DECISION_TYPES.has(value.decisionType) ||
    !Array.isArray(value.selectedOptionIds) ||
    value.selectedOptionIds.length > 20 ||
    !Number.isSafeInteger(value.expectedSequence) ||
    value.expectedSequence < 1
  ) {
    return invalidRequest();
  }

  const selectedOptionIds = value.selectedOptionIds.map(validateId);
  if (
    new Set(selectedOptionIds).size !== selectedOptionIds.length ||
    (value.decisionType !== 'TERMS_AGREEMENT' && selectedOptionIds.length !== 1)
  ) {
    return invalidRequest();
  }

  return {
    requestId: validateId(value.requestId),
    decisionId: validateId(value.decisionId),
    decisionType: value.decisionType,
    selectedOptionIds,
    expectedFrameId: validateId(value.expectedFrameId),
    expectedSequence: value.expectedSequence
  };
}

function safeMessage(code: SessionDecisionErrorCode): string {
  const messages: Record<SessionDecisionErrorCode, string> = {
    INVALID_REQUEST: '선택 요청을 안전하게 확인할 수 없습니다.',
    SESSION_NOT_FOUND: '진행 중인 업무 세션을 찾을 수 없습니다.',
    DECISION_CONFLICT: '현재 선택 화면이 변경되었습니다. 최신 화면을 확인해 주세요.',
    REQUEST_TIMEOUT: '선택 확인 시간이 초과되었습니다. 연결 상태를 확인해 주세요.',
    REQUEST_ABORTED: '선택 확인 요청이 중단되었습니다.',
    SERVER_ERROR: '선택 결과를 처리하지 못했습니다. 잠시 후 다시 확인해 주세요.',
    INVALID_RESPONSE: '선택 처리 결과를 안전하게 확인할 수 없습니다.'
  };
  return messages[code];
}

function errorCodeFromStatus(status: number, backendCode: unknown): SessionDecisionErrorCode {
  if (status === 400 || backendCode === 'COMMON_400') return 'INVALID_REQUEST';
  if (status === 404 || backendCode === 'SESSION_404') return 'SESSION_NOT_FOUND';
  if (status === 409 || (typeof backendCode === 'string' && backendCode.includes('409'))) {
    return 'DECISION_CONFLICT';
  }
  return 'SERVER_ERROR';
}

async function readBackendErrorCode(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) return null;
  try {
    const body: unknown = await response.json();
    return isRecord(body) ? body.errorCode : null;
  } catch {
    return null;
  }
}

function validateResponse(
  value: unknown,
  expectedSessionId: string
): SessionDecisionResponse {
  if (
    !isRecord(value) ||
    value.success !== true ||
    value.errorCode !== null ||
    !('data' in value) ||
    !isRecord(value.data)
  ) {
    throw new SessionDecisionClientError(
      'INVALID_RESPONSE',
      safeMessage('INVALID_RESPONSE')
    );
  }

  const data = value.data;
  if (
    data.sessionId !== expectedSessionId ||
    typeof data.status !== 'string' ||
    !WORKFLOW_STATUSES.has(data.status as WorkflowStatus) ||
    typeof data.userRequest !== 'string' ||
    data.userRequest.trim() === '' ||
    typeof data.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(data.createdAt)) ||
    typeof data.updatedAt !== 'string' ||
    !Number.isFinite(Date.parse(data.updatedAt)) ||
    data.frameWebSocketPath !== `/ws/sessions/${expectedSessionId}/frames` ||
    data.frameProtocol !== 'ddd.browser-frame.v1'
  ) {
    throw new SessionDecisionClientError(
      'INVALID_RESPONSE',
      safeMessage('INVALID_RESPONSE')
    );
  }

  return {
    sessionId: expectedSessionId,
    status: data.status as WorkflowStatus
  };
}

export class SessionDecisionClient {
  private readonly backendBaseUrl: URL;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;

  constructor(options: SessionDecisionClientOptions = {}) {
    this.backendBaseUrl = resolveBackendBaseUrl(
      options.baseUrl ?? import.meta.env.VITE_BACKEND_BASE_URL
    );
    this.timeoutMs = options.timeoutMs ?? DEFAULT_DECISION_REQUEST_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));

    if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs <= 0) {
      throw new SessionDecisionClientError(
        'INVALID_REQUEST',
        safeMessage('INVALID_REQUEST')
      );
    }
  }

  async submitDecision({
    sessionId: rawSessionId,
    request: rawRequest,
    signal
  }: SubmitSessionDecisionOptions): Promise<SessionDecisionResponse> {
    const sessionId = validateId(rawSessionId);
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
        new URL(`/api/v1/sessions/${sessionId}/decisions`, this.backendBaseUrl),
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
        const code = errorCodeFromStatus(
          response.status,
          await readBackendErrorCode(response)
        );
        throw new SessionDecisionClientError(code, safeMessage(code));
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.toLowerCase().includes('application/json')) {
        throw new SessionDecisionClientError(
          'INVALID_RESPONSE',
          safeMessage('INVALID_RESPONSE')
        );
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new SessionDecisionClientError(
          'INVALID_RESPONSE',
          safeMessage('INVALID_RESPONSE')
        );
      }
      return validateResponse(body, sessionId);
    } catch (error) {
      if (error instanceof SessionDecisionClientError) throw error;
      if (timedOut) {
        throw new SessionDecisionClientError(
          'REQUEST_TIMEOUT',
          safeMessage('REQUEST_TIMEOUT')
        );
      }
      if (controller.signal.aborted) {
        throw new SessionDecisionClientError(
          'REQUEST_ABORTED',
          safeMessage('REQUEST_ABORTED')
        );
      }
      throw new SessionDecisionClientError(
        'SERVER_ERROR',
        safeMessage('SERVER_ERROR')
      );
    } finally {
      globalThis.clearTimeout(timeoutId);
      signal?.removeEventListener('abort', abortFromCaller);
    }
  }
}

export const defaultSessionDecisionClient = new SessionDecisionClient();
