export interface FrameReconnectPolicy {
  readonly delaysMs: readonly number[];
}

export interface FrameConnectionClose {
  code: number;
  wasClean: boolean;
}

export type FrameConnectionCloseCategory =
  | 'NORMAL'
  | 'TRANSIENT'
  | 'PROTOCOL'
  | 'UNSUPPORTED_DATA'
  | 'INVALID_PAYLOAD'
  | 'POLICY_VIOLATION'
  | 'MESSAGE_TOO_LARGE'
  | 'SECURITY'
  | 'UNKNOWN';

export interface FrameConnectionCloseClassification {
  category: FrameConnectionCloseCategory;
  retryable: boolean;
  message: string;
}

const TRANSIENT_CLOSE_CODES = new Set([1001, 1006, 1011, 1012, 1013, 1014]);

const NON_RETRYABLE_CLOSE_CODES: Readonly<Record<number, FrameConnectionCloseCategory>> = {
  1000: 'NORMAL',
  1002: 'PROTOCOL',
  1003: 'UNSUPPORTED_DATA',
  1007: 'INVALID_PAYLOAD',
  1008: 'POLICY_VIOLATION',
  1009: 'MESSAGE_TOO_LARGE',
  1010: 'PROTOCOL',
  1015: 'SECURITY'
};

const CLOSE_MESSAGES: Record<FrameConnectionCloseCategory, string> = {
  NORMAL: '원격 화면 연결이 정상적으로 종료되었습니다.',
  TRANSIENT: '원격 화면 연결이 일시적으로 끊겼습니다.',
  PROTOCOL: '원격 화면 연결 규격을 확인할 수 없습니다.',
  UNSUPPORTED_DATA: '지원하지 않는 원격 화면 데이터가 수신되었습니다.',
  INVALID_PAYLOAD: '원격 화면 데이터가 올바르지 않습니다.',
  POLICY_VIOLATION: '원격 화면 연결이 안전 정책에 따라 종료되었습니다.',
  MESSAGE_TOO_LARGE: '원격 화면 데이터 크기를 확인할 수 없습니다.',
  SECURITY: '원격 화면 보안 연결을 확인할 수 없습니다.',
  UNKNOWN: '원격 화면 연결이 종료되었습니다.'
};

export function classifyFrameConnectionClose(
  close: FrameConnectionClose
): FrameConnectionCloseClassification {
  const category = TRANSIENT_CLOSE_CODES.has(close.code)
    ? 'TRANSIENT'
    : NON_RETRYABLE_CLOSE_CODES[close.code] ?? 'UNKNOWN';

  return {
    category,
    retryable: category === 'TRANSIENT',
    message: CLOSE_MESSAGES[category]
  };
}

export function createFrameReconnectPolicy(
  delaysMs: readonly number[]
): FrameReconnectPolicy {
  const normalizedDelays = delaysMs.map((delay) => {
    if (!Number.isSafeInteger(delay) || delay < 0) {
      throw new Error('재연결 지연값은 0 이상의 안전한 정수여야 합니다.');
    }
    return delay;
  });

  return Object.freeze({
    delaysMs: Object.freeze(normalizedDelays)
  });
}

export function getFrameReconnectDelay(
  policy: FrameReconnectPolicy | undefined,
  attempt: number
): number | null {
  if (!policy || !Number.isSafeInteger(attempt) || attempt < 1) return null;

  const delay = policy.delaysMs[attempt - 1];
  if (!Number.isSafeInteger(delay) || delay < 0) return null;

  return delay;
}

export function getFrameReconnectMaxAttempts(
  policy: FrameReconnectPolicy | undefined
): number | null {
  return policy ? policy.delaysMs.length : null;
}

/**
 * D21 Preview와 테스트에서 자동 복구 흐름만 검증하기 위한 Mock 정책이다.
 * Backend의 production backpressure 또는 reconnect 계약이 아니다.
 */
export const PREVIEW_FRAME_RECONNECT_POLICY = createFrameReconnectPolicy([
  0,
  1_000,
  3_000
]);
