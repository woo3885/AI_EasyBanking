import { afterEach, describe, expect, it, vi } from 'vitest';

import * as orchestratorClient from '@/shared/api/orchestratorClient';
import type { DashboardSessionStartRequest } from '../model/dashboard-session';
import {
  createDashboardSessionClient,
  normalizeSessionResult
} from './dashboard-session-client';

const request: DashboardSessionStartRequest = {
  siteId: 'demo-bank',
  taskType: 'OPEN_DEPOSIT',
  initialPath: '/deposit/products',
  initialUrl: 'http://127.0.0.1:5190/deposit/products',
  userRequest: '예금 가입 절차를 시작해 주세요.'
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('dashboardSessionClient', () => {
  it('기존 로컬 Stub을 정확히 한 번 호출하고 결과를 정규화한다', async () => {
    const fetchMock = vi.fn();
    const webSocketMock = vi.fn();
    const sessionCreator = vi.fn(
      orchestratorClient.createStreamSession
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('WebSocket', webSocketMock);
    const client = createDashboardSessionClient(
      sessionCreator,
      () => '2026-07-31T00:00:00.000Z'
    );

    await expect(client.createSession(request)).resolves.toEqual({
      sessionId:
        'local-http%3A%2F%2F127.0.0.1%3A5190%2Fdeposit%2Fproducts',
      webSocketUrl: undefined,
      createdAt: '2026-07-31T00:00:00.000Z'
    });
    expect(sessionCreator).toHaveBeenCalledTimes(1);
    expect(sessionCreator).toHaveBeenCalledWith({
      targetUrl: request.initialUrl
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(webSocketMock).not.toHaveBeenCalled();
  });

  it('webSocketUrl이 없어도 sessionId가 있으면 성공한다', () => {
    expect(
      normalizeSessionResult(
        { sessionId: 'session-001' },
        () => '2026-07-31T00:00:00.000Z'
      )
    ).toEqual({
      sessionId: 'session-001',
      webSocketUrl: undefined,
      createdAt: '2026-07-31T00:00:00.000Z'
    });
  });

  it('응답의 webSocketUrl과 createdAt이 있으면 보존한다', () => {
    expect(
      normalizeSessionResult({
        sessionId: 'session-002',
        webSocketUrl: 'wss://example.test/sessions/session-002',
        createdAt: '2026-07-30T12:00:00.000Z'
      })
    ).toEqual({
      sessionId: 'session-002',
      webSocketUrl: 'wss://example.test/sessions/session-002',
      createdAt: '2026-07-30T12:00:00.000Z'
    });
  });

  it.each([undefined, null, {}, { sessionId: '' }])(
    'sessionId가 없는 결과 %j를 거부한다',
    (rawResult) => {
      expect(() => normalizeSessionResult(rawResult)).toThrow(
        '세션 생성 결과에 sessionId가 없습니다.'
      );
    }
  );
});
