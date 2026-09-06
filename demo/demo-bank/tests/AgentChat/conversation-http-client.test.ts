import { describe, expect, it, vi } from 'vitest';

import { createConversationHttpClient } from '../../src/features/AgentChat/api/conversation-http-client';

function ack(overrides: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ success: true, errorCode: null, message: '메시지가 접수되었습니다.', data: {
    sessionId: 'session-1', requestId: 'request-1', messageId: 'message-1', acceptedSequence: 1,
    queueStatus: 'ACTIVE', workflowStatus: 'SESSION_CREATED', acceptedAt: '2026-09-03T00:00:00Z',
    duplicate: false, ...overrides
  } }), { status: 202, headers: { 'Content-Type': 'application/json' } });
}

describe('conversation HTTP client', () => {
  it('최초 자연어 요청을 Backend DTO로 직렬화한다', async () => {
    const fetcher = vi.fn().mockResolvedValue(ack());
    const client = createConversationHttpClient('http://127.0.0.1:8080/', fetcher);
    const controller = new AbortController();
    await client.createSession({ requestId: 'request-1', messageId: 'message-1', content: '100만원으로 예금 가입해줘',
      siteId: 'demo-bank', initialPath: '/', clientOccurredAt: '2026-09-03T00:00:00Z' }, controller.signal);
    expect(fetcher).toHaveBeenCalledWith('http://127.0.0.1:8080/api/v1/sessions', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ requestId: 'request-1', messageId: 'message-1',
        content: '100만원으로 예금 가입해줘', siteId: 'demo-bank', initialPath: '/',
        clientOccurredAt: '2026-09-03T00:00:00Z' }), signal: controller.signal
    }));
  });

  it('후속 답변에 question과 expected identity를 전달한다', async () => {
    const fetcher = vi.fn().mockResolvedValue(ack());
    const client = createConversationHttpClient('http://127.0.0.1:8080', fetcher);
    await client.sendMessage('session-1', { requestId: 'request-1', messageId: 'message-1', content: '12개월',
      answerToQuestionId: 'question-1', expectedConversationSequence: 2, expectedGoalRevision: 1,
      clientOccurredAt: '2026-09-03T00:00:00Z' }, new AbortController().signal);
    const options = fetcher.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(options.body))).toMatchObject({ answerToQuestionId: 'question-1',
      expectedConversationSequence: 2, expectedGoalRevision: 1 });
  });

  it('ACK requestId 또는 messageId 불일치를 fail-closed 처리한다', async () => {
    const client = createConversationHttpClient('http://127.0.0.1:8080', vi.fn().mockResolvedValue(ack({ requestId: 'other' })));
    await expect(client.createSession({ requestId: 'request-1', messageId: 'message-1', content: '예금 가입',
      siteId: 'demo-bank', initialPath: '/', clientOccurredAt: '2026-09-03T00:00:00Z' }, new AbortController().signal))
      .rejects.toThrow('ACK_IDENTITY_MISMATCH');
  });

  it('AbortSignal을 GET snapshot까지 전달하고 자동 retry하지 않는다', async () => {
    const fetcher = vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError'));
    const client = createConversationHttpClient('http://127.0.0.1:8080', fetcher);
    const controller = new AbortController();
    controller.abort();
    await expect(client.getSnapshot('session-1', controller.signal)).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
