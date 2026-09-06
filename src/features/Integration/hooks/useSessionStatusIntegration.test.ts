import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type {
  SessionStatusTransport,
  SessionStatusTransportEvent,
  SessionUiEvent
} from '@/features/Integration/api/session-status-transport';
import { useSessionStatusIntegration } from './useSessionStatusIntegration';

class FakeTransport implements SessionStatusTransport {
  listener: ((event: SessionStatusTransportEvent) => void) | null = null;
  connect = vi.fn();
  disconnect = vi.fn();

  subscribe(listener: (event: SessionStatusTransportEvent) => void) {
    this.listener = listener;
    return vi.fn(() => {
      this.listener = null;
    });
  }

  emit(event: SessionStatusTransportEvent) {
    this.listener?.(event);
  }
}

function stateEvent(sequence: number): SessionUiEvent {
  return {
    eventId: `evt-${sequence}`,
    eventSequence: sequence,
    eventType: 'STATE',
    sessionId: 'session-001',
    status: 'AI_EXECUTING',
    message: 'AI가 화면을 확인하고 있습니다.',
    actionRequired: false,
    target: null,
    decision: null,
    secureInput: null,
    confirmation: null,
    occurredAt: '2026-08-19T12:00:00Z'
  };
}

describe('useSessionStatusIntegration', () => {
  it('동일 session transport를 연결하고 snapshot·live event를 reducer에 전달한다', () => {
    const transport = new FakeTransport();
    const factory = vi.fn(() => transport);
    const { result } = renderHook(() =>
      useSessionStatusIntegration({
        sessionId: 'session-001',
        transportFactory: factory
      })
    );

    expect(factory).toHaveBeenCalledWith({
      sessionId: 'session-001',
      baseUrl: undefined
    });
    expect(transport.connect).toHaveBeenCalledTimes(1);

    act(() => {
      transport.emit({ type: 'SYNC_STARTED' });
      transport.emit({
        type: 'SNAPSHOT_RECEIVED',
        snapshot: {
          sessionId: 'session-001',
          latestEventSequence: 0,
          state: null,
        guide: null,
        target: null,
        decision: null,
        secureInput: null,
        confirmation: null
        }
      });
      transport.emit({ type: 'EVENT_RECEIVED', event: stateEvent(1) });
      transport.emit({ type: 'CONNECTED' });
    });

    expect(result.current).toMatchObject({
      connectionPhase: 'CONNECTED',
      workflowStatus: 'AI_EXECUTING',
      guideMessage: 'AI가 화면을 확인하고 있습니다.',
      lastEventSequence: 1
    });
  });

  it('unmount에서 unsubscribe와 deactivate를 수행하고 stale callback을 차단한다', () => {
    const transport = new FakeTransport();
    const factory = () => transport;
    const { result, unmount } = renderHook(() =>
      useSessionStatusIntegration({
        sessionId: 'session-001',
        transportFactory: factory
      })
    );
    const listener = transport.listener;

    unmount();
    listener?.({ type: 'EVENT_RECEIVED', event: stateEvent(2) });

    expect(transport.disconnect).toHaveBeenCalledTimes(1);
    expect(result.current.workflowStatus).toBe('SESSION_CREATED');
  });

  it('reconnect resync와 안전한 오류 상태를 반영한다', () => {
    const transport = new FakeTransport();
    const factory = () => transport;
    const { result } = renderHook(() =>
      useSessionStatusIntegration({
        sessionId: 'session-001',
        transportFactory: factory
      })
    );

    act(() => transport.emit({ type: 'SYNC_STARTED' }));
    expect(result.current.connectionPhase).toBe('RESYNCING');

    act(() =>
      transport.emit({
        type: 'SAFE_ERROR',
        message: '실시간 상태 연결을 안전하게 처리하지 못했습니다.'
      })
    );
    expect(result.current.connectionPhase).toBe('ERROR');
    expect(result.current.safeError).not.toContain('session-001');
  });
});
