import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConversationHttpClient } from '../../src/features/AgentChat/api/conversation-http-client';
import type { OverlayHttpClient } from '../../src/features/AgentChat/api/overlay-http-client';
import type { ConversationStompClient } from '../../src/features/AgentChat/api/conversation-stomp-client';
import type { ConversationSnapshot } from '../../src/features/AgentChat/model/conversation-types';
import type { PublicOverlayTarget } from '../../src/features/AgentChat/model/overlay-types';
import AgentChatShell from '../../src/features/AgentChat/ui/AgentChatShell';

let recognitionInstance: FakeRecognition | null = null;
class FakeRecognition {
  lang = ''; interimResults = false; continuous = false;
  onresult: ((event: never) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  start = vi.fn(); stop = vi.fn(); abort = vi.fn();
  constructor() { recognitionInstance = this; }
}

const target: PublicOverlayTarget = {
  contractVersion: 2, materializationMode: 'USER_DOM_PUBLIC_TARGET',
  targetId: 'target-1', sessionId: 'session-1', pageIdentity: 'page-1',
  sourceSnapshotId: 'snapshot-1', coordinateSpace: 'VIEWPORT_CSS_PX',
  rectangle: { x: 100, y: 200, width: 180, height: 56 },
  viewport: { width: window.innerWidth, height: window.innerHeight },
  role: 'button', label: '12개월 정기예금 선택', guide: '이 버튼을 직접 눌러 주세요.',
  locator: { type: 'PUBLIC_TARGET_KEY', publicTargetKey: 'deposit-product-12m-select',
    role: 'button', accessibleName: '12개월 정기예금 선택' },
  actionMode: 'GUIDE_USER_CLICK', createdAt: '2026-09-06T00:00:00Z',
  expiresAt: '2099-09-06T00:01:00Z', consumedAt: null
};

const snapshot: ConversationSnapshot = {
  snapshotId: 'conversation-snapshot-1', sessionId: 'session-1', eventSequence: 1,
  conversationSequence: 0, goalRevision: 0, userGoal: {}, activeQuestion: null,
  recentSafeMessages: [], workflowStatus: 'USER_DECISION_REQUIRED',
  expiresAt: '2099-09-06T00:01:00Z'
};

function dependencies(observeClick: OverlayHttpClient['observeClick']) {
  let handlers!: Parameters<ConversationStompClient['subscribe']>[0];
  const disconnect = vi.fn();
  const stompClient: ConversationStompClient = {
    subscribe: vi.fn((options) => {
      handlers = options;
      return { disconnect };
    })
  };
  const httpClient = {
    createSession: vi.fn(), sendMessage: vi.fn(), getSnapshot: vi.fn(async () => snapshot)
  } as unknown as ConversationHttpClient;
  const overlayHttpClient: OverlayHttpClient = {
    recoverBridge: vi.fn(async (_binding, viewport) => ({
      sessionId: 'session-1', pageIdentity: 'page-1',
      eventSubscription: '/topic/sessions/session-1/events',
      conversationSnapshotPath: '/api/v1/sessions/session-1/conversation',
      expiresAt: '2099-09-06T00:01:00Z', activeTarget: { ...target, viewport }
    })),
    observeClick
  };
  return { stompClient, httpClient, overlayHttpClient, disconnect, handlers: () => handlers };
}

function PublicTargetButton() {
  return <button type="button" data-testid="actual-target"
    data-ddd-public-target="deposit-product-12m-select"
    aria-label="12개월 정기예금 선택">이 상품 선택</button>;
}

beforeEach(() => {
  window.history.replaceState(null, '', '/deposit/products');
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
    x: 100, y: 200, left: 100, top: 200, width: 180, height: 56,
    right: 280, bottom: 256, toJSON: () => ({})
  } as DOMRect));
});

afterEach(() => {
  delete (window as typeof window & { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
  recognitionInstance = null;
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

describe('AgentChat protected lifecycle integration', () => {
  it('secure-input DOM entry clears draft, aborts STT, stops TTS, and announces the disabled reason', async () => {
    (window as typeof window & { webkitSpeechRecognition?: typeof FakeRecognition }).webkitSpeechRecognition = FakeRecognition;
    const cancel = vi.fn();
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { cancel, speak: vi.fn() }
    });
    const user = userEvent.setup();
    render(<AgentChatShell onSubmitRequest={vi.fn()} />);
    await user.type(screen.getByRole('textbox', { name: '업무 요청' }), '예금 기간을 알려 주세요');
    await user.click(screen.getByRole('button', { name: '음성 입력 시작' }));
    const recognition = recognitionInstance;
    const cancelCount = cancel.mock.calls.length;

    const marker = document.createElement('input');
    marker.setAttribute('data-ddd-policy', 'secure-input');
    marker.setAttribute('type', 'password');
    await act(async () => {
      document.body.appendChild(marker);
      await Promise.resolve();
    });

    expect(recognition?.abort).toHaveBeenCalledTimes(1);
    expect(cancel.mock.calls.length).toBeGreaterThan(cancelCount);
    expect(screen.getByRole('textbox', { name: '업무 요청' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: '업무 요청' })).toHaveValue('');
    expect(screen.getByRole('alert')).toHaveTextContent('보안 정보를 직접 입력해 주세요');
    expect(screen.getByRole('button', { name: '요청 전송' }))
      .toHaveAttribute('aria-describedby', expect.stringContaining('agent-protection-reason'));
    await act(async () => {
      marker.remove();
      await Promise.resolve();
    });
  });

  it('secure entry aborts a pending observation and never restores its stale Overlay', async () => {
    let observationSignal: AbortSignal | null = null;
    const observeClick = vi.fn((_binding, _request, signal: AbortSignal) => {
      observationSignal = signal;
      return new Promise<never>(() => undefined);
    });
    const setup = dependencies(observeClick);
    render(<div>
      <PublicTargetButton />
      <AgentChatShell httpClient={setup.httpClient} overlayHttpClient={setup.overlayHttpClient}
        stompClient={setup.stompClient}
        bridgeBinding={{ sessionId: 'session-1', browserBindingId: 'binding-1', bridgeToken: 'token-1',
          pageIdentity: 'page-1', expiresAt: '2099-01-01T00:00:00Z',
          recoveryPath: '/api/v1/sessions/session-1/conversation/bridge', pageReadyStatus: 'READY' }} />
    </div>);
    await waitFor(() => expect(setup.overlayHttpClient.recoverBridge).toHaveBeenCalledTimes(1));
    await act(async () => setup.handlers().onConnected());
    const button = await screen.findByTestId('actual-target');
    fireEvent.click(button, { clientX: 110, clientY: 210, detail: 1 });
    await waitFor(() => expect(observeClick).toHaveBeenCalledTimes(1));

    const marker = document.createElement('input');
    marker.setAttribute('data-ddd-policy', 'secure-input');
    await act(async () => {
      document.body.appendChild(marker);
      await Promise.resolve();
    });
    await waitFor(() => expect(observationSignal?.aborted).toBe(true));
    expect(screen.queryByTestId('dom-target-overlay')).not.toBeInTheDocument();
    expect(observeClick).toHaveBeenCalledTimes(1);
    await act(async () => {
      marker.remove();
      await Promise.resolve();
    });
  });

  it('reconnect restores snapshot first and then only the current bridge target without auto requests', async () => {
    const setup = dependencies(vi.fn());
    render(<div><PublicTargetButton /><AgentChatShell httpClient={setup.httpClient}
      overlayHttpClient={setup.overlayHttpClient} stompClient={setup.stompClient}
      bridgeBinding={{ sessionId: 'session-1', browserBindingId: 'binding-1', bridgeToken: 'token-1',
        pageIdentity: 'page-1', expiresAt: '2099-01-01T00:00:00Z',
        recoveryPath: '/api/v1/sessions/session-1/conversation/bridge', pageReadyStatus: 'READY' }} /></div>);
    await waitFor(() => expect(setup.overlayHttpClient.recoverBridge).toHaveBeenCalledTimes(1));
    await act(async () => setup.handlers().onConnected());
    expect(await screen.findByTestId('dom-target-overlay')).toBeInTheDocument();

    act(() => setup.handlers().onDisconnected(true));
    expect(screen.queryByTestId('dom-target-overlay')).not.toBeInTheDocument();
    await act(async () => setup.handlers().onConnected());
    await waitFor(() => expect(setup.overlayHttpClient.recoverBridge).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId('dom-target-overlay')).toBeInTheDocument();
    expect(setup.httpClient.getSnapshot).toHaveBeenCalledTimes(2);
    expect(setup.httpClient.createSession).not.toHaveBeenCalled();
    expect(setup.httpClient.sendMessage).not.toHaveBeenCalled();
  });

  it('session cancellation clears protected resources and disconnects the transport', async () => {
    const setup = dependencies(vi.fn());
    render(<div><PublicTargetButton /><AgentChatShell httpClient={setup.httpClient}
      overlayHttpClient={setup.overlayHttpClient} stompClient={setup.stompClient}
      bridgeBinding={{ sessionId: 'session-1', browserBindingId: 'binding-1', bridgeToken: 'token-1',
        pageIdentity: 'page-1', expiresAt: '2099-01-01T00:00:00Z',
        recoveryPath: '/api/v1/sessions/session-1/conversation/bridge', pageReadyStatus: 'READY' }} /></div>);
    await waitFor(() => expect(setup.overlayHttpClient.recoverBridge).toHaveBeenCalledTimes(1));
    await act(async () => setup.handlers().onConnected());
    expect(await screen.findByTestId('dom-target-overlay')).toBeInTheDocument();

    act(() => setup.handlers().onMessage(JSON.stringify({
      eventId: 'event-cancelled', eventSequence: 2, eventType: 'AI_MESSAGE',
      sessionId: 'session-1', workflowStatus: 'CANCELLED',
      occurredAt: '2026-09-06T00:00:02Z', messageId: 'message-cancelled', sequence: 1,
      text: '요청한 업무를 취소했습니다.', kind: 'MESSAGE', goalRevision: 1, errorCode: null
    })));

    await waitFor(() => expect(setup.disconnect).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('dom-target-overlay')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '업무 요청' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('현재 업무 세션이 종료되어');
  });
});
