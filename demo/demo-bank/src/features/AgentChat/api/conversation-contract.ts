import type {
  ActiveConversationQuestion,
  ConversationMessage,
  ConversationServerEvent,
  ConversationSnapshot,
  ConversationWorkflowStatus
} from '../model/conversation-types';
import {
  parseOverlayClearEvent,
  parseOverlayTargetEvent,
  parseUserActionObservedEvent,
  type OverlayParseContext
} from './overlay-contract';

export const SAFE_AI_RESPONSE_ERROR = 'AI 응답을 처리하지 못했습니다. 다시 시도해 주세요.';

export interface ConversationAcceptedAck {
  sessionId: string;
  requestId: string;
  messageId: string;
  acceptedSequence: number;
  queueStatus: 'ACTIVE' | 'PENDING';
  workflowStatus: ConversationWorkflowStatus;
  acceptedAt: string;
  duplicate: boolean;
}

const workflowStatuses = new Set<ConversationWorkflowStatus>([
  'SESSION_CREATED', 'AI_EXECUTING', 'ADDITIONAL_INFORMATION_REQUIRED',
  'PAGE_LOADING', 'USER_DECISION_REQUIRED',
  'SECURE_INPUT_REQUIRED', 'RISK_WARNING', 'FINAL_CONFIRMATION_REQUIRED',
  'COMPLETED', 'CANCELLED', 'ERROR', 'TERMINATED'
]);

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown, max = 500): value is string {
  return typeof value === 'string' && value.trim().length > 0 && Array.from(value).length <= max;
}

function positive(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function nonNegative(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function status(value: unknown): value is ConversationWorkflowStatus {
  return typeof value === 'string' && workflowStatuses.has(value as ConversationWorkflowStatus);
}

function envelopeData(value: unknown): Record<string, unknown> | null {
  const root = record(value);
  return root?.success === true && root.errorCode === null &&
    (root.message === null || typeof root.message === 'string')
    ? record(root.data)
    : null;
}

function parseQuestion(value: unknown): ActiveConversationQuestion | null | undefined {
  if (value === null) return null;
  const item = record(value);
  if (!item || !text(item.questionId, 128) || !text(item.messageId, 128) ||
      !positive(item.sequence) || !nonNegative(item.goalRevision) ||
      !text(item.text) || !text(item.occurredAt, 64)) return undefined;
  return {
    questionId: item.questionId,
    messageId: item.messageId,
    sequence: item.sequence,
    goalRevision: item.goalRevision,
    text: item.text,
    occurredAt: item.occurredAt
  };
}

function parseMessage(value: unknown): ConversationMessage | null {
  const item = record(value);
  if (!item || !text(item.messageId, 128) || !positive(item.sequence) ||
      !text(item.content) || !text(item.occurredAt, 64) ||
      (item.role !== 'USER' && item.role !== 'AI') ||
      (item.kind !== 'MESSAGE' && item.kind !== 'QUESTION') ||
      (item.goalRevision !== null && !nonNegative(item.goalRevision))) return null;
  if (item.kind === 'QUESTION') {
    if (item.role !== 'AI' || !text(item.questionId, 128) || !nonNegative(item.goalRevision)) return null;
    return {
      messageId: item.messageId,
      requestId: typeof item.requestId === 'string' ? item.requestId : null,
      role: 'AI', kind: 'QUESTION', sequence: item.sequence,
      text: item.content, questionId: item.questionId,
      goalRevision: item.goalRevision as number, occurredAt: item.occurredAt
    };
  }
  return {
    messageId: item.messageId,
    requestId: typeof item.requestId === 'string' ? item.requestId : null,
    role: item.role, kind: 'MESSAGE', sequence: item.sequence,
    text: item.content, questionId: null,
    goalRevision: item.goalRevision as number | null, occurredAt: item.occurredAt
  };
}

export function parseAcceptedAck(payload: unknown): ConversationAcceptedAck | null {
  const data = envelopeData(payload);
  if (!data || !text(data.sessionId, 128) || !text(data.requestId, 128) ||
      !text(data.messageId, 128) || !positive(data.acceptedSequence) ||
      (data.queueStatus !== 'ACTIVE' && data.queueStatus !== 'PENDING') ||
      !status(data.workflowStatus) || !text(data.acceptedAt, 64) ||
      typeof data.duplicate !== 'boolean') return null;
  return data as unknown as ConversationAcceptedAck;
}

export function parseConversationSnapshot(payload: unknown): ConversationSnapshot | null {
  const data = envelopeData(payload);
  if (!data || !text(data.snapshotId, 128) || !text(data.sessionId, 128) ||
      !nonNegative(data.eventSequence) || !nonNegative(data.conversationSequence) ||
      !nonNegative(data.goalRevision) || !record(data.userGoal) ||
      !status(data.workflowStatus) || !text(data.expiresAt, 64) ||
      !Array.isArray(data.recentSafeMessages)) return null;
  const activeQuestion = parseQuestion(data.activeQuestion);
  if (activeQuestion === undefined) return null;
  const messages = data.recentSafeMessages.map(parseMessage);
  if (messages.some((message) => message === null)) return null;
  return {
    snapshotId: data.snapshotId,
    sessionId: data.sessionId,
    eventSequence: data.eventSequence,
    conversationSequence: data.conversationSequence,
    goalRevision: data.goalRevision,
    userGoal: data.userGoal as Record<string, unknown>,
    activeQuestion,
    recentSafeMessages: messages as ConversationMessage[],
    workflowStatus: data.workflowStatus,
    expiresAt: data.expiresAt
  };
}

export function parseConversationEvent(
  payload: unknown,
  overlayContext?: OverlayParseContext
): ConversationServerEvent | null {
  const item = record(payload);
  if (item?.eventType === 'OVERLAY_TARGET') {
    return overlayContext ? parseOverlayTargetEvent(item, overlayContext) : null;
  }
  if (item?.eventType === 'OVERLAY_CLEAR') {
    return overlayContext ? parseOverlayClearEvent(item, overlayContext) : null;
  }
  if (item?.eventType === 'USER_ACTION_OBSERVED') {
    return overlayContext ? parseUserActionObservedEvent(item, overlayContext) : null;
  }
  if (!item || !text(item.eventId, 128) || !positive(item.eventSequence) ||
      !text(item.sessionId, 128) || !status(item.workflowStatus) ||
      !text(item.occurredAt, 64) || !text(item.messageId, 128)) return null;
  const common = {
    eventId: item.eventId, eventSequence: item.eventSequence,
    sessionId: item.sessionId, workflowStatus: item.workflowStatus,
    occurredAt: item.occurredAt, messageId: item.messageId
  };
  if (item.eventType === 'USER_MESSAGE_ACCEPTED' && positive(item.acceptedSequence)) {
    return { ...common, eventType: 'USER_MESSAGE_ACCEPTED', acceptedSequence: item.acceptedSequence };
  }
  if ((item.eventType === 'AI_QUESTION' || item.eventType === 'AI_MESSAGE') &&
      positive(item.sequence) && nonNegative(item.goalRevision) && text(item.text) &&
      item.kind === (item.eventType === 'AI_QUESTION' ? 'QUESTION' : 'MESSAGE')) {
    if (item.eventType === 'AI_QUESTION') {
      if (!text(item.questionId, 128)) return null;
      return { ...common, eventType: 'AI_QUESTION', sequence: item.sequence,
        questionId: item.questionId, text: item.text, kind: 'QUESTION', goalRevision: item.goalRevision };
    }
    if (item.errorCode !== null && typeof item.errorCode !== 'string') return null;
    return { ...common, eventType: 'AI_MESSAGE', sequence: item.sequence,
      text: item.errorCode === null ? item.text : SAFE_AI_RESPONSE_ERROR,
      kind: 'MESSAGE', goalRevision: item.goalRevision,
      errorCode: item.errorCode as string | null };
  }
  return null;
}
