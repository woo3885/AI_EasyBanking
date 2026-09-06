import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { ConversationHttpClient } from '../../src/features/AgentChat/api/conversation-http-client';
import type { OverlayHttpClient } from '../../src/features/AgentChat/api/overlay-http-client';
import type { ConversationStompClient } from '../../src/features/AgentChat/api/conversation-stomp-client';
import type { PublicOverlayTarget } from '../../src/features/AgentChat/model/overlay-types';
import type { ConversationSnapshot } from '../../src/features/AgentChat/model/conversation-types';
import AgentChatShell from '../../src/features/AgentChat/ui/AgentChatShell';

function activeTarget(): PublicOverlayTarget {
  return {
    contractVersion: 2, materializationMode: 'USER_DOM_PUBLIC_TARGET',
    targetId: 'target-1', sessionId: 'session-1', pageIdentity: 'page-1', sourceSnapshotId: 'snap-1',
    coordinateSpace: 'VIEWPORT_CSS_PX', rectangle: { x: 100, y: 200, width: 180, height: 56 },
    viewport: { width: window.innerWidth, height: window.innerHeight }, role: 'button', label: '12개월 상품 선택',
    guide: '이 버튼을 직접 눌러 주세요.', actionMode: 'GUIDE_USER_CLICK',
    locator: { type: 'PUBLIC_TARGET_KEY', publicTargetKey: 'deposit-product-12m-select',
      role: 'button', accessibleName: '12개월 상품 선택' },
    createdAt: '2026-09-06T12:00:00Z', expiresAt: '2099-01-01T00:00:00Z', consumedAt: null
  };
}

const snapshot: ConversationSnapshot = {
  snapshotId: 'conversation-snapshot-1', sessionId: 'session-1', eventSequence: 0,
  conversationSequence: 1, goalRevision: 1, userGoal: { goalId: 'goal-1' }, activeQuestion: null,
  recentSafeMessages: [{ messageId: 'ai-1', role: 'AI', kind: 'MESSAGE', sequence: 1,
    text: '상품을 직접 선택해 주세요.', questionId: null, goalRevision: 1,
    occurredAt: '2026-09-06T12:00:00Z' }], workflowStatus: 'USER_DECISION_REQUIRED',
  expiresAt: '2099-01-01T00:00:00Z'
};

describe('AgentChat Overlay bridge integration', () => {
  it('StrictMode에서도 bridge를 한 번 복원하고 실제 DOM click을 한 번 관찰한다', async () => {
    window.history.replaceState(null, '', '/deposit/products');
    const rectangleSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(() => ({ x: 100, y: 200, left: 100, top: 200,
        width: 180, height: 56, right: 280, bottom: 256,
        toJSON: () => ({}) } as DOMRect));
    let handlers!: Parameters<ConversationStompClient['subscribe']>[0];
    const disconnect = vi.fn();
    const stompClient: ConversationStompClient = {
      subscribe: vi.fn((options) => { handlers = options; return { disconnect }; })
    };
    const httpClient = { createSession: vi.fn(), sendMessage: vi.fn(),
      getSnapshot: vi.fn(async () => snapshot) } as unknown as ConversationHttpClient;
    const overlayHttpClient: OverlayHttpClient = {
      recoverBridge: vi.fn(async (_binding, viewport) => ({ sessionId: 'session-1', pageIdentity: 'page-1',
        eventSubscription: '/topic/sessions/session-1/events',
        conversationSnapshotPath: '/api/v1/sessions/session-1/conversation',
        expiresAt: '2099-01-01T00:00:00Z', activeTarget: { ...activeTarget(), viewport } })),
      observeClick: vi.fn(async (binding, request) => ({ sessionId: binding.sessionId,
        requestId: request.requestId, targetId: request.targetId, pageIdentity: binding.pageIdentity,
        sourceSnapshotId: request.sourceSnapshotId, status: 'OBSERVATION_ACCEPTED',
        acceptedAt: '2026-09-06T12:00:01Z' }))
    };
    render(<StrictMode><div>
      <button type="button" data-testid="actual-product"
        data-ddd-public-target="deposit-product-12m-select"
        aria-label="12개월 상품 선택">이 상품 선택</button>
      <AgentChatShell httpClient={httpClient} overlayHttpClient={overlayHttpClient}
        stompClient={stompClient} bridgeBinding={{ sessionId: 'session-1', browserBindingId: 'binding-1',
          bridgeToken: 'token-1', pageIdentity: 'page-1', expiresAt: '2099-01-01T00:00:00Z',
          recoveryPath: '/api/v1/sessions/session-1/conversation/bridge', pageReadyStatus: 'READY' }}
        createId={() => 'observation-request-1'} />
    </div></StrictMode>);

    await waitFor(() => expect(overlayHttpClient.recoverBridge).toHaveBeenCalledTimes(1));
    await act(async () => handlers.onConnected());
    expect(await screen.findByTestId('dom-target-overlay')).toBeInTheDocument();
    expect(overlayHttpClient.recoverBridge).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('상품을 직접 선택해 주세요.')).toBeInTheDocument();
    const button = screen.getByTestId('actual-product');
    fireEvent.click(button, { clientX: 110, clientY: 210, detail: 1 });
    fireEvent.click(button, { clientX: 110, clientY: 210, detail: 1 });
    await waitFor(() => expect(overlayHttpClient.observeClick).toHaveBeenCalledTimes(1));
    expect(overlayHttpClient.observeClick).toHaveBeenCalledWith(
      expect.objectContaining({ bridgeToken: 'token-1', pageIdentity: 'page-1' }),
      expect.objectContaining({ requestId: 'observation-request-1', targetId: 'target-1',
        sourceSnapshotId: 'snap-1', publicTargetKey: 'deposit-product-12m-select',
        role: 'button', actionMode: 'GUIDE_USER_CLICK',
        localRectangle: { x: 100, y: 200, width: 180, height: 56 },
        clickPosition: { clientX: 110, clientY: 210 }, observationType: 'USER_CLICK' }),
      expect.any(AbortSignal)
    );
    expect(httpClient.createSession).not.toHaveBeenCalled();
    expect(httpClient.sendMessage).not.toHaveBeenCalled();
    rectangleSpy.mockRestore();
    window.history.replaceState(null, '', '/');
  });

  it('observed event가 HTTP 202보다 먼저 와도 진행 중 ACK 검증을 중단하지 않는다', async () => {
    window.history.replaceState(null, '', '/deposit/products');
    const rectangleSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(() => ({ x: 100, y: 200, left: 100, top: 200,
        width: 180, height: 56, right: 280, bottom: 256,
        toJSON: () => ({}) } as DOMRect));
    let handlers!: Parameters<ConversationStompClient['subscribe']>[0];
    let observationSignal: AbortSignal | null = null;
    let resolveObservation!: (value: Awaited<ReturnType<OverlayHttpClient['observeClick']>>) => void;
    const observeClick = vi.fn((_binding, _request, signal: AbortSignal) => {
      observationSignal = signal;
      return new Promise<Awaited<ReturnType<OverlayHttpClient['observeClick']>>>((resolve) => {
        resolveObservation = resolve;
      });
    });
    const stompClient: ConversationStompClient = {
      subscribe: vi.fn((options) => { handlers = options; return { disconnect: vi.fn() }; })
    };
    const overlayHttpClient: OverlayHttpClient = {
      recoverBridge: vi.fn(async (_binding, viewport) => ({
        sessionId: 'session-1', pageIdentity: 'page-1',
        eventSubscription: '/topic/sessions/session-1/events',
        conversationSnapshotPath: '/api/v1/sessions/session-1/conversation',
        expiresAt: '2099-01-01T00:00:00Z', activeTarget: { ...activeTarget(), viewport }
      })),
      observeClick
    };
    render(<div>
      <button type="button" data-testid="actual-product-race"
        data-ddd-public-target="deposit-product-12m-select"
        aria-label={activeTarget().label}>이 상품 선택</button>
      <AgentChatShell
        httpClient={{ createSession: vi.fn(), sendMessage: vi.fn(),
          getSnapshot: vi.fn(async () => snapshot) } as unknown as ConversationHttpClient}
        overlayHttpClient={overlayHttpClient}
        stompClient={stompClient}
        bridgeBinding={{ sessionId: 'session-1', browserBindingId: 'binding-1',
          bridgeToken: 'token-1', pageIdentity: 'page-1', expiresAt: '2099-01-01T00:00:00Z',
          recoveryPath: '/api/v1/sessions/session-1/conversation/bridge', pageReadyStatus: 'READY' }}
        createId={() => 'observation-request-1'}
      />
    </div>);

    await waitFor(() => expect(overlayHttpClient.recoverBridge).toHaveBeenCalledTimes(1));
    await act(async () => handlers.onConnected());
    fireEvent.click(await screen.findByTestId('actual-product-race'), {
      clientX: 110, clientY: 210, detail: 1
    });
    await waitFor(() => expect(observeClick).toHaveBeenCalledTimes(1));

    act(() => handlers.onMessage(JSON.stringify({
      eventId: 'event-clear-1', eventSequence: 1, eventType: 'OVERLAY_CLEAR',
      sessionId: 'session-1', targetId: 'target-1', pageIdentity: 'page-1',
      sourceSnapshotId: 'snap-1', publicTargetKey: 'deposit-product-12m-select',
      reason: 'USER_ACTION', occurredAt: '2026-09-06T12:00:01Z'
    })));
    act(() => handlers.onMessage(JSON.stringify({
      eventId: 'event-observed-2', eventSequence: 2, eventType: 'USER_ACTION_OBSERVED',
      sessionId: 'session-1', workflowStatus: 'AI_EXECUTING',
      observationId: 'observation-1', requestId: 'observation-request-1',
      targetId: 'target-1', pageIdentity: 'page-1', sourceSnapshotId: 'snap-1',
      publicTargetKey: 'deposit-product-12m-select', resultingSnapshotId: 'snap-2',
      status: 'DOM_CHANGE_CONFIRMED', occurredAt: '2026-09-06T12:00:02Z'
    })));
    expect(observationSignal).not.toBeNull();
    expect((observationSignal as unknown as AbortSignal).aborted).toBe(false);

    await act(async () => resolveObservation({
      sessionId: 'session-1', requestId: 'observation-request-1', targetId: 'target-1',
      pageIdentity: 'page-1', sourceSnapshotId: 'snap-1', status: 'OBSERVATION_ACCEPTED',
      acceptedAt: '2026-09-06T12:00:02Z'
    }));
    expect((observationSignal as unknown as AbortSignal).aborted).toBe(false);

    rectangleSpy.mockRestore();
    window.history.replaceState(null, '', '/');
  });
});
