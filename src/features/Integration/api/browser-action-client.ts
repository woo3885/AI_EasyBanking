import {
  DEFAULT_BACKEND_BASE_URL,
  resolveBackendBaseUrl
} from '@/features/Integration/api/session-rest-client';

export const DEFAULT_BROWSER_ACTION_TIMEOUT_MS = 10_000;

const SESSION_ID_PATTERN = /^[A-Za-z0-9-]{1,100}$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
const ELEMENT_ID_PATTERN = /^el-[A-Za-z0-9]{8}-\d{3}$/;
const FRAME_ID_PATTERN = /^[A-Za-z0-9-]{1,100}$/;
const SAFE_MESSAGE_PATTERN = /^[^<>\u0000-\u001F\u007F]{1,500}$/u;
const VIEWPORT_WIDTH = 1280;
const VIEWPORT_HEIGHT = 720;
const MAX_SCROLL_DELTA = 3000;

const ACTION_STATUSES = new Set<BrowserActionStatus>([
  'EXECUTED',
  'NO_ACTION',
  'USER_ACTION_REQUIRED',
  'SECURE_INPUT_REQUIRED',
  'FINAL_CONFIRMATION_REQUIRED',
  'BLOCKED',
  'STOPPED'
]);

const ELEMENT_CLICK_REQUEST_KEYS = [
  'requestId',
  'actionType',
  'source',
  'elementId',
  'expectedFrameId',
  'expectedSequence'
] as const;

const COORDINATE_CLICK_REQUEST_KEYS = [
  'requestId',
  'actionType',
  'source',
  'x',
  'y',
  'expectedFrameId',
  'expectedSequence'
] as const;

const SCROLL_REQUEST_KEYS = [
  'requestId',
  'actionType',
  'source',
  'x',
  'y',
  'deltaX',
  'deltaY',
  'expectedFrameId',
  'expectedSequence'
] as const;

const RESPONSE_KEYS = [
  'requestId',
  'actionType',
  'status',
  'message',
  'frameId',
  'sequence',
  'frameAdvanced'
] as const;

const ENVELOPE_KEYS = ['success', 'data', 'errorCode', 'message'] as const;

interface BrowserActionRequestBase {
  requestId: string;
  source: 'USER_VIEWER';
  expectedFrameId: string;
  expectedSequence: number;
}

export interface BrowserElementClickRequest extends BrowserActionRequestBase {
  actionType: 'CLICK';
  elementId: string;
}

export interface BrowserCoordinateClickRequest extends BrowserActionRequestBase {
  actionType: 'CLICK';
  x: number;
  y: number;
}

export interface BrowserScrollRequest extends BrowserActionRequestBase {
  actionType: 'SCROLL';
  x: number;
  y: number;
  deltaX: number;
  deltaY: number;
}

export type BrowserActionRequest =
  | BrowserElementClickRequest
  | BrowserCoordinateClickRequest
  | BrowserScrollRequest;

export type BrowserActionStatus =
  | 'EXECUTED'
  | 'NO_ACTION'
  | 'USER_ACTION_REQUIRED'
  | 'SECURE_INPUT_REQUIRED'
  | 'FINAL_CONFIRMATION_REQUIRED'
  | 'BLOCKED'
  | 'STOPPED';

export interface BrowserActionResponse {
  requestId: string;
  actionType: 'CLICK' | 'SCROLL';
  status: BrowserActionStatus;
  message: string;
  frameId: string;
  sequence: number;
  frameAdvanced: boolean;
}

export type BrowserActionClientErrorCode =
  | 'INVALID_CONFIGURATION'
  | 'INVALID_REQUEST'
  | 'INVALID_RESPONSE'
  | 'SESSION_NOT_FOUND'
  | 'FRAME_NOT_READY'
  | 'STALE_FRAME'
  | 'DUPLICATE_REQUEST'
  | 'SESSION_STATE_BLOCKED'
  | 'ACTION_BUSY'
  | 'RATE_LIMITED'
  | 'REQUEST_FAILED'
  | 'REQUEST_TIMEOUT'
  | 'REQUEST_ABORTED';

export class BrowserActionClientError extends Error {
  constructor(
    public readonly code: BrowserActionClientErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'BrowserActionClientError';
  }
}

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export interface BrowserActionClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}

export interface SubmitBrowserActionOptions {
  sessionId: string;
  request: BrowserActionRequest;
  signal?: AbortSignal;
}

interface ApiEnvelope {
  success: boolean;
  data: unknown;
  errorCode: string | null;
  message: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[]
): boolean {
  const actualKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  return (
    actualKeys.length === sortedExpectedKeys.length &&
    actualKeys.every((key, index) => key === sortedExpectedKeys[index])
  );
}

function invalidRequest(): never {
  throw new BrowserActionClientError(
    'INVALID_REQUEST',
    '화면 동작 요청 정보를 확인해 주세요.'
  );
}

function invalidResponse(): never {
  throw new BrowserActionClientError(
    'INVALID_RESPONSE',
    '화면 동작 응답을 확인할 수 없습니다.'
  );
}

function validateSessionId(value: unknown): string {
  if (typeof value !== 'string' || !SESSION_ID_PATTERN.test(value)) {
    return invalidRequest();
  }
  return value;
}

export function validateBrowserActionRequest(
  value: unknown
): BrowserActionRequest {
  if (!isRecord(value)) {
    return invalidRequest();
  }

  if (
    typeof value.requestId !== 'string' ||
    !REQUEST_ID_PATTERN.test(value.requestId) ||
    value.source !== 'USER_VIEWER' ||
    typeof value.expectedFrameId !== 'string' ||
    !FRAME_ID_PATTERN.test(value.expectedFrameId) ||
    !Number.isSafeInteger(value.expectedSequence) ||
    Number(value.expectedSequence) < 1
  ) {
    return invalidRequest();
  }

  const common = {
    requestId: value.requestId,
    source: 'USER_VIEWER' as const,
    expectedFrameId: value.expectedFrameId,
    expectedSequence: Number(value.expectedSequence)
  };

  if (value.actionType === 'CLICK') {
    if (hasExactKeys(value, ELEMENT_CLICK_REQUEST_KEYS)) {
      if (
        typeof value.elementId !== 'string' ||
        !ELEMENT_ID_PATTERN.test(value.elementId)
      ) {
        return invalidRequest();
      }
      return {
        ...common,
        actionType: 'CLICK',
        elementId: value.elementId
      };
    }

    if (hasExactKeys(value, COORDINATE_CLICK_REQUEST_KEYS)) {
      if (!isViewerCoordinate(value.x, value.y)) {
        return invalidRequest();
      }
      return {
        ...common,
        actionType: 'CLICK',
        x: Number(value.x),
        y: Number(value.y)
      };
    }

    return invalidRequest();
  }

  if (value.actionType === 'SCROLL') {
    if (
      !hasExactKeys(value, SCROLL_REQUEST_KEYS) ||
      !isViewerCoordinate(value.x, value.y) ||
      !isScrollDelta(value.deltaX) ||
      !isScrollDelta(value.deltaY) ||
      (value.deltaX === 0 && value.deltaY === 0)
    ) {
      return invalidRequest();
    }
    return {
      ...common,
      actionType: 'SCROLL',
      x: Number(value.x),
      y: Number(value.y),
      deltaX: Number(value.deltaX),
      deltaY: Number(value.deltaY)
    };
  }

  return invalidRequest();
}

function isViewerCoordinate(x: unknown, y: unknown): boolean {
  return (
    Number.isSafeInteger(x) &&
    Number(x) >= 0 &&
    Number(x) < VIEWPORT_WIDTH &&
    Number.isSafeInteger(y) &&
    Number(y) >= 0 &&
    Number(y) < VIEWPORT_HEIGHT
  );
}

function isScrollDelta(value: unknown): boolean {
  return Number.isSafeInteger(value) && Math.abs(Number(value)) <= MAX_SCROLL_DELTA;
}

function parseEnvelope(value: unknown): ApiEnvelope {
  if (!isRecord(value) || !hasExactKeys(value, ENVELOPE_KEYS)) {
    return invalidResponse();
  }
  if (
    typeof value.success !== 'boolean' ||
    !(typeof value.errorCode === 'string' || value.errorCode === null) ||
    !(typeof value.message === 'string' || value.message === null)
  ) {
    return invalidResponse();
  }
  return {
    success: value.success,
    data: value.data,
    errorCode: value.errorCode,
    message: value.message
  };
}

function validateSafeMessage(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value !== value.trim() ||
    !SAFE_MESSAGE_PATTERN.test(value)
  ) {
    return invalidResponse();
  }
  return value;
}

function validateBrowserActionResponse(
  value: unknown,
  request: BrowserActionRequest
): BrowserActionResponse {
  if (!isRecord(value) || !hasExactKeys(value, RESPONSE_KEYS)) {
    return invalidResponse();
  }
  if (
    value.requestId !== request.requestId ||
    value.actionType !== request.actionType ||
    typeof value.status !== 'string' ||
    !ACTION_STATUSES.has(value.status as BrowserActionStatus) ||
    typeof value.frameId !== 'string' ||
    !FRAME_ID_PATTERN.test(value.frameId) ||
    !Number.isSafeInteger(value.sequence) ||
    Number(value.sequence) < 1 ||
    typeof value.frameAdvanced !== 'boolean'
  ) {
    return invalidResponse();
  }

  const sequence = Number(value.sequence);
  const frameAdvanced = value.frameAdvanced;
  const frameMatchesRequest =
    value.frameId === request.expectedFrameId &&
    sequence === request.expectedSequence;
  const frameHasAdvanced =
    value.frameId !== request.expectedFrameId &&
    sequence > request.expectedSequence;

  if (
    (frameAdvanced && !frameHasAdvanced) ||
    (!frameAdvanced && !frameMatchesRequest)
  ) {
    return invalidResponse();
  }

  return {
    requestId: request.requestId,
    actionType: request.actionType,
    status: value.status as BrowserActionStatus,
    message: validateSafeMessage(value.message),
    frameId: value.frameId,
    sequence,
    frameAdvanced
  };
}

function mapErrorEnvelope(status: number, envelope: ApiEnvelope): never {
  if (
    envelope.success !== false ||
    envelope.data !== null ||
    typeof envelope.errorCode !== 'string' ||
    typeof envelope.message !== 'string'
  ) {
    return invalidResponse();
  }

  const mappings: Record<
    string,
    { status: number; code: BrowserActionClientErrorCode; message: string }
  > = {
    COMMON_400: {
      status: 400,
      code: 'INVALID_REQUEST',
      message: '화면 동작 요청 정보를 확인해 주세요.'
    },
    SESSION_404: {
      status: 404,
      code: 'SESSION_NOT_FOUND',
      message: '화면 연결 세션을 찾을 수 없습니다.'
    },
    ACTION_409_FRAME_NOT_READY: {
      status: 409,
      code: 'FRAME_NOT_READY',
      message: '최신 원격 화면을 기다린 뒤 다시 시도해 주세요.'
    },
    ACTION_409_STALE_FRAME: {
      status: 409,
      code: 'STALE_FRAME',
      message: '원격 화면이 변경되었습니다. 최신 화면에서 다시 시도해 주세요.'
    },
    ACTION_409_DUPLICATE_REQUEST: {
      status: 409,
      code: 'DUPLICATE_REQUEST',
      message: '이미 처리된 화면 동작입니다.'
    },
    SESSION_409: {
      status: 409,
      code: 'SESSION_STATE_BLOCKED',
      message: '현재 상태에서는 원격 화면을 조작할 수 없습니다.'
    },
    ACTION_409_BUSY: {
      status: 409,
      code: 'ACTION_BUSY',
      message: '이전 화면 동작을 처리하고 있습니다.'
    },
    ACTION_429_RATE_LIMITED: {
      status: 429,
      code: 'RATE_LIMITED',
      message: '화면 스크롤 요청이 너무 빠릅니다. 잠시 후 다시 시도해 주세요.'
    },
    COMMON_500: {
      status: 500,
      code: 'REQUEST_FAILED',
      message: '화면 동작을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
    }
  };
  const mapping = mappings[envelope.errorCode];
  if (!mapping || mapping.status !== status) {
    return invalidResponse();
  }
  throw new BrowserActionClientError(mapping.code, mapping.message);
}

export class BrowserActionClient {
  private readonly backendBaseUrl: URL;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;

  constructor(options: BrowserActionClientOptions = {}) {
    try {
      this.backendBaseUrl = resolveBackendBaseUrl(
        options.baseUrl ?? import.meta.env.VITE_BACKEND_BASE_URL ?? DEFAULT_BACKEND_BASE_URL
      );
    } catch {
      throw new BrowserActionClientError(
        'INVALID_CONFIGURATION',
        'Backend 연결 주소 설정을 확인해 주세요.'
      );
    }
    this.timeoutMs = options.timeoutMs ?? DEFAULT_BROWSER_ACTION_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));

    if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs <= 0) {
      throw new BrowserActionClientError(
        'INVALID_CONFIGURATION',
        '화면 동작 요청 제한시간 설정을 확인해 주세요.'
      );
    }
  }

  async submitBrowserAction({
    sessionId,
    request,
    signal
  }: SubmitBrowserActionOptions): Promise<BrowserActionResponse> {
    const safeSessionId = validateSessionId(sessionId);
    const safeRequest = validateBrowserActionRequest(request);
    const controller = new AbortController();
    let timedOut = false;
    const abortFromCaller = () => controller.abort();
    signal?.addEventListener('abort', abortFromCaller, { once: true });
    if (signal?.aborted) controller.abort();
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);

    try {
      const response = await this.fetchImpl(
        new URL(`/api/v1/sessions/${safeSessionId}/actions`, this.backendBaseUrl),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify(safeRequest),
          signal: controller.signal
        }
      );
      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.toLowerCase().includes('application/json')) {
        return invalidResponse();
      }

      let rawEnvelope: unknown;
      try {
        rawEnvelope = await response.json();
      } catch {
        return invalidResponse();
      }
      const envelope = parseEnvelope(rawEnvelope);

      if (!response.ok || response.status !== 200) {
        return mapErrorEnvelope(response.status, envelope);
      }
      if (
        envelope.success !== true ||
        envelope.errorCode !== null ||
        typeof envelope.message !== 'string'
      ) {
        return invalidResponse();
      }
      return validateBrowserActionResponse(envelope.data, safeRequest);
    } catch (error) {
      if (error instanceof BrowserActionClientError) {
        throw error;
      }
      if (timedOut) {
        throw new BrowserActionClientError(
          'REQUEST_TIMEOUT',
          '화면 동작 요청 시간이 초과되었습니다.'
        );
      }
      if (controller.signal.aborted) {
        throw new BrowserActionClientError(
          'REQUEST_ABORTED',
          '화면 동작 요청이 중단되었습니다.'
        );
      }
      throw new BrowserActionClientError(
        'REQUEST_FAILED',
        'Backend에 연결할 수 없습니다. 실행 상태를 확인해 주세요.'
      );
    } finally {
      window.clearTimeout(timeoutId);
      signal?.removeEventListener('abort', abortFromCaller);
    }
  }
}

export const defaultBrowserActionClient = new BrowserActionClient();

export function submitBrowserAction(
  options: SubmitBrowserActionOptions
): Promise<BrowserActionResponse> {
  return defaultBrowserActionClient.submitBrowserAction(options);
}
