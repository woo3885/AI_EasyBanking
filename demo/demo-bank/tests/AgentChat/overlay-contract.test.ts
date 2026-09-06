import { describe, expect, it } from 'vitest';

import {
  parseBridgeRecovery,
  parseOverlayClearEvent,
  parseOverlayTargetEvent,
  parsePublicOverlayTarget,
  parseUserActionObservedEvent,
  isProtocolIdentifier
} from '../../src/features/AgentChat/api/overlay-contract';

const now = Date.parse('2026-09-06T12:00:30Z');
const context = {
  sessionId: 'session-1', pageIdentity: 'page-1',
  viewport: { width: 1280, height: 720 }, now
};

const target = {
  contractVersion: 2, materializationMode: 'USER_DOM_PUBLIC_TARGET',
  targetId: 'target-1', sessionId: 'session-1', pageIdentity: 'page-1',
  sourceSnapshotId: 'snap-1', coordinateSpace: 'VIEWPORT_CSS_PX',
  rectangle: { x: 120, y: 240, width: 180, height: 56 },
  viewport: { width: 1280, height: 720 }, role: 'button',
  label: '12개월 상품 선택', guide: '이 버튼을 직접 눌러 주세요.',
  locator: { type: 'PUBLIC_TARGET_KEY', publicTargetKey: 'deposit-product-12m-select',
    role: 'button', accessibleName: '12개월 상품 선택' },
  actionMode: 'GUIDE_USER_CLICK', createdAt: '2026-09-06T12:00:00Z',
  expiresAt: '2026-09-06T12:01:00Z', consumedAt: null
};

const overlayEvent = {
  eventId: 'event-1', eventSequence: 10, eventType: 'OVERLAY_TARGET',
  sessionId: 'session-1', workflowStatus: 'USER_DECISION_REQUIRED',
  contractVersion: 2, materializationMode: 'USER_DOM_PUBLIC_TARGET',
  targetId: 'target-1', pageIdentity: 'page-1', sourceSnapshotId: 'snap-1',
  coordinateSpace: 'VIEWPORT_CSS_PX', rectangle: target.rectangle, viewport: target.viewport,
  role: 'button', label: target.label, guide: target.guide,
  locator: target.locator,
  actionMode: 'GUIDE_USER_CLICK', expiresAt: target.expiresAt,
  occurredAt: target.createdAt
};

describe('same-page Overlay runtime contract', () => {
  it('Backend ObjectMapper OVERLAY_TARGET fixture를 파싱한다', () => {
    expect(parseOverlayTargetEvent(overlayEvent, context)).toMatchObject({
      targetId: 'target-1', coordinateSpace: 'VIEWPORT_CSS_PX',
      rectangle: { x: 120, y: 240, width: 180, height: 56 }
    });
  });

  it('OVERLAY_CLEAR와 USER_ACTION_OBSERVED fixture를 파싱한다', () => {
    expect(parseOverlayClearEvent({ eventId: 'event-2', eventSequence: 11,
      eventType: 'OVERLAY_CLEAR', sessionId: 'session-1', targetId: 'target-1',
      pageIdentity: 'page-1', sourceSnapshotId: 'snap-1',
      publicTargetKey: 'deposit-product-12m-select', reason: 'USER_ACTION',
      occurredAt: '2026-09-06T12:00:31Z' }, context)).toMatchObject({ reason: 'USER_ACTION' });
    expect(parseUserActionObservedEvent({ eventId: 'event-3', eventSequence: 12,
      eventType: 'USER_ACTION_OBSERVED', sessionId: 'session-1', workflowStatus: 'AI_EXECUTING',
      observationId: 'observation-1', requestId: 'request-1', targetId: 'target-1',
      pageIdentity: 'page-1', sourceSnapshotId: 'snap-1',
      publicTargetKey: 'deposit-product-12m-select', resultingSnapshotId: 'snap-2',
      status: 'DOM_CHANGE_CONFIRMED', occurredAt: '2026-09-06T12:00:32Z' }, context))
      .toMatchObject({ requestId: 'request-1', status: 'DOM_CHANGE_CONFIRMED' });
  });

  it('raw selector·unknown field와 malformed 좌표를 fail-closed 처리한다', () => {
    expect(parseOverlayTargetEvent({ ...overlayEvent, selector: '#secret' }, context)).toBeNull();
    expect(parseOverlayTargetEvent({ ...overlayEvent,
      rectangle: { ...target.rectangle, width: 0 } }, context)).toBeNull();
    expect(parseOverlayTargetEvent({ ...overlayEvent,
      rectangle: { ...target.rectangle, x: Number.NaN } }, context)).toBeNull();
  });

  it('v2 사용자 DOM target은 Backend rectangle과 사용자 viewport 차이를 좌표로 사용하지 않는다', () => {
    expect(parseOverlayTargetEvent({
      ...overlayEvent,
      rectangle: { x: 10, y: 900, width: 180, height: 56 },
      viewport: { width: 1280, height: 720 }
    }, context)).not.toBeNull();
  });

  it('v1 rectangle target과 unknown materialization mode를 사용자 browser에서 거절한다', () => {
    const legacy = {
      ...overlayEvent,
      contractVersion: 1,
      materializationMode: 'BACKEND_VIEWPORT_RECT'
    } as Record<string, unknown>;
    delete legacy.locator;
    expect(parseOverlayTargetEvent(legacy, context)).toBeNull();
    expect(parseOverlayTargetEvent({ ...overlayEvent, materializationMode: 'UNKNOWN' }, context)).toBeNull();
    expect(parseOverlayTargetEvent({ ...overlayEvent,
      locator: { ...target.locator, publicTargetKey: 'deposit-selector-token' } }, context)).toBeNull();
  });

  it('숫자 그룹 UUID identity를 민감정보 문구 검사와 분리해 허용한다', () => {
    const numericSessionId = '11111111-2222-3333-4444-555555555555';
    expect(parseOverlayTargetEvent({
      ...overlayEvent,
      sessionId: numericSessionId
    }, { ...context, sessionId: numericSessionId })).not.toBeNull();
    expect(isProtocolIdentifier('bad/id')).toBe(false);
    expect(isProtocolIdentifier(`id-${'a'.repeat(129)}`)).toBe(false);
    expect(isProtocolIdentifier('id\ncontrol')).toBe(false);
    expect(parseOverlayTargetEvent({ ...overlayEvent, label: 'otp=123456' }, context)).toBeNull();
  });

  it('만료·다른 session/page target을 거절한다', () => {
    expect(parseOverlayTargetEvent({ ...overlayEvent, expiresAt: '2026-09-06T12:00:00Z' }, context)).toBeNull();
    expect(parseOverlayTargetEvent({ ...overlayEvent, sessionId: 'foreign' }, context)).toBeNull();
    expect(parseOverlayTargetEvent({ ...overlayEvent, pageIdentity: 'page-2' }, context)).toBeNull();
  });

  it('bridge의 optional active target을 identity와 함께 복원한다', () => {
    const binding = { sessionId: 'session-1', browserBindingId: 'binding-1', bridgeToken: 'token-1',
      pageIdentity: 'page-1', expiresAt: '2099-01-01T00:00:00Z',
      recoveryPath: '/api/v1/sessions/session-1/conversation/bridge', pageReadyStatus: 'READY' as const };
    const payload = { success: true, data: { sessionId: 'session-1', pageIdentity: 'page-1',
      eventSubscription: '/topic/sessions/session-1/events',
      conversationSnapshotPath: '/api/v1/sessions/session-1/conversation',
      expiresAt: '2026-09-06T13:00:00Z', activeTarget: target }, message: null, errorCode: null };
    expect(parseBridgeRecovery(payload, binding, context.viewport, now)?.activeTarget)
      .toMatchObject({ targetId: 'target-1' });
    expect(parsePublicOverlayTarget({ ...target, elementId: 'internal' }, context)).toBeNull();
  });

  it('accepts a bridge fixture that omits a null activeTarget', () => {
    const binding = { sessionId: 'session-1', browserBindingId: 'binding-1', bridgeToken: 'token-1',
      pageIdentity: 'page-1', expiresAt: '2099-01-01T00:00:00Z',
      recoveryPath: '/api/v1/sessions/session-1/conversation/bridge', pageReadyStatus: 'READY' as const };
    const payload = { success: true, data: { sessionId: 'session-1', pageIdentity: 'page-1',
      eventSubscription: '/topic/sessions/session-1/events',
      conversationSnapshotPath: '/api/v1/sessions/session-1/conversation',
      expiresAt: '2026-09-06T13:00:00Z' }, message: null, errorCode: null };
    expect(parseBridgeRecovery(payload, binding, context.viewport, now)?.activeTarget).toBeNull();
  });
});
