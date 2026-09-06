import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type {
  SessionConfirmationClient,
  SubmitSessionConfirmationResponse
} from '@/features/Integration/api/session-confirmation-client';
import {
  createInitialSessionUiState,
  type SessionUiState
} from '@/features/Integration/model/session-ui-state';
import { useSessionFinalConfirmationIntegration } from './useSessionFinalConfirmationIntegration';

const CONFIRMATION = {
  confirmationId: 'confirm-001',
  confirmationType: 'DEPOSIT_SUBSCRIPTION' as const,
  sourceSnapshotId: 'snap-001',
  frameId: 'frm-001',
  frameSequence: 7,
  summary: {
    transactionType: '정기예금 가입',
    items: [
      { id: 'product-name', label: '상품명', value: '12개월 정기예금' },
      { id: 'deposit-amount', label: '가입 금액', value: '1,000,000원' },
      { id: 'deposit-period', label: '가입 기간', value: '12개월' }
    ]
  }
};

function state(overrides: Partial<SessionUiState> = {}): SessionUiState {
  return {
    ...createInitialSessionUiState('session-001', 'FINAL_CONFIRMATION_REQUIRED'),
    connectionPhase: 'CONNECTED',
    activeConfirmation: CONFIRMATION,
    confirmationSubmitPhase: 'REVIEWING',
    ...overrides
  };
}

function callbacks() {
  return {
    onConfirmedChange: vi.fn(),
    onSubmitStarted: vi.fn(),
    onSubmitAcknowledged: vi.fn(),
    onSubmitFailed: vi.fn(),
    onSubmitAborted: vi.fn()
  };
}

function options(
  current: SessionUiState,
  client: Pick<SessionConfirmationClient, 'submit'>,
  handlers = callbacks()
) {
  return {
    state: current,
    frame: { frameId: 'frm-001', sequence: 7 },
    frameReady: true,
    frameReconnecting: false,
    viewerActionPending: false,
    client,
    createRequestId: () => 'confirm-request-001',
    ...handlers
  };
}

describe('useSessionFinalConfirmationIntegration', () => {
  it('mount나 checkbox 변경만으로 요청하지 않고 확인 상태만 전달한다', () => {
    const client = { submit: vi.fn() };
    const handlers = callbacks();
    const { result } = renderHook(() =>
      useSessionFinalConfirmationIntegration(options(state(), client, handlers))
    );

    expect(client.submit).not.toHaveBeenCalled();
    expect(result.current.canApprove).toBe(false);
    act(() => result.current.setConfirmed(true));
    expect(handlers.onConfirmedChange).toHaveBeenCalledWith('confirm-001', true);
    expect(client.submit).not.toHaveBeenCalled();
  });

  it('승인 요청을 정확히 한 번 보내고 ACK를 거래 완료가 아닌 대기 상태로 전달한다', async () => {
    const client = {
      submit: vi.fn().mockResolvedValue({ status: 'APPROVAL_ACCEPTED' })
    };
    const handlers = callbacks();
    const current = state({ confirmationConfirmed: true });
    const { result } = renderHook(() =>
      useSessionFinalConfirmationIntegration(options(current, client, handlers))
    );

    expect(result.current.canApprove).toBe(true);
    await act(async () => {
      result.current.requestApproval();
      await Promise.resolve();
    });

    expect(client.submit).toHaveBeenCalledTimes(1);
    expect(client.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-001',
        action: 'APPROVE',
        request: {
          requestId: 'confirm-request-001',
          confirmationId: 'confirm-001',
          approved: true,
          expectedFrameId: 'frm-001',
          expectedSequence: 7
        }
      })
    );
    expect(handlers.onSubmitStarted).toHaveBeenCalledWith(
      'confirm-001',
      'APPROVE'
    );
    expect(handlers.onSubmitAcknowledged).toHaveBeenCalledWith('confirm-001');
  });

  it('거절은 checkbox 없이 가능하고 approved=false만 전송한다', async () => {
    const client = {
      submit: vi.fn().mockResolvedValue({ status: 'REJECTION_ACCEPTED' })
    };
    const handlers = callbacks();
    const { result } = renderHook(() =>
      useSessionFinalConfirmationIntegration(options(state(), client, handlers))
    );

    expect(result.current.canReject).toBe(true);
    await act(async () => {
      result.current.requestRejection();
      await Promise.resolve();
    });
    expect(client.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'REJECT',
        request: expect.objectContaining({ approved: false })
      })
    );
    expect(handlers.onSubmitStarted).toHaveBeenCalledWith(
      'confirm-001',
      'REJECT'
    );
  });

  it.each([
    ['연결 복구', { frameReconnecting: true }],
    ['Viewer Action 처리', { viewerActionPending: true }],
    ['frame 불일치', { frame: { frameId: 'frm-002', sequence: 8 } }]
  ])('%s 중에는 승인과 거절을 모두 차단한다', (_label, override) => {
    const client = { submit: vi.fn() };
    const base = options(state({ confirmationConfirmed: true }), client);
    const { result } = renderHook(() =>
      useSessionFinalConfirmationIntegration({ ...base, ...override })
    );
    expect(result.current.canApprove).toBe(false);
    expect(result.current.canReject).toBe(false);
    act(() => {
      result.current.requestApproval();
      result.current.requestRejection();
    });
    expect(client.submit).not.toHaveBeenCalled();
  });

  it('새 confirmation으로 바뀐 stale callback과 unmount 요청을 차단·abort한다', async () => {
    let resolveRequest!: (value: SubmitSessionConfirmationResponse) => void;
    const pending = new Promise<SubmitSessionConfirmationResponse>((resolve) => {
      resolveRequest = resolve;
    });
    const submit = vi.fn(
      (..._args: Parameters<SessionConfirmationClient['submit']>) => pending
    );
    const client = { submit };
    const handlers = callbacks();
    let current = state({ confirmationConfirmed: true });
    const { result, rerender, unmount } = renderHook(() =>
      useSessionFinalConfirmationIntegration(options(current, client, handlers))
    );

    act(() => result.current.requestApproval());
    current = state({
      activeConfirmation: {
        ...CONFIRMATION,
        confirmationId: 'confirm-002'
      }
    });
    rerender();
    expect(handlers.onSubmitAborted).toHaveBeenCalledWith('confirm-001');
    resolveRequest({
      sessionId: 'session-001',
      requestId: 'confirm-request-001',
      confirmationId: 'confirm-001',
      sourceFrameId: 'frm-001',
      sourceFrameSequence: 7,
      status: 'APPROVAL_ACCEPTED',
      message: '요청을 처리하고 있습니다.'
    });
    await act(async () => Promise.resolve());
    expect(handlers.onSubmitAcknowledged).not.toHaveBeenCalled();

    current = state({ confirmationConfirmed: true });
    rerender();
    act(() => result.current.requestApproval());
    unmount();
    expect(
      submit.mock.calls[submit.mock.calls.length - 1]![0]!.signal!
        .aborted
    ).toBe(true);
  });
});
