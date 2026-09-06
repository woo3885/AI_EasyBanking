import {
  parseAcceptedAck,
  parseConversationSnapshot,
  type ConversationAcceptedAck
} from './conversation-contract';
import type { ConversationSnapshot } from '../model/conversation-types';

export const DEFAULT_CONVERSATION_API_BASE_URL = 'http://127.0.0.1:8080';

export interface InitialConversationRequest {
  requestId: string;
  messageId: string;
  content: string;
  siteId: 'demo-bank';
  initialPath: '/' | '/deposit/products' | '/transfer/accounts';
  clientOccurredAt: string;
}

export interface FollowUpConversationRequest {
  requestId: string;
  messageId: string;
  content: string;
  answerToQuestionId: string | null;
  expectedConversationSequence: number;
  expectedGoalRevision: number;
  clientOccurredAt: string;
}

export interface ConversationHttpClient {
  createSession(request: InitialConversationRequest, signal: AbortSignal): Promise<ConversationAcceptedAck>;
  sendMessage(sessionId: string, request: FollowUpConversationRequest, signal: AbortSignal): Promise<ConversationAcceptedAck>;
  getSnapshot(sessionId: string, signal: AbortSignal): Promise<ConversationSnapshot>;
}

function assertIdentity(ack: ConversationAcceptedAck, requestId: string, messageId: string) {
  if (ack.requestId !== requestId || ack.messageId !== messageId) throw new Error('ACK_IDENTITY_MISMATCH');
}

async function responseJson(response: Response, expectedStatus: number): Promise<unknown> {
  if (response.status !== expectedStatus || !response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('UNSAFE_HTTP_RESPONSE');
  }
  return response.json();
}

export function createConversationHttpClient(
  baseUrl = import.meta.env.VITE_BACKEND_BASE_URL || DEFAULT_CONVERSATION_API_BASE_URL,
  fetcher: typeof fetch = fetch
): ConversationHttpClient {
  const normalizedBase = baseUrl.replace(/\/$/u, '');
  const post = async (path: string, body: object, signal: AbortSignal) => {
    const response = await fetcher(`${normalizedBase}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body), signal
    });
    const ack = parseAcceptedAck(await responseJson(response, 202));
    if (!ack) throw new Error('INVALID_ACK');
    return ack;
  };
  return {
    async createSession(request, signal) {
      const ack = await post('/api/v1/sessions', request, signal);
      assertIdentity(ack, request.requestId, request.messageId);
      return ack;
    },
    async sendMessage(sessionId, request, signal) {
      const ack = await post(`/api/v1/sessions/${encodeURIComponent(sessionId)}/messages`, request, signal);
      assertIdentity(ack, request.requestId, request.messageId);
      if (ack.sessionId !== sessionId) throw new Error('ACK_SESSION_MISMATCH');
      return ack;
    },
    async getSnapshot(sessionId, signal) {
      const response = await fetcher(`${normalizedBase}/api/v1/sessions/${encodeURIComponent(sessionId)}/conversation`, {
        method: 'GET', headers: { Accept: 'application/json' }, signal
      });
      const snapshot = parseConversationSnapshot(await responseJson(response, 200));
      if (!snapshot || snapshot.sessionId !== sessionId) throw new Error('INVALID_SNAPSHOT');
      return snapshot;
    }
  };
}
