import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { SessionDecision } from '@/features/Integration/api/session-status-transport';
import type { SessionUiState } from '@/features/Integration/model/session-ui-state';
import { createInitialSessionUiState } from '@/features/Integration/model/session-ui-state';
import { useSessionDecisionIntegration } from './useSessionDecisionIntegration';

const SESSION_ID = 'session-001';
const DECISION: SessionDecision = {
  requestId: 'req-001',
  decisionId: 'dec-001',
  decisionType: 'TERMS_AGREEMENT',
  options: [
    {
      id: 'term-required',
      label: '필수 약관',
      required: true,
      checked: false,
      disabled: false
    },
    {
      id: 'term-optional',
      label: '선택 약관',
      required: false,
      checked: false,
      disabled: false
    }
  ],
  frameId: 'frm-001',
  frameSequence: 3,
  sourceSnapshotId: 'snap-001'
};

function state(overrides: Partial<SessionUiState> = {}): SessionUiState {
  return {
    ...createInitialSessionUiState(SESSION_ID, 'USER_DECISION_REQUIRED'),
    connectionPhase: 'CONNECTED',
    activeDecision: DECISION,
    selectedTermIds: new Set(['term-required', 'term-optional']),
    decisionSubmitPhase: 'SELECTING',
    ...overrides
  };
}

function callbacks() {
  return {
    onSelectOption: vi.fn(),
    onToggleTerm: vi.fn(),
    onSubmitStarted: vi.fn(),
    onSubmitAcknowledged: vi.fn(),
    onSubmitFailed: vi.fn(),
    onSubmitAborted: vi.fn()
  };
}

function options(
  client: { submitDecision: ReturnType<typeof vi.fn> },
  currentState = state(),
  overrides = {}
) {
  return {
    state: currentState,
    frame: { frameId: 'frm-001', sequence: 3 },
    frameReady: true,
    frameReconnecting: false,
    viewerActionPending: false,
    client,
    ...callbacks(),
    ...overrides
  };
}

describe('useSessionDecisionIntegration', () => {
  it('Backend option 순서의 최종 약관 집합을 정확히 한 번 제출하고 ACK를 알린다', async () => {
    const client = { submitDecision: vi.fn().mockResolvedValue({}) };
    const props = options(client);
    const { result } = renderHook(() => useSessionDecisionIntegration(props));

    act(() => {
      result.current.confirmTerms(['term-required', 'term-optional']);
      result.current.confirmTerms(['term-required', 'term-optional']);
    });

    await waitFor(() => expect(client.submitDecision).toHaveBeenCalledTimes(1));
    expect(client.submitDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: SESSION_ID,
        request: {
          requestId: 'req-001',
          decisionId: 'dec-001',
          decisionType: 'TERMS_AGREEMENT',
          selectedOptionIds: ['term-required', 'term-optional'],
          expectedFrameId: 'frm-001',
          expectedSequence: 3
        }
      })
    );
    await waitFor(() =>
      expect(props.onSubmitAcknowledged).toHaveBeenCalledWith('dec-001')
    );
    expect(props.onSubmitStarted).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['frame mismatch', { frame: { frameId: 'frm-old', sequence: 2 } }],
    ['status resync', { state: state({ connectionPhase: 'RESYNCING' }) }],
    ['frame reconnect', { frameReconnecting: true }],
    ['Viewer Action pending', { viewerActionPending: true }],
    ['secure status', { state: state({ workflowStatus: 'SECURE_INPUT_REQUIRED' }) }]
  ])('%s에서는 제출을 fail-closed 처리한다', (_name, override) => {
    const client = { submitDecision: vi.fn().mockResolvedValue({}) };
    const props = options(client, state(), override);
    const { result } = renderHook(() => useSessionDecisionIntegration(props));
    act(() => result.current.confirmTerms(['term-required', 'term-optional']));
    expect(result.current.canSubmit).toBe(false);
    expect(client.submitDecision).not.toHaveBeenCalled();
  });

  it('required 약관이 빠진 확인 payload와 현재 선택과 다른 payload를 제출하지 않는다', () => {
    const client = { submitDecision: vi.fn().mockResolvedValue({}) };
    const props = options(client);
    const { result } = renderHook(() => useSessionDecisionIntegration(props));
    act(() => result.current.confirmTerms(['term-optional']));
    expect(client.submitDecision).not.toHaveBeenCalled();
  });

  it('단일 선택과 약관 토글을 controlled callback으로만 전달한다', () => {
    const client = { submitDecision: vi.fn() };
    const props = options(client);
    const { result } = renderHook(() => useSessionDecisionIntegration(props));
    act(() => {
      result.current.selectOption('term-required');
      result.current.toggleTerm('term-optional', false);
    });
    expect(props.onSelectOption).toHaveBeenCalledWith('dec-001', 'term-required');
    expect(props.onToggleTerm).toHaveBeenCalledWith(
      'dec-001',
      'term-optional',
      false
    );
    expect(client.submitDecision).not.toHaveBeenCalled();
  });

  it('unmount에서 진행 중 요청을 abort하고 stale ACK를 무시한다', async () => {
    let resolve!: () => void;
    const client = {
      submitDecision: vi.fn(
        () => new Promise<void>((done) => {
          resolve = done;
        })
      )
    };
    const props = options(client);
    const { result, unmount } = renderHook(() =>
      useSessionDecisionIntegration(props)
    );
    act(() => result.current.confirmTerms(['term-required', 'term-optional']));
    await waitFor(() => expect(client.submitDecision).toHaveBeenCalledTimes(1));
    const firstCall = client.submitDecision.mock.calls[0] as unknown as
      | [{ signal: AbortSignal }]
      | undefined;
    const submitted = firstCall?.[0];
    expect(submitted).toBeDefined();
    const signal = submitted!.signal;
    unmount();
    expect(signal.aborted).toBe(true);
    resolve();
    await Promise.resolve();
    expect(props.onSubmitAcknowledged).not.toHaveBeenCalled();
  });

  it('새 decision으로 바뀌면 이전 요청을 abort하고 stale callback을 무시한다', async () => {
    let resolve!: () => void;
    const client = {
      submitDecision: vi.fn(
        () => new Promise<void>((done) => {
          resolve = done;
        })
      )
    };
    const props = options(client);
    const { result, rerender } = renderHook(() =>
      useSessionDecisionIntegration(props)
    );
    act(() => result.current.confirmTerms(['term-required', 'term-optional']));
    await waitFor(() => expect(client.submitDecision).toHaveBeenCalledTimes(1));

    props.state = state({
      activeDecision: { ...DECISION, decisionId: 'dec-002' }
    });
    rerender();

    await waitFor(() =>
      expect(props.onSubmitAborted).toHaveBeenCalledWith('dec-001')
    );
    resolve();
    await Promise.resolve();
    expect(props.onSubmitAcknowledged).not.toHaveBeenCalled();
  });
});
