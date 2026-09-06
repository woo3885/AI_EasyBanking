import { describe, expect, it, vi } from 'vitest';

import {
  SESSION_STATUS_HEARTBEAT_MS,
  createSessionStatusTransport,
  createSessionStatusWebSocketUrl,
  sanitizeSessionMessage,
  validateSessionUiEvent,
  validateSessionUiSnapshot,
  type SessionDecisionType,
  type SessionStatusStompConfig,
  type SessionStatusTransportEvent,
  type SessionUiEvent
} from './session-status-transport';

const SESSION_ID = 'session-001';

function stateEvent(sequence = 1): SessionUiEvent {
  return {
    eventId: `evt-${sequence}`,
    eventSequence: sequence,
    eventType: 'STATE',
    sessionId: SESSION_ID,
    status: 'AI_EXECUTING',
    message: 'AI가 다음 행동을 판단하고 있습니다.',
    actionRequired: false,
    target: null,
    decision: null,
    secureInput: null,
    confirmation: null,
    occurredAt: '2026-08-19T12:00:00Z'
  };
}

function targetEvent(sequence = 2): SessionUiEvent {
  return {
    eventId: `evt-${sequence}`,
    eventSequence: sequence,
    eventType: 'TARGET',
    sessionId: SESSION_ID,
    status: null,
    message: '예금 상품을 확인해 주세요.',
    actionRequired: false,
    target: {
      elementId: 'el-target-001',
      label: '예금 상품 선택',
      x: 100,
      y: 120,
      width: 200,
      height: 60,
      frameId: 'frm-001',
      frameSequence: 3,
      snapshotId: 'snap-001'
    },
    decision: null,
    secureInput: null,
    confirmation: null,
    occurredAt: '2026-08-19T12:00:01Z'
  };
}

function decisionEvent(
  decisionType: SessionDecisionType = 'PRODUCT_SELECTION',
  sequence = 3
): SessionUiEvent {
  return {
    eventId: `evt-${sequence}`,
    eventSequence: sequence,
    eventType: 'DECISION_REQUIRED',
    sessionId: SESSION_ID,
    status: null,
    message: '직접 선택해 주세요.',
    actionRequired: true,
    target: null,
    decision: {
      requestId: 'req-001',
      decisionId: 'dec-001',
      decisionType,
      options: [
        {
          id: 'el-option-001',
          label: '안전한 선택 항목',
          required: decisionType === 'TERMS_AGREEMENT',
          checked: false,
          disabled: false
        }
      ],
      frameId: 'frm-001',
      frameSequence: 3,
      sourceSnapshotId: 'snap-001'
    },
    secureInput: null,
    confirmation: null,
    occurredAt: '2026-08-19T12:00:02Z'
  };
}

function secureInputEvent(sequence = 4): SessionUiEvent {
  return {
    eventId: `evt-${sequence}`,
    eventSequence: sequence,
    eventType: 'SECURE_INPUT_REQUIRED',
    sessionId: SESSION_ID,
    status: 'SECURE_INPUT_REQUIRED',
    message: '보안 정보를 원격 화면에서 직접 입력해 주세요.',
    actionRequired: true,
    target: null,
    decision: null,
    secureInput: {
      secureRequestId: 'secure-request-001',
      secureInputType: 'ACCOUNT_PASSWORD',
      frameId: 'frm-001',
      frameSequence: 3,
      message: '보안 정보를 원격 화면에서 직접 입력해 주세요.'
    },
    confirmation: null,
    occurredAt: '2026-08-19T12:00:03Z'
  };
}

function confirmationEvent(
  eventType: Extract<
    SessionUiEvent['eventType'],
    | 'CONFIRMATION_REQUIRED'
    | 'CONFIRMATION_RESOLVED'
    | 'CONFIRMATION_REJECTED'
    | 'CONFIRMATION_CLEAR'
  > = 'CONFIRMATION_REQUIRED',
  sequence = 5
): SessionUiEvent {
  const required = eventType === 'CONFIRMATION_REQUIRED';
  return {
    eventId: `evt-${sequence}`,
    eventSequence: sequence,
    eventType,
    sessionId: SESSION_ID,
    status: required
      ? 'FINAL_CONFIRMATION_REQUIRED'
      : eventType === 'CONFIRMATION_RESOLVED'
        ? 'PAGE_LOADING'
        : eventType === 'CONFIRMATION_REJECTED'
          ? 'CANCELLED'
          : null,
    message: required
      ? '예금 가입 전 최종 확인이 필요합니다.'
      : '최종 확인 요청이 정리되었습니다.',
    actionRequired: required,
    target: null,
    decision: null,
    secureInput: null,
    confirmation: {
      confirmationId: 'confirm-001',
      confirmationType: 'DEPOSIT_SUBSCRIPTION',
      sourceSnapshotId: 'snap-001',
      frameId: 'frm-001',
      frameSequence: 7,
      summary: required
        ? {
            transactionType: '정기예금 가입',
            items: [
              {
                id: 'product-name',
                label: '상품명',
                value: '12개월 정기예금'
              },
              {
                id: 'deposit-amount',
                label: '가입 금액',
                value: '1,000,000원'
              },
              {
                id: 'deposit-period',
                label: '가입 기간',
                value: '12개월'
              }
            ]
          }
        : null
    },
    occurredAt: '2026-08-27T00:00:00Z'
  };
}

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('session-status-transport', () => {
  it('Backend base URL과 같은 host의 /ws URL만 만든다', () => {
    expect(createSessionStatusWebSocketUrl('http://127.0.0.1:8080')).toBe(
      'ws://127.0.0.1:8080/ws'
    );
    expect(createSessionStatusWebSocketUrl('https://backend.example.com')).toBe(
      'wss://backend.example.com/ws'
    );
    expect(() =>
      createSessionStatusWebSocketUrl('http://user@127.0.0.1:8080?token=x')
    ).toThrow();
  });

  it('실제 topic과 10초 heartbeat로 구독한 뒤 snapshot과 buffered event를 순서대로 적용한다', async () => {
    const pendingSnapshot = deferred<Response>();
    const events: SessionStatusTransportEvent[] = [];
    let config!: SessionStatusStompConfig;
    let messageCallback!: (message: { body: string }) => void;
    const unsubscribe = vi.fn();
    const deactivate = vi.fn();
    const subscribe = vi.fn((destination, callback) => {
      expect(destination).toBe(`/topic/sessions/${SESSION_ID}/events`);
      messageCallback = callback;
      return { unsubscribe };
    });
    const transport = createSessionStatusTransport({
      sessionId: SESSION_ID,
      fetchImpl: vi.fn(() => pendingSnapshot.promise),
      stompClientFactory: (nextConfig) => {
        config = nextConfig;
        return { activate: vi.fn(), deactivate, subscribe };
      }
    });
    transport.subscribe((event) => events.push(event));
    transport.connect();

    expect(config.brokerURL).toBe('ws://127.0.0.1:8080/ws');
    expect(config.heartbeatIncoming).toBe(SESSION_STATUS_HEARTBEAT_MS);
    expect(config.heartbeatOutgoing).toBe(SESSION_STATUS_HEARTBEAT_MS);
    config.onConnect();
    messageCallback({ body: JSON.stringify(targetEvent(2)) });

    pendingSnapshot.resolve(
      jsonResponse({
        sessionId: SESSION_ID,
        latestEventSequence: 1,
        state: stateEvent(1),
        guide: null,
        target: null,
        decision: null,
        secureInput: null,
        confirmation: null
      })
    );
    await vi.waitFor(() => {
      expect(events.map((event) => event.type)).toEqual([
        'SYNC_STARTED',
        'SNAPSHOT_RECEIVED',
        'EVENT_RECEIVED',
        'CONNECTED'
      ]);
    });
    expect(
      events.find((event) => event.type === 'EVENT_RECEIVED')
    ).toMatchObject({ event: { eventSequence: 2 } });

    transport.disconnect();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(deactivate).toHaveBeenCalledTimes(1);
  });

  it('snapshot 이하 buffered duplicate는 적용하지 않는다', async () => {
    const pendingSnapshot = deferred<Response>();
    const events: SessionStatusTransportEvent[] = [];
    let config!: SessionStatusStompConfig;
    let messageCallback!: (message: { body: string }) => void;
    const transport = createSessionStatusTransport({
      sessionId: SESSION_ID,
      fetchImpl: () => pendingSnapshot.promise,
      stompClientFactory: (nextConfig) => {
        config = nextConfig;
        return {
          activate: vi.fn(),
          deactivate: vi.fn(),
          subscribe: (_destination, callback) => {
            messageCallback = callback;
            return { unsubscribe: vi.fn() };
          }
        };
      }
    });
    transport.subscribe((event) => events.push(event));
    transport.connect();
    config.onConnect();
    messageCallback({ body: JSON.stringify(stateEvent(1)) });
    messageCallback({ body: JSON.stringify(targetEvent(2)) });
    messageCallback({ body: JSON.stringify(targetEvent(2)) });
    pendingSnapshot.resolve(
      jsonResponse({
        sessionId: SESSION_ID,
        latestEventSequence: 1,
        state: stateEvent(1),
        guide: null,
        target: null,
        decision: null,
        secureInput: null,
        confirmation: null
      })
    );

    await vi.waitFor(() =>
      expect(events.filter((event) => event.type === 'EVENT_RECEIVED')).toHaveLength(1)
    );
  });

  it('session mismatch와 unknown event를 fail-closed 처리한다', () => {
    expect(() =>
      validateSessionUiEvent(
        { ...stateEvent(), sessionId: 'session-other' },
        SESSION_ID
      )
    ).toThrow('실시간 상태 정보를 안전하게 확인할 수 없습니다.');
    expect(() =>
      validateSessionUiEvent(
        { ...stateEvent(), eventType: 'UNKNOWN' },
        SESSION_ID
      )
    ).toThrow('실시간 상태 정보를 안전하게 확인할 수 없습니다.');
  });

  it.each([
    'PRODUCT_SELECTION',
    'SOURCE_ACCOUNT_SELECTION',
    'RECIPIENT_SELECTION',
    'TERMS_AGREEMENT'
  ] as const)('%s DECISION_REQUIRED payload를 검증한다', (decisionType) => {
    const event = validateSessionUiEvent(
      decisionEvent(decisionType),
      SESSION_ID
    );

    expect(event.decision).toMatchObject({
      decisionType,
      frameId: 'frm-001',
      frameSequence: 3,
      sourceSnapshotId: 'snap-001'
    });
  });

  it('DECISION_RESOLVED와 DECISION_CLEAR를 decision 없는 안전 이벤트로 받는다', () => {
    for (const eventType of ['DECISION_RESOLVED', 'DECISION_CLEAR'] as const) {
      const event = validateSessionUiEvent(
        {
          ...decisionEvent(),
          eventType,
          actionRequired: false,
          decision: null
        },
        SESSION_ID
      );
      expect(event.decision).toBeNull();
    }
  });

  it('latest snapshot의 active decision을 검증한다', () => {
    const decision = decisionEvent('TERMS_AGREEMENT', 4);
    const snapshot = validateSessionUiSnapshot(
      {
        sessionId: SESSION_ID,
        latestEventSequence: 4,
        state: stateEvent(1),
        guide: null,
        target: null,
        decision,
        secureInput: null,
        confirmation: null
      },
      SESSION_ID
    );
    expect(snapshot.decision?.decision).toEqual(decision.decision);
  });

  it('secure input required와 reconnect snapshot의 공개 metadata만 검증한다', () => {
    const secureInput = secureInputEvent();
    const validated = validateSessionUiEvent(secureInput, SESSION_ID);
    expect(validated.secureInput).toEqual(secureInput.secureInput);

    const snapshot = validateSessionUiSnapshot(
      {
        sessionId: SESSION_ID,
        latestEventSequence: 4,
        state: stateEvent(1),
        guide: null,
        target: null,
        decision: null,
        secureInput,
        confirmation: null
      },
      SESSION_ID
    );
    expect(snapshot.secureInput?.eventType).toBe('SECURE_INPUT_REQUIRED');
  });

  it.each([
    'CONFIRMATION_REQUIRED',
    'CONFIRMATION_RESOLVED',
    'CONFIRMATION_REJECTED',
    'CONFIRMATION_CLEAR'
  ] as const)('%s의 identity와 required summary를 검증한다', (eventType) => {
    const validated = validateSessionUiEvent(
      confirmationEvent(eventType),
      SESSION_ID
    );
    expect(validated.confirmation).toMatchObject({
      confirmationId: 'confirm-001',
      frameId: 'frm-001',
      frameSequence: 7
    });
    expect(validated.confirmation?.summary === null).toBe(
      eventType !== 'CONFIRMATION_REQUIRED'
    );
  });

  it('active confirmation을 snapshot에서 복원하고 순서를 보존한다', () => {
    const confirmation = confirmationEvent('CONFIRMATION_REQUIRED', 5);
    const snapshot = validateSessionUiSnapshot(
      {
        sessionId: SESSION_ID,
        latestEventSequence: 5,
        state: { ...stateEvent(4), status: 'FINAL_CONFIRMATION_REQUIRED' },
        guide: null,
        target: null,
        decision: null,
        secureInput: null,
        confirmation
      },
      SESSION_ID
    );
    expect(
      snapshot.confirmation?.confirmation?.summary?.items.map((item) => item.id)
    ).toEqual(['product-name', 'deposit-amount', 'deposit-period']);
  });

  it('malformed·민감·중복 summary와 unsupported type을 fail-closed한다', () => {
    const base = confirmationEvent();
    const summary = base.confirmation?.summary;
    const invalidConfirmations = [
      { ...base.confirmation, confirmationType: 'TRANSFER' },
      { ...base.confirmation, summary: { ...summary, items: [] } },
      {
        ...base.confirmation,
        summary: {
          ...summary,
          items: [
            { id: 'secret', label: '비밀번호', value: '1234' }
          ]
        }
      },
      {
        ...base.confirmation,
        summary: {
          ...summary,
          items: [
            { id: 'same', label: '항목', value: '안전한 값' },
            { id: 'same', label: '항목', value: '다른 값' }
          ]
        }
      }
    ];
    for (const confirmation of invalidConfirmations) {
      expect(() =>
        validateSessionUiEvent({ ...base, confirmation }, SESSION_ID)
      ).toThrow('실시간 상태 정보를 안전하게 확인할 수 없습니다.');
    }
  });

  it('secure input의 알 수 없는 type과 민감 message를 fail-closed 처리한다', () => {
    const base = secureInputEvent();
    expect(() =>
      validateSessionUiEvent(
        {
          ...base,
          secureInput: { ...base.secureInput, secureInputType: 'UNKNOWN' }
        },
        SESSION_ID
      )
    ).toThrow();
    const sanitized = validateSessionUiEvent(
      {
        ...base,
        secureInput: { ...base.secureInput, message: '안내 <b>변경</b>' }
      },
      SESSION_ID
    );
    expect(sanitized.secureInput?.message).not.toContain('<b>');
  });

  it('unknown type·빈 option·중복 ID·민감 label을 fail-closed 처리한다', () => {
    const base = decisionEvent();
    const invalidDecisions = [
      { ...base.decision, decisionType: 'ADDITIONAL_INFORMATION' },
      { ...base.decision, options: [] },
      {
        ...base.decision,
        options: [base.decision?.options[0], base.decision?.options[0]]
      },
      {
        ...base.decision,
        options: [
          { ...base.decision?.options[0], label: 'OTP 입력값' }
        ]
      }
    ];
    for (const decision of invalidDecisions) {
      expect(() =>
        validateSessionUiEvent({ ...base, decision }, SESSION_ID)
      ).toThrow('실시간 상태 정보를 안전하게 확인할 수 없습니다.');
    }
  });

  it('단일 선택에서 복수 checked와 boolean 이외 상태를 차단한다', () => {
    const base = decisionEvent();
    const option = base.decision?.options[0];
    expect(() =>
      validateSessionUiEvent(
        {
          ...base,
          decision: {
            ...base.decision,
            options: [
              { ...option, id: 'el-option-001', checked: true },
              { ...option, id: 'el-option-002', checked: true }
            ]
          }
        },
        SESSION_ID
      )
    ).toThrow();
    expect(() =>
      validateSessionUiEvent(
        {
          ...base,
          decision: {
            ...base.decision,
            options: [{ ...option, required: 'true' }]
          }
        },
        SESSION_ID
      )
    ).toThrow();
  });

  it('malformed JSON은 raw payload를 노출하지 않고 연결을 종료한다', () => {
    const events: SessionStatusTransportEvent[] = [];
    let config!: SessionStatusStompConfig;
    let messageCallback!: (message: { body: string }) => void;
    const deactivate = vi.fn();
    const transport = createSessionStatusTransport({
      sessionId: SESSION_ID,
      fetchImpl: vi.fn(() => new Promise<Response>(() => undefined)),
      stompClientFactory: (nextConfig) => {
        config = nextConfig;
        return {
          activate: vi.fn(),
          deactivate,
          subscribe: (_destination, callback) => {
            messageCallback = callback;
            return { unsubscribe: vi.fn() };
          }
        };
      }
    });
    transport.subscribe((event) => events.push(event));
    transport.connect();
    config.onConnect();
    messageCallback({ body: '{"eventId":"private"' });

    expect(events[events.length - 1]).toEqual({
      type: 'SAFE_ERROR',
      message: '실시간 상태 연결을 안전하게 처리하지 못했습니다.'
    });
    expect(JSON.stringify(events)).not.toContain('private');
    expect(deactivate).toHaveBeenCalledTimes(1);
  });

  it('HTML·민감정보·과도한 줄바꿈은 상태별 안전 문구로 대체한다', () => {
    const fallback = 'AI가 화면을 확인하고 다음 안내를 준비하고 있습니다.';
    expect(sanitizeSessionMessage('<script>alert(1)</script>', 'AI_EXECUTING')).toBe(
      fallback
    );
    expect(sanitizeSessionMessage('OTP: 123456', 'AI_EXECUTING')).toBe(fallback);
    expect(sanitizeSessionMessage('비밀번호: Abcd!234', 'AI_EXECUTING')).toBe(
      fallback
    );
    expect(sanitizeSessionMessage('첫째\n둘째\n셋째', 'AI_EXECUTING')).toBe(fallback);
    expect(sanitizeSessionMessage('  안전한 안내입니다.  ', 'AI_EXECUTING')).toBe(
      '안전한 안내입니다.'
    );
  });

  it('재연결 onConnect마다 새 snapshot을 조회해 resync한다', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({
          sessionId: SESSION_ID,
          latestEventSequence: 0,
          state: null,
          guide: null,
          target: null,
          decision: null,
          secureInput: null,
          confirmation: null
        })
      );
    const events: SessionStatusTransportEvent[] = [];
    let config!: SessionStatusStompConfig;
    const transport = createSessionStatusTransport({
      sessionId: SESSION_ID,
      fetchImpl,
      stompClientFactory: (nextConfig) => {
        config = nextConfig;
        return {
          activate: vi.fn(),
          deactivate: vi.fn(),
          subscribe: () => ({ unsubscribe: vi.fn() })
        };
      }
    });
    transport.subscribe((event) => events.push(event));
    transport.connect();
    config.onConnect();
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    config.onWebSocketClose();
    config.onConnect();
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));
    expect(events.filter((event) => event.type === 'SYNC_STARTED')).toHaveLength(2);
    expect(events.some((event) => event.type === 'DISCONNECTED')).toBe(true);
  });
});
