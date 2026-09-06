import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import App from '../../src/App';
import type { ConversationHttpClient } from '../../src/features/AgentChat/api/conversation-http-client';
import type { NavigationHttpClient } from '../../src/features/AgentChat/api/navigation-http-client';
import type { OverlayHttpClient } from '../../src/features/AgentChat/api/overlay-http-client';
import type { ConversationStompClient } from '../../src/features/AgentChat/api/conversation-stomp-client';
import type { ConversationSnapshot } from '../../src/features/AgentChat/model/conversation-types';

const binding = {
  sessionId: 'session-1', browserBindingId: 'binding-1', bridgeToken: 'memory-token',
  pageIdentity: 'page-source', expiresAt: '2099-01-01T00:00:00Z',
  recoveryPath: '/api/v1/sessions/session-1/conversation/bridge', pageReadyStatus: 'READY' as const
};

const snapshot: ConversationSnapshot = {
  snapshotId: 'snapshot-1', sessionId: 'session-1', eventSequence: 2,
  conversationSequence: 2, goalRevision: 1, userGoal: { intent: 'OPEN_DEPOSIT' },
  activeQuestion: {
    messageId: 'ai-question-1', questionId: 'question-1', sequence: 2, goalRevision: 1,
    text: '예금 상품을 확인할까요?', occurredAt: '2026-09-07T00:00:01Z'
  },
  recentSafeMessages: [
    { messageId: 'message-1', requestId: 'request-1', role: 'USER', kind: 'MESSAGE', sequence: 1,
      text: '100만 원으로 12개월 예금 가입을 도와줘', questionId: null, goalRevision: 0,
      occurredAt: '2026-09-07T00:00:00Z' },
    { messageId: 'ai-question-1', role: 'AI', kind: 'QUESTION', sequence: 2,
      text: '예금 상품을 확인할까요?', questionId: 'question-1', goalRevision: 1,
      occurredAt: '2026-09-07T00:00:01Z' }
  ],
  workflowStatus: 'ADDITIONAL_INFORMATION_REQUIRED',
  expiresAt: '2099-01-01T00:00:00Z'
};

function accepted(requestId: string, messageId: string) {
  return {
    sessionId: 'session-1', requestId, messageId, acceptedSequence: 1,
    queueStatus: 'ACTIVE' as const, workflowStatus: 'AI_EXECUTING' as const,
    acceptedAt: '2026-09-07T00:00:00Z', duplicate: false, bridgeBinding: binding
  };
}

function navigationEvent() {
  return {
    eventId: 'event-navigation-1', eventSequence: 3, eventType: 'NAVIGATION_REQUIRED',
    sessionId: 'session-1', navigationId: 'navigation-1', browserBindingId: 'binding-1',
    sourcePageIdentity: 'page-source', destinationPageIdentity: 'page-destination',
    destinationRoute: '/deposit/products', routeRevision: 1, navigationMode: 'SPA_PUSH',
    expiresAt: '2099-01-01T00:00:00Z', guide: '예금 상품을 직접 선택해 주세요.',
    occurredAt: '2026-09-07T00:00:02Z'
  };
}

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('AgentChat browser navigation integration', () => {
  it('StrictMode에서 binding을 유지하며 동일 탭 SPA 이동과 page-ready를 정확히 한 번 수행한다', async () => {
    window.history.replaceState(null, '', '/transfer/accounts');
    const user = userEvent.setup();
    let handlers!: Parameters<ConversationStompClient['subscribe']>[0];
    const stompClient: ConversationStompClient = {
      subscribe: vi.fn((options) => { handlers = options; return { disconnect: vi.fn() }; })
    };
    const httpClient = {
      createSession: vi.fn(async (request) => accepted(request.requestId, request.messageId)),
      sendMessage: vi.fn(),
      getSnapshot: vi.fn(async () => snapshot)
    } as ConversationHttpClient;
    const overlayHttpClient: OverlayHttpClient = {
      recoverBridge: vi.fn(async (currentBinding) => ({
        sessionId: currentBinding.sessionId, pageIdentity: currentBinding.pageIdentity,
        eventSubscription: '/topic/sessions/session-1/events',
        conversationSnapshotPath: '/api/v1/sessions/session-1/conversation',
        expiresAt: '2099-01-01T00:00:00Z', activeTarget: null
      })),
      observeClick: vi.fn()
    };
    const navigationHttpClient: NavigationHttpClient = {
      pageReady: vi.fn(async (_currentBinding, request) => ({
        sessionId: 'session-1', requestId: request.requestId, navigationId: request.navigationId,
        browserBindingId: 'binding-1', sourcePageIdentity: request.sourcePageIdentity,
        pageIdentity: request.destinationPageIdentity, routeRevision: request.routeRevision,
        renderedRoute: request.renderedRoute, status: 'PAGE_READY_ACCEPTED',
        message: '화면 준비 상태가 접수되었습니다.'
      }))
    };
    const ids = ['request-1', 'message-1', 'page-ready-request-1'];

    render(
      <StrictMode>
        <App agentChatDependencies={{
          httpClient, overlayHttpClient, navigationHttpClient, stompClient,
          createId: () => ids.shift() ?? 'unexpected-id'
        }} />
      </StrictMode>
    );

    await user.type(screen.getByRole('textbox', { name: '업무 요청' }), '100만 원으로 12개월 예금 가입을 도와줘');
    await user.click(screen.getByRole('button', { name: '요청 전송' }));
    await waitFor(() => expect(httpClient.createSession).toHaveBeenCalledTimes(1));
    await act(async () => handlers.onConnected());
    expect(await screen.findByText('예금 상품을 확인할까요?')).toBeInTheDocument();

    act(() => {
      handlers.onMessage(JSON.stringify(navigationEvent()));
      handlers.onMessage(JSON.stringify(navigationEvent()));
    });

    expect(await screen.findByTestId('page-deposit-products')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/deposit/products');
    expect(screen.getByText('100만 원으로 12개월 예금 가입을 도와줘')).toBeInTheDocument();
    expect(screen.getByText('예금 상품을 확인할까요?')).toBeInTheDocument();
    await waitFor(() => expect(navigationHttpClient.pageReady).toHaveBeenCalledTimes(1));
    expect(navigationHttpClient.pageReady).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1', browserBindingId: 'binding-1',
        bridgeToken: 'memory-token', pageIdentity: 'page-source'
      }),
      expect.objectContaining({
        requestId: 'page-ready-request-1', navigationId: 'navigation-1',
        sourcePageIdentity: 'page-source', destinationPageIdentity: 'page-destination',
        renderedRoute: '/deposit/products', routeRevision: 1
      }),
      expect.any(AbortSignal)
    );

    act(() => handlers.onMessage(JSON.stringify({
      eventId: 'event-page-ready-1', eventSequence: 4, eventType: 'PAGE_READY_OBSERVED',
      sessionId: 'session-1', navigationId: 'navigation-1', browserBindingId: 'binding-1',
      sourcePageIdentity: 'page-source', pageIdentity: 'page-destination', routeRevision: 1,
      occurredAt: '2026-09-07T00:00:03Z'
    })));
    expect(screen.queryByText(/대화 연결을 확인할 수 없습니다/u)).not.toBeInTheDocument();
    expect(httpClient.sendMessage).not.toHaveBeenCalled();
  });

  it('unmount 시 진행 중 page-ready 요청을 abort한다', async () => {
    const user = userEvent.setup();
    let handlers!: Parameters<ConversationStompClient['subscribe']>[0];
    let pageReadySignal: AbortSignal | null = null;
    const navigationHttpClient: NavigationHttpClient = {
      pageReady: vi.fn((_binding, _request, signal) => {
        pageReadySignal = signal;
        return new Promise(() => undefined);
      })
    };
    const { unmount } = render(<App agentChatDependencies={{
      httpClient: {
        createSession: vi.fn(async (request) => accepted(request.requestId, request.messageId)),
        sendMessage: vi.fn(), getSnapshot: vi.fn(async () => snapshot)
      } as ConversationHttpClient,
      overlayHttpClient: {
        recoverBridge: vi.fn(async (currentBinding) => ({
          sessionId: currentBinding.sessionId, pageIdentity: currentBinding.pageIdentity,
          eventSubscription: '/topic/sessions/session-1/events',
          conversationSnapshotPath: '/api/v1/sessions/session-1/conversation',
          expiresAt: '2099-01-01T00:00:00Z', activeTarget: null
        })), observeClick: vi.fn()
      },
      navigationHttpClient,
      stompClient: { subscribe(options) { handlers = options; return { disconnect: vi.fn() }; } },
      createId: (prefix) => prefix,
      waitForRouteReady: async () => undefined,
      navigate: () => undefined
    }} />);
    await user.type(screen.getByRole('textbox', { name: '업무 요청' }), '예금 가입을 도와줘');
    await user.click(screen.getByRole('button', { name: '요청 전송' }));
    await waitFor(() => expect(handlers).toBeDefined());
    await act(async () => handlers.onConnected());
    act(() => handlers.onMessage(JSON.stringify(navigationEvent())));
    await waitFor(() => expect(navigationHttpClient.pageReady).toHaveBeenCalledTimes(1));
    unmount();
    expect(pageReadySignal?.aborted).toBe(true);
  });
});
