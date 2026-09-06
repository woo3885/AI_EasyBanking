import { describe, expect, it } from 'vitest';

import {
  CHAT_MESSAGE_MAX_LENGTH,
  CHAT_SENSITIVE_ERROR,
  validateChatMessage
} from '../../src/features/AgentChat/model/chat-message-policy';

describe('chat-message-policy', () => {
  it.each([
    '예금 상품 알아보기',
    '100만 원으로 예금 가입하기',
    '1000000원을 12개월 예금에 넣고 싶어요'
  ])('정상 금융 요청 %s을 허용한다', (message) => {
    expect(validateChatMessage(message)).toMatchObject({
      normalizedMessage: message,
      isValid: true,
      issues: []
    });
  });

  it('빈 문자열과 공백만 있는 문자열을 차단한다', () => {
    expect(validateChatMessage('   ').issues).toContain('EMPTY');
  });

  it('길이, 줄 수, 제어 문자 기준을 각각 검증한다', () => {
    expect(
      validateChatMessage('a'.repeat(CHAT_MESSAGE_MAX_LENGTH + 1)).issues
    ).toContain('TOO_LONG');
    expect(validateChatMessage('1\n2\n3\n4\n5\n6').issues).toContain(
      'TOO_MANY_LINES'
    );
    expect(validateChatMessage('예금\u0007가입').issues).toContain(
      'CONTROL_CHARACTER'
    );
  });

  it.each([
    '비밀번호는 1234야',
    'OTP 938201',
    'PIN 번호 7788',
    '인증번호를 123456으로 입력해'
  ])('민감정보 문맥 %s를 고정 안내로 차단한다', (message) => {
    const result = validateChatMessage(message);

    expect(result.issues).toContain('SENSITIVE_INFORMATION');
    expect(result.safeError).toBe(CHAT_SENSITIVE_ERROR);
    expect(result.safeError).not.toContain('1234');
    expect(result.safeError).not.toContain('938201');
  });

  it('요청 처리 중에는 중복 제출을 차단한다', () => {
    const result = validateChatMessage('예금 상품 알아보기', {
      isSubmissionPending: true
    });

    expect(result.issues).toContain('SUBMISSION_PENDING');
    expect(result.isValid).toBe(false);
  });
});
