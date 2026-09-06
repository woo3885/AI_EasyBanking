import { describe, expect, it } from 'vitest';

import {
  isAllowedBrowserNavigationRoute,
  parseBrowserBridgeBinding,
  parseNavigationServerEvent,
  parsePageReadyAccepted
} from '../../src/features/AgentChat/api/navigation-contract';

const binding = {
  sessionId: 'session-1',
  browserBindingId: 'binding-1',
  bridgeToken: 'token-1',
  pageIdentity: 'page-source',
  expiresAt: '2099-01-01T00:00:00Z',
  recoveryPath: '/api/v1/sessions/session-1/conversation/bridge',
  pageReadyStatus: 'READY' as const
};

const navigation = {
  eventId: 'event-navigation-1', eventSequence: 3, eventType: 'NAVIGATION_REQUIRED',
  sessionId: 'session-1', navigationId: 'navigation-1', browserBindingId: 'binding-1',
  sourcePageIdentity: 'page-source', destinationPageIdentity: 'page-destination',
  destinationRoute: '/deposit/products', routeRevision: 2, navigationMode: 'SPA_PUSH',
  expiresAt: '2099-01-01T00:00:00Z', guide: '예금 상품을 직접 선택해 주세요.',
  occurredAt: '2026-09-07T00:00:00Z'
};

const context = {
  sessionId: 'session-1', browserBindingId: 'binding-1', pageIdentity: 'page-source',
  now: Date.parse('2026-09-07T00:00:00Z')
};

describe('browser navigation runtime contract', () => {
  it('최초 ACK의 bridgeBinding을 정확한 identity와 만료 기준으로 검증한다', () => {
    expect(parseBrowserBridgeBinding(binding, 'session-1', context.now)).toEqual(binding);
    expect(parseBrowserBridgeBinding({ ...binding, sessionId: 'foreign' }, 'session-1', context.now)).toBeNull();
    expect(parseBrowserBridgeBinding({ ...binding, expiresAt: '2026-09-06T00:00:00Z' }, 'session-1', context.now)).toBeNull();
    expect(parseBrowserBridgeBinding({ ...binding, selector: '#secret' }, 'session-1', context.now)).toBeNull();
  });

  it('NAVIGATION_REQUIRED를 strict parser로 검증한다', () => {
    expect(parseNavigationServerEvent(navigation, context)).toMatchObject({
      navigationId: 'navigation-1', destinationRoute: '/deposit/products',
      sourcePageIdentity: 'page-source', destinationPageIdentity: 'page-destination'
    });
    expect(parseNavigationServerEvent({ ...navigation, browserBindingId: 'foreign' }, context)).toBeNull();
    expect(parseNavigationServerEvent({ ...navigation, expiresAt: '2026-09-06T00:00:00Z' }, context)).toBeNull();
    expect(parseNavigationServerEvent({ ...navigation, selector: '#target' }, context)).toBeNull();
  });

  it.each([
    'https://evil.example/deposit/products',
    '//evil.example/deposit/products',
    '/deposit/products?token=value',
    '/deposit/products#target',
    '/deposit/../transfer/accounts',
    '/deposit\\products',
    '/unknown'
  ])('외부·query·fragment·traversal route %s를 차단한다', (route) => {
    expect(isAllowedBrowserNavigationRoute(route)).toBe(false);
    expect(parseNavigationServerEvent({ ...navigation, destinationRoute: route }, context)).toBeNull();
  });

  it('PAGE_READY_OBSERVED와 resume failure를 안전한 필드만 파싱한다', () => {
    expect(parseNavigationServerEvent({
      eventId: 'event-ready-1', eventSequence: 4, eventType: 'PAGE_READY_OBSERVED',
      sessionId: 'session-1', navigationId: 'navigation-1', browserBindingId: 'binding-1',
      sourcePageIdentity: 'page-source', pageIdentity: 'page-destination', routeRevision: 2,
      occurredAt: '2026-09-07T00:00:01Z'
    }, context)).toMatchObject({ eventType: 'PAGE_READY_OBSERVED', pageIdentity: 'page-destination' });
    expect(parseNavigationServerEvent({
      eventId: 'event-failed-1', eventSequence: 5, eventType: 'PAGE_READY_RESUME_FAILED',
      sessionId: 'session-1', navigationId: 'navigation-1',
      errorCode: 'OVERLAY_TARGET_NOT_FOUND',
      message: '화면 이동은 접수되었지만 다음 안내를 안전하게 준비하지 못했습니다.',
      occurredAt: '2026-09-07T00:00:02Z'
    }, context)).toMatchObject({ eventType: 'PAGE_READY_RESUME_FAILED' });
  });

  it('page-ready HTTP ACK identity를 모두 대조한다', () => {
    const request = {
      requestId: 'page-ready-request-1', navigationId: 'navigation-1',
      sourcePageIdentity: 'page-source', destinationPageIdentity: 'page-destination',
      routeRevision: 2, renderedRoute: '/deposit/products' as const,
      viewportWidth: 1280, viewportHeight: 720, devicePixelRatio: 1
    };
    const payload = { success: true, errorCode: null, message: null, data: {
      sessionId: 'session-1', requestId: 'page-ready-request-1', navigationId: 'navigation-1',
      browserBindingId: 'binding-1', sourcePageIdentity: 'page-source',
      pageIdentity: 'page-destination', routeRevision: 2, renderedRoute: '/deposit/products',
      status: 'PAGE_READY_ACCEPTED', message: '화면 준비 상태가 접수되었습니다.'
    } };
    expect(parsePageReadyAccepted(payload, binding, request)).toMatchObject({
      status: 'PAGE_READY_ACCEPTED', pageIdentity: 'page-destination'
    });
    expect(parsePageReadyAccepted({ ...payload, data: { ...payload.data, navigationId: 'other' } }, binding, request))
      .toBeNull();
  });
});
