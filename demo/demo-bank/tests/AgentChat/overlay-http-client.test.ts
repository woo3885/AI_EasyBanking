import { describe, expect, it, vi } from 'vitest';

import { createOverlayHttpClient } from '../../src/features/AgentChat/api/overlay-http-client';

const binding = { sessionId: 'session-1', bridgeToken: 'bridge-secret', pageIdentity: 'page-1' };

function response(data: unknown, status: number) {
  return new Response(JSON.stringify({ success: true, data, message: '접수', errorCode: null }), {
    status, headers: { 'Content-Type': 'application/json' }
  });
}

describe('Overlay HTTP client', () => {
  it('bridge identity header로 recovery endpoint를 조회한다', async () => {
    const fetcher = vi.fn(async () => response({ sessionId: 'session-1', pageIdentity: 'page-1',
      eventSubscription: '/topic/sessions/session-1/events',
      conversationSnapshotPath: '/api/v1/sessions/session-1/conversation',
      expiresAt: '2099-01-01T00:00:00Z', activeTarget: null }, 200));
    await createOverlayHttpClient('http://127.0.0.1:8080', fetcher).recoverBridge(
      binding, { width: 1280, height: 720 }, new AbortController().signal
    );
    expect(fetcher).toHaveBeenCalledWith(
      'http://127.0.0.1:8080/api/v1/sessions/session-1/conversation/bridge',
      expect.objectContaining({ headers: expect.objectContaining({
        'X-DDD-Bridge-Token': 'bridge-secret', 'X-DDD-Page-Identity': 'page-1'
      }) })
    );
  });

  it('click observation request를 직렬화하고 202 identity를 검증한다', async () => {
    const request = { requestId: 'request-1', targetId: 'target-1', sourceSnapshotId: 'snap-1',
      observationType: 'USER_CLICK' as const, clientOccurredAt: '2026-09-06T12:00:00Z' };
    const fetcher = vi.fn(async () => response({ sessionId: 'session-1', requestId: 'request-1',
      targetId: 'target-1', pageIdentity: 'page-1', sourceSnapshotId: 'snap-1',
      status: 'OBSERVATION_ACCEPTED', acceptedAt: '2026-09-06T12:00:01Z' }, 202));
    await createOverlayHttpClient('http://127.0.0.1:8080', fetcher)
      .observeClick(binding, request, new AbortController().signal);
    const options = fetcher.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(options.body))).toEqual(request);
    expect(options.headers).toEqual(expect.objectContaining({
      'X-DDD-Bridge-Token': 'bridge-secret', 'X-DDD-Page-Identity': 'page-1'
    }));
  });

  it('ACK identity mismatch를 거절하고 자동 재시도하지 않는다', async () => {
    const fetcher = vi.fn(async () => response({ sessionId: 'session-1', requestId: 'other',
      targetId: 'target-1', pageIdentity: 'page-1', sourceSnapshotId: 'snap-1',
      status: 'OBSERVATION_ACCEPTED', acceptedAt: '2026-09-06T12:00:01Z' }, 202));
    await expect(createOverlayHttpClient('http://127.0.0.1:8080', fetcher).observeClick(binding, {
      requestId: 'request-1', targetId: 'target-1', sourceSnapshotId: 'snap-1',
      observationType: 'USER_CLICK', clientOccurredAt: '2026-09-06T12:00:00Z'
    }, new AbortController().signal)).rejects.toThrow('INVALID_OBSERVATION_ACK');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
