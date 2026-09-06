import type { ConversationSubmitPhase } from './conversation-types';

// Day 1 Frontend provisional values. Backend shared limits must replace these
// after the Day 2 request contract is agreed.
export const CHAT_MESSAGE_MAX_LENGTH = 500;
export const CHAT_MESSAGE_MAX_LINES = 5;

export type ChatMessagePolicyIssue =
  | 'EMPTY'
  | 'TOO_LONG'
  | 'TOO_MANY_LINES'
  | 'CONTROL_CHARACTER'
  | 'SENSITIVE_INFORMATION'
  | 'SUBMISSION_PENDING';

export interface ChatMessagePolicyResult {
  normalizedMessage: string;
  length: number;
  lineCount: number;
  isValid: boolean;
  issues: ChatMessagePolicyIssue[];
  safeError: string | null;
}

export const CHAT_EMPTY_ERROR = '안전한 업무 요청을 입력해 주세요.';
export const CHAT_FORMAT_ERROR =
  '요청을 짧고 쉽게 정리해 다시 입력해 주세요.';
export const CHAT_SENSITIVE_ERROR =
  '비밀번호나 인증번호는 채팅에 입력할 수 없습니다.';
export const CHAT_PENDING_ERROR = '이전 요청의 응답을 기다리고 있습니다.';

const CONTROL_CHARACTER_PATTERN =
  /[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/u;
const SENSITIVE_CONTEXT_PATTERN =
  /(?:비밀번호|패스워드|\bpassword\b|\bpasswd\b|\botp\b|\bpin\b|핀\s*번호|인증\s*(?:번호|코드))/iu;

export function isConversationSubmissionPending(
  submitPhase: ConversationSubmitPhase
) {
  return (
    submitPhase === 'SUBMITTING' ||
    submitPhase === 'WAITING_FOR_ACK' ||
    submitPhase === 'WAITING_FOR_AI'
  );
}

export function validateChatMessage(
  message: string,
  options: { isSubmissionPending?: boolean } = {}
): ChatMessagePolicyResult {
  const normalizedMessage = message.trim();
  const length = Array.from(normalizedMessage).length;
  const lineCount = normalizedMessage
    ? normalizedMessage.split(/\r\n?|\n/u).length
    : 0;
  const issues: ChatMessagePolicyIssue[] = [];

  if (!normalizedMessage) {
    issues.push('EMPTY');
  }
  if (length > CHAT_MESSAGE_MAX_LENGTH) {
    issues.push('TOO_LONG');
  }
  if (lineCount > CHAT_MESSAGE_MAX_LINES) {
    issues.push('TOO_MANY_LINES');
  }
  if (CONTROL_CHARACTER_PATTERN.test(normalizedMessage)) {
    issues.push('CONTROL_CHARACTER');
  }
  if (SENSITIVE_CONTEXT_PATTERN.test(normalizedMessage)) {
    issues.push('SENSITIVE_INFORMATION');
  }
  if (options.isSubmissionPending) {
    issues.push('SUBMISSION_PENDING');
  }

  let safeError: string | null = null;
  if (issues.includes('SENSITIVE_INFORMATION')) {
    safeError = CHAT_SENSITIVE_ERROR;
  } else if (issues.includes('SUBMISSION_PENDING')) {
    safeError = CHAT_PENDING_ERROR;
  } else if (issues.includes('EMPTY')) {
    safeError = CHAT_EMPTY_ERROR;
  } else if (issues.length > 0) {
    safeError = CHAT_FORMAT_ERROR;
  }

  return {
    normalizedMessage,
    length,
    lineCount,
    isValid: issues.length === 0,
    issues,
    safeError
  };
}
