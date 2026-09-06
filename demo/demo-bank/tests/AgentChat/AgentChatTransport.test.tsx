import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ConversationHttpClient } from '../../src/features/AgentChat/api/conversation-http-client';
import type { ConversationStompClient } from '../../src/features/AgentChat/api/conversation-stomp-client';
import type { ConversationSnapshot } from '../../src/features/AgentChat/model/conversation-types';
import AgentChatShell from '../../src/features/AgentChat/ui/AgentChatShell';

function accepted(requestId: string, messageId: string, acceptedSequence: number) {
  return { sessionId: 'session-1', requestId, messageId, acceptedSequence, queueStatus: 'ACTIVE' as const,
    workflowStatus: 'AI_EXECUTING' as const, acceptedAt: '2026-09-03T00:00:00Z', duplicate: false };
}

function questionSnapshot(): ConversationSnapshot {
  return { snapshotId: 'snapshot-1', sessionId: 'session-1', eventSequence: 2, conversationSequence: 2,
    goalRevision: 1, userGoal: { goalId: 'goal-1', normalizedRequest: '100만원으로 예금 가입' },
    activeQuestion: { questionId: 'question-1', messageId: 'ai-question-1', sequence: 2,
      goalRevision: 1, text: '예금 기간은 몇 개월로 할까요?', occurredAt: '2026-09-03T00:00:01Z' },
    recentSafeMessages: [
      { messageId: 'message-1', requestId: 'request-1', role: 'USER', kind: 'MESSAGE', sequence: 1,
        text: '100만원으로 예금 가입해줘', questionId: null, goalRevision: 0, occurredAt: '2026-09-03T00:00:00Z' },
      { messageId: 'ai-question-1', role: 'AI', kind: 'QUESTION', sequence: 2,
        text: '예금 기간은 몇 개월로 할까요?', questionId: 'question-1', goalRevision: 1,
        occurredAt: '2026-09-03T00:00:01Z' }
    ], workflowStatus: 'ADDITIONAL_INFORMATION_REQUIRED', expiresAt: '2026-09-03T01:00:00Z' };
}

describe('AgentChat transport integration', () => {
  it('ACK 후 구독·snapshot 복원하고 후속 답변 identity를 보낸다', async () => {
    const user = userEvent.setup();
    const createSession = vi.fn(async (request) => accepted(request.requestId, request.messageId, 1));
    const sendMessage = vi.fn(async (_sessionId, request) => accepted(request.requestId, request.messageId, 3));
    const getSnapshot = vi.fn(async () => questionSnapshot());
    const httpClient = { createSession, sendMessage, getSnapshot } as ConversationHttpClient;
    let handlers!: Parameters<ConversationStompClient['subscribe']>[0];
    const stompClient: ConversationStompClient = { subscribe(options) { handlers = options; return { disconnect: vi.fn() }; } };
    const ids = ['request-1', 'message-1', 'request-2', 'message-2'];
    render(<AgentChatShell httpClient={httpClient} stompClient={stompClient}
      backendBaseUrl="http://127.0.0.1:8080" createId={() => ids.shift() ?? 'extra'} />);

    await user.type(screen.getByRole('textbox', { name: '업무 요청' }), '100만원으로 예금 가입해줘');
    await user.click(screen.getByRole('button', { name: '요청 전송' }));
    await waitFor(() => expect(createSession).toHaveBeenCalledTimes(1));
    expect(createSession.mock.calls[0][0]).toMatchObject({ requestId: 'request-1', messageId: 'message-1',
      siteId: 'demo-bank', initialPath: '/', content: '100만원으로 예금 가입해줘' });
    expect(handlers.destination).toBe('/topic/sessions/session-1/events');

    await act(async () => handlers.onConnected());
    expect(await screen.findByText('예금 기간은 몇 개월로 할까요?')).toBeInTheDocument();
    expect(screen.getByText('100만원으로 예금 가입해줘')).toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: '업무 요청' }), '12개월');
    await user.click(screen.getByRole('button', { name: '요청 전송' }));
    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
    expect(sendMessage.mock.calls[0][0]).toBe('session-1');
    expect(sendMessage.mock.calls[0][1]).toMatchObject({ requestId: 'request-2', messageId: 'message-2',
      answerToQuestionId: 'question-1', expectedConversationSequence: 2, expectedGoalRevision: 1, content: '12개월' });
  });

  it('더 높은 goalRevision의 AI_MESSAGE 후 authoritative snapshot에서만 질문을 제거한다', async () => {
    const user = userEvent.setup();
    const resolved = { ...questionSnapshot(), snapshotId: 'snapshot-2', eventSequence: 3,
      conversationSequence: 3, goalRevision: 2, activeQuestion: null,
      recentSafeMessages: [...questionSnapshot().recentSafeMessages, { messageId: 'ai-3', role: 'AI' as const,
        kind: 'MESSAGE' as const, sequence: 3, text: '요청 정보를 반영했습니다.', questionId: null,
        goalRevision: 2, occurredAt: '2026-09-03T00:00:03Z' }] };
    const getSnapshot = vi.fn().mockResolvedValueOnce(questionSnapshot()).mockResolvedValueOnce(resolved);
    const httpClient = { createSession: vi.fn(async () => accepted('request-1', 'message-1', 1)),
      sendMessage: vi.fn(), getSnapshot } as unknown as ConversationHttpClient;
    let handlers!: Parameters<ConversationStompClient['subscribe']>[0];
    render(<AgentChatShell httpClient={httpClient} stompClient={{ subscribe(value) { handlers = value; return { disconnect: vi.fn() }; } }}
      createId={(prefix) => prefix === 'chat-request' ? 'request-1' : 'message-1'} />);
    await user.type(screen.getByRole('textbox', { name: '업무 요청' }), '예금 가입해줘');
    await user.click(screen.getByRole('button', { name: '요청 전송' }));
    await waitFor(() => expect(httpClient.createSession).toHaveBeenCalled());
    await act(async () => handlers.onConnected());
    expect(await screen.findByText('예금 기간은 몇 개월로 할까요?')).toBeInTheDocument();
    act(() => handlers.onMessage(JSON.stringify({ eventId: 'event-3', eventSequence: 3, eventType: 'AI_MESSAGE',
      sessionId: 'session-1', workflowStatus: 'AI_EXECUTING', occurredAt: '2026-09-03T00:00:03Z',
      messageId: 'ai-3', sequence: 3, text: '요청 정보를 반영했습니다.', kind: 'MESSAGE', goalRevision: 2, errorCode: null })));
    await waitFor(() => expect(getSnapshot).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('요청 정보를 반영했습니다.')).toBeInTheDocument();
  });

  it('unmount에서 진행 중 HTTP를 abort한다', async () => {
    const user = userEvent.setup();
    let signal: AbortSignal | undefined;
    const createSession = vi.fn((_request, requestSignal: AbortSignal) => {
      signal = requestSignal;
      return new Promise(() => undefined);
    });
    const { unmount } = render(<AgentChatShell httpClient={{ createSession, sendMessage: vi.fn(), getSnapshot: vi.fn() } as unknown as ConversationHttpClient}
      stompClient={{ subscribe: vi.fn(() => ({ disconnect: vi.fn() })) }} createId={(prefix) => prefix} />);
    await user.type(screen.getByRole('textbox', { name: '업무 요청' }), '예금 가입해줘');
    await user.click(screen.getByRole('button', { name: '요청 전송' }));
    await waitFor(() => expect(createSession).toHaveBeenCalled());
    unmount();
    expect(signal?.aborted).toBe(true);
  });

  it('session 연결 후 unmount에서 STOMP subscription을 정리한다', async () => {
    const user = userEvent.setup(); const disconnect = vi.fn();
    const httpClient = { createSession: vi.fn(async () => accepted('request-1', 'message-1', 1)),
      sendMessage: vi.fn(), getSnapshot: vi.fn() } as unknown as ConversationHttpClient;
    const { unmount } = render(<AgentChatShell httpClient={httpClient}
      stompClient={{ subscribe: vi.fn(() => ({ disconnect })) }}
      createId={(prefix) => prefix === 'chat-request' ? 'request-1' : 'message-1'} />);
    await user.type(screen.getByRole('textbox', { name: '업무 요청' }), '예금 가입해줘');
    await user.click(screen.getByRole('button', { name: '요청 전송' }));
    await waitFor(() => expect(httpClient.createSession).toHaveBeenCalled());
    unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
