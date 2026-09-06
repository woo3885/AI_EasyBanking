export interface RetryOptions {
  maxAttempts: number;
  timeoutMs: number;
  baseDelayMs: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  timeoutMs: 10_000,
  baseDelayMs: 1_000,
};

export class AiTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`[AI Engine] Gemini 요청 시간이 ${timeoutMs}ms를 초과했습니다.`);
    this.name = "AiTimeoutError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const errorRecord = error as Record<string, unknown>;

  if (typeof errorRecord.status === "number") {
    return errorRecord.status;
  }

  if (typeof errorRecord.statusCode === "number") {
    return errorRecord.statusCode;
  }

  return undefined;
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof AiTimeoutError) {
    return true;
  }

  const status = getHttpStatus(error);

  return status === 429 || (status !== undefined && status >= 500);
}

async function withTimeout<T>(
  task: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new AiTimeoutError(timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([task, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

export async function executeWithRetry<T>(
  task: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const config = {
    ...DEFAULT_RETRY_OPTIONS,
    ...options,
  };

  let lastError: unknown;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt += 1) {
    try {
      return await withTimeout(task(), config.timeoutMs);
    } catch (error) {
      lastError = error;

      const retryable = isRetryableError(error);
      const isLastAttempt = attempt === config.maxAttempts;

      if (!retryable || isLastAttempt) {
        throw error;
      }

      const delayMs =
        config.baseDelayMs * 2 ** (attempt - 1);

      console.warn(
        `[AI Engine] Gemini 호출 실패. ${delayMs}ms 후 재시도합니다. ` +
          `(attempt=${attempt}/${config.maxAttempts})`,
      );

      await sleep(delayMs);
    }
  }

  throw lastError;
}