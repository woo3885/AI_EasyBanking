import { describe, expect, it, vi } from 'vitest';

import { createNavigationHttpClient } from '../../src/features/AgentChat/api/navigation-http-client';

const binding = {
  sessionId: 'session-1', browserBindingId: 'binding-1', bridgeToken: 'memory-token',
  pageIdentity: 'page-source', expiresAt: '2099-01-01T00:00:00Z',
  recoveryPath: '/api/v1/sessions/session-1/conversation/bridge', pageReadyStatus: 'READY' as const
};

const request = {
  requestId: 'page-ready-request-1', navigationId: 'navigation-1',
  sourcePageIdentity: 'page-source', destinationPageIdentity: 'page-destination',
  routeRevision: 1, renderedRoute: '/deposit/products' as const,
  viewportWidth: 1280, viewportHeight: 720, devicePixelRatio: 1
};

function response(overrides: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ success: true, errorCode: null, message: null, data: {
    sessionId: 'session-1', requestId: 'page-ready-request-1', navigationId: 'navigation-1',
    browserBindingId: 'binding-1', sourcePageIdentity: 'page-source',
    pageIdentity: 'page-destination', routeRevision: 1, renderedRoute: '/deposit/products',
    status: 'PAGE_READY_ACCEPTED', message: '화면 준비 상태가 접수되었습니다.', ...overrides
  } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

describe('browser page-ready HTTP client', () => {
  it('production endpoint에 세 identity header와 DTO를 한 번 전송한다', async () => {
    const fetcher = vi.fn().mockResolvedValue(response());
    const controller = new AbortController();
    await createNavigationHttpClient('http://127.0.0.1:8080/', fetcher)
      .pageReady(binding, request, controller.signal);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(
      'http://127.0.0.1:8080/api/v1/sessions/session-1/browser-bindings/page-ready',
      expect.objectContaining({
        method: 'POST', body: JSON.stringify(request), signal: controller.signal,
        headers: expect.objectContaining({
          'X-DDD-Bridge-Token': 'memory-token',
          'X-DDD-Browser-Binding-Id': 'binding-1',
          'X-DDD-Page-Identity': 'page-source'
        })
      })
    );
  });

  it('foreign ACK를 차단하고 자동 retry하지 않는다', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ pageIdentity: 'foreign-page' }));
    await expect(createNavigationHttpClient('http://127.0.0.1:8080', fetcher)
      .pageReady(binding, request, new AbortController().signal))
      .rejects.toThrow('INVALID_PAGE_READY_ACK');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
