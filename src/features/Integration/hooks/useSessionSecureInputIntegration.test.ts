import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createInitialSessionUiState } from '@/features/Integration/model/session-ui-state';
import type { CompleteSessionSecureInputResponse } from '@/features/Integration/api/session-secure-input-client';
import { useSessionSecureInputIntegration } from './useSessionSecureInputIntegration';

const FRAME = { frameId: 'frame-001', sequence: 7 } as const;
const SECURE_INPUT = {
  secureRequestId: 'secure-request-001',
  secureInputType: 'ACCOUNT_PASSWORD' as const,
  frameId: FRAME.frameId,
  frameSequence: FRAME.sequence,
  message: '원격 금융 화면에서 보안 정보를 직접 입력해 주세요.'
};

function state(overrides = {}) {
  return {
    ...createInitialSessionUiState('session-001', 'SECURE_INPUT_REQUIRED'),
    connectionPhase: 'CONNECTED' as const,
    activeSecureInput: SECURE_INPUT,
    secureInputSubmitPhase: 'WAITING_FOR_USER' as const,
    ...overrides
  };
}

function callbacks() {
  return {
    onSubmitStarted: vi.fn(),
    onSubmitAcknowledged: vi.fn(),
    onSubmitFailed: vi.fn(),
    onSubmitAborted: vi.fn()
  };
}

describe('useSessionSecureInputIntegration', () => {
  it('현재 secure request와 frame identity로 한 번만 완료 요청한다', async () => {
    let resolve!: (value: CompleteSessionSecureInputResponse) => void;
    const complete = vi.fn(
      () => new Promise<CompleteSessionSecureInputResponse>((resolvePromise) => { resolve = resolvePromise; })
    );
    const handlers = callbacks();
    const { result } = renderHook(() =>
      useSessionSecureInputIntegration({
        state: state(),
        frame: FRAME,
        frameReady: true,
        frameReconnecting: false,
        viewerActionPending: false,
        client: { complete },
        createRequestId: () => 'completion-request-001',
        ...handlers
      })
    );

    act(() => {
      result.current.requestCompletion();
      result.current.requestCompletion();
    });

    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-001',
        secureRequestId: SECURE_INPUT.secureRequestId,
        request: {
          requestId: 'completion-request-001',
          expectedFrameId: FRAME.frameId,
          expectedSequence: FRAME.sequence
        }
      })
    );
    expect(handlers.onSubmitStarted).toHaveBeenCalledWith(
      SECURE_INPUT.secureRequestId
    );

    await act(async () => {
      resolve({
        sessionId: 'session-001',
        requestId: 'completion-request-001',
        secureRequestId: SECURE_INPUT.secureRequestId,
        status: 'COMPLETION_ACCEPTED',
        message: '요청을 접수했습니다.'
      });
      await Promise.resolve();
    });
    expect(handlers.onSubmitAcknowledged).toHaveBeenCalledWith(
      SECURE_INPUT.secureRequestId
    );
  });

  it.each([
    ['status', { workflowStatus: 'AI_EXECUTING' }],
    ['connection', { connectionPhase: 'DISCONNECTED' }],
    ['request', { activeSecureInput: null }],
    ['waiting', { secureInputSubmitPhase: 'WAITING_FOR_RESUME' }]
  ])('%s gate가 맞지 않으면 완료 요청을 차단한다', (_name, stateOverrides) => {
    const complete = vi.fn();
    const { result } = renderHook(() =>
      useSessionSecureInputIntegration({
        state: state(stateOverrides),
        frame: FRAME,
        frameReady: true,
        frameReconnecting: false,
        viewerActionPending: false,
        client: { complete },
        ...callbacks()
      })
    );

    expect(result.current.canSubmit).toBe(false);
    act(() => result.current.requestCompletion());
    expect(complete).not.toHaveBeenCalled();
  });

  it('frame mismatch와 Action pending에서도 요청을 차단한다', () => {
    const complete = vi.fn();
    const { result } = renderHook(() =>
      useSessionSecureInputIntegration({
        state: state(),
        frame: { frameId: 'stale-frame', sequence: 7 },
        frameReady: true,
        frameReconnecting: false,
        viewerActionPending: true,
        client: { complete },
        ...callbacks()
      })
    );
    expect(result.current.controlsDisabled).toBe(true);
    act(() => result.current.requestCompletion());
    expect(complete).not.toHaveBeenCalled();
  });

  it('연결이 끊기면 진행 중 요청을 abort하고 안전한 재시도 상태로 돌린다', async () => {
    const complete = vi.fn(({ signal }: { signal?: AbortSignal }) =>
      new Promise<never>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      })
    );
    const handlers = callbacks();
    let currentState = state();
    const { result, rerender } = renderHook(() =>
      useSessionSecureInputIntegration({
        state: currentState,
        frame: FRAME,
        frameReady: true,
        frameReconnecting: false,
        viewerActionPending: false,
        client: { complete },
        ...handlers
      })
    );

    act(() => result.current.requestCompletion());
    currentState = state({ connectionPhase: 'DISCONNECTED' });
    rerender();

    await waitFor(() =>
      expect(handlers.onSubmitAborted).toHaveBeenCalledWith(
        SECURE_INPUT.secureRequestId
      )
    );
    expect(handlers.onSubmitFailed).not.toHaveBeenCalled();
  });
});
