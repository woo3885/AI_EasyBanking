import {
  createStreamSession,
  type StreamSessionPayload
} from '@/shared/api/orchestratorClient';
import type {
  DashboardSessionStartRequest,
  DashboardSessionStartResult
} from '../model/dashboard-session';

export interface DashboardSessionClient {
  createSession(
    request: DashboardSessionStartRequest
  ): Promise<DashboardSessionStartResult>;
}

export type DashboardSessionCreator = (
  payload: StreamSessionPayload
) => Promise<unknown>;

type NowProvider = () => string;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function normalizeSessionResult(
  rawResult: unknown,
  now: NowProvider = () => new Date().toISOString()
): DashboardSessionStartResult {
  if (
    !isRecord(rawResult) ||
    typeof rawResult.sessionId !== 'string' ||
    rawResult.sessionId.trim() === ''
  ) {
    throw new Error('세션 생성 결과에 sessionId가 없습니다.');
  }

  const createdAt =
    typeof rawResult.createdAt === 'string' &&
    rawResult.createdAt.trim() !== ''
      ? rawResult.createdAt
      : now();
  const webSocketUrl =
    typeof rawResult.webSocketUrl === 'string' &&
    rawResult.webSocketUrl.trim() !== ''
      ? rawResult.webSocketUrl
      : undefined;

  return {
    sessionId: rawResult.sessionId.trim(),
    webSocketUrl,
    createdAt
  };
}

export function createDashboardSessionClient(
  sessionCreator: DashboardSessionCreator = createStreamSession,
  now: NowProvider = () => new Date().toISOString()
): DashboardSessionClient {
  return {
    async createSession(request) {
      const rawResult = await sessionCreator({
        targetUrl: request.initialUrl
      });

      return normalizeSessionResult(rawResult, now);
    }
  };
}

export const defaultDashboardSessionClient =
  createDashboardSessionClient();
