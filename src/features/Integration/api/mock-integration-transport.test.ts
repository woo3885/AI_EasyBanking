import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IntegrationTransportEvent } from './integration-transport';
import { createMockIntegrationTransport } from './mock-integration-transport';

describe('createMockIntegrationTransport', () => {
  const fetchSpy = vi.fn();
  const webSocketSpy = vi.fn();
  const timerSpy = vi.fn();
  let storageSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('WebSocket', webSocketSpy);
    vi.stubGlobal('setTimeout', timerSpy);
    storageSpy = vi.spyOn(Storage.prototype, 'setItem');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('subscribe만으로 callback을 호출하지 않는다', () => {
    const transport = createMockIntegrationTransport();
    const listener = vi.fn();

    transport.subscribe(listener);

    expect(listener).not.toHaveBeenCalled();
  });

  it('계좌 scenario 시작 후 결정론적인 event 순서를 전달한다', () => {
    const transport = createMockIntegrationTransport();
    const events: IntegrationTransportEvent[] = [];
    transport.subscribe((event) => events.push(event));

    transport.startScenario('TRANSFER_ACCOUNT_SELECTION');

    expect(events.map((event) => event.type)).toEqual([
      'MOCK_SESSION_STARTED',
      'MOCK_WORKFLOW_STATUS_RECEIVED',
      'MOCK_FRAME_RECEIVED',
      'MOCK_TARGET_RECEIVED',
      'MOCK_SINGLE_DECISION_REQUEST_RECEIVED'
    ]);
    expect(events.every((event) => event.runId === 1)).toBe(true);
  });

  it('명시적인 Mock session ID와 USER_DECISION_REQUIRED를 사용한다', () => {
    const transport = createMockIntegrationTransport();
    const events: IntegrationTransportEvent[] = [];
    transport.subscribe((event) => events.push(event));

    transport.startScenario('TRANSFER_ACCOUNT_SELECTION');

    expect(events[0]).toMatchObject({
      type: 'MOCK_SESSION_STARTED',
      mockSessionId: 'mock-integration-d16-001'
    });
    expect(events[1]).toMatchObject({
      type: 'MOCK_WORKFLOW_STATUS_RECEIVED',
      workflowStatus: 'USER_DECISION_REQUIRED'
    });
  });

  it('실행 중 중복 start를 무시한다', () => {
    const transport = createMockIntegrationTransport();
    const listener = vi.fn();
    transport.subscribe(listener);

    transport.startScenario('TRANSFER_ACCOUNT_SELECTION');
    transport.startScenario('DEPOSIT_TERMS_AGREEMENT');

    expect(listener).toHaveBeenCalledTimes(5);
  });

  it('검증된 계좌 확인 후 recipient 단계 event와 baseline을 전달한다', () => {
    const transport = createMockIntegrationTransport();
    const events: IntegrationTransportEvent[] = [];
    transport.subscribe((event) => events.push(event));
    transport.startScenario('TRANSFER_ACCOUNT_SELECTION');

    transport.submitSingleDecision('living-expense');

    expect(events.slice(5).map((event) => event.type)).toEqual([
      'MOCK_SINGLE_DECISION_CONFIRM_ACKNOWLEDGED',
      'MOCK_RECIPIENT_PHASE_ENTERED',
      'MOCK_WORKFLOW_STATUS_RECEIVED',
      'MOCK_FRAME_RECEIVED',
      'MOCK_TARGET_RECEIVED',
      'MOCK_SINGLE_DECISION_REQUEST_RECEIVED',
      'MOCK_BASELINE_REACHED'
    ]);
    expect(events[events.length - 1]).toMatchObject({
      type: 'MOCK_BASELINE_REACHED',
      guideMessage: expect.stringContaining('기준 시나리오 도달')
    });
  });

  it('저축 계좌도 검증 후 recipient 단계로 이동한다', () => {
    const transport = createMockIntegrationTransport();
    const events: IntegrationTransportEvent[] = [];
    transport.subscribe((event) => events.push(event));
    transport.startScenario('TRANSFER_ACCOUNT_SELECTION');

    transport.submitSingleDecision('savings');

    expect(events).toContainEqual(
      expect.objectContaining({ type: 'MOCK_RECIPIENT_PHASE_ENTERED' })
    );
  });

  it('unknown option은 차단하고 안전한 오류만 전달한다', () => {
    const transport = createMockIntegrationTransport();
    const events: IntegrationTransportEvent[] = [];
    transport.subscribe((event) => events.push(event));
    transport.startScenario('TRANSFER_ACCOUNT_SELECTION');

    transport.submitSingleDecision('unknown-option');

    expect(events[events.length - 1]).toMatchObject({
      type: 'MOCK_SAFE_ERROR',
      safeMessage: expect.stringContaining('Mock 선택 요청')
    });
    expect(events.some((event) => event.type === 'MOCK_RECIPIENT_PHASE_ENTERED')).toBe(false);
  });

  it('약관 scenario는 약관 request까지만 전달한다', () => {
    const transport = createMockIntegrationTransport();
    const events: IntegrationTransportEvent[] = [];
    transport.subscribe((event) => events.push(event));

    transport.startScenario('DEPOSIT_TERMS_AGREEMENT');

    expect(events.map((event) => event.type)).toEqual([
      'MOCK_SESSION_STARTED',
      'MOCK_WORKFLOW_STATUS_RECEIVED',
      'MOCK_TERMS_REQUEST_RECEIVED'
    ]);
  });

  it('필수 약관을 포함한 확인 callback만 기록한다', () => {
    const transport = createMockIntegrationTransport();
    const events: IntegrationTransportEvent[] = [];
    transport.subscribe((event) => events.push(event));
    transport.startScenario('DEPOSIT_TERMS_AGREEMENT');

    transport.submitTermsAgreement([
      'service-agreement',
      'personal-information'
    ]);

    expect(events[events.length - 1]).toMatchObject({
      type: 'MOCK_TERMS_CONFIRM_ACKNOWLEDGED',
      message: expect.stringContaining('Mock 약관 선택 확인 callback')
    });
  });

  it('필수 약관 누락과 unknown 약관을 안전하게 차단한다', () => {
    const transport = createMockIntegrationTransport();
    const events: IntegrationTransportEvent[] = [];
    transport.subscribe((event) => events.push(event));
    transport.startScenario('DEPOSIT_TERMS_AGREEMENT');

    transport.submitTermsAgreement(['service-agreement']);
    expect(events[events.length - 1]?.type).toBe('MOCK_SAFE_ERROR');

    transport.submitTermsAgreement([
      'service-agreement',
      'personal-information',
      'unknown-term'
    ]);
    expect(events[events.length - 1]?.type).toBe('MOCK_SAFE_ERROR');
  });

  it('stop을 여러 번 호출해도 안전하고 이후 callback이 없다', () => {
    const transport = createMockIntegrationTransport();
    const listener = vi.fn();
    transport.subscribe(listener);
    transport.startScenario('TRANSFER_ACCOUNT_SELECTION');
    listener.mockClear();

    transport.stop();
    transport.stop();
    transport.submitSingleDecision('living-expense');

    expect(listener).not.toHaveBeenCalled();
  });

  it('unsubscribe 이후 callback을 전달하지 않는다', () => {
    const transport = createMockIntegrationTransport();
    const listener = vi.fn();
    const unsubscribe = transport.subscribe(listener);
    unsubscribe();
    unsubscribe();

    transport.startScenario('TRANSFER_ACCOUNT_SELECTION');

    expect(listener).not.toHaveBeenCalled();
  });

  it('stop 후 새 실행은 증가한 runId를 사용한다', () => {
    const transport = createMockIntegrationTransport();
    const events: IntegrationTransportEvent[] = [];
    transport.subscribe((event) => events.push(event));
    transport.startScenario('TRANSFER_ACCOUNT_SELECTION');
    transport.stop();

    transport.startScenario('DEPOSIT_TERMS_AGREEMENT');

    expect(events[events.length - 3]).toMatchObject({
      type: 'MOCK_SESSION_STARTED',
      runId: 2
    });
  });

  it('네트워크·WebSocket·storage·timer를 사용하지 않는다', () => {
    const transport = createMockIntegrationTransport();
    const unsubscribe = transport.subscribe(() => undefined);

    transport.startScenario('TRANSFER_ACCOUNT_SELECTION');
    transport.submitSingleDecision('living-expense');
    transport.stop();
    unsubscribe();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(webSocketSpy).not.toHaveBeenCalled();
    expect(storageSpy).not.toHaveBeenCalled();
    expect(timerSpy).not.toHaveBeenCalled();
  });
});
