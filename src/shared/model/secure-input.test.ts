import { describe, expect, it } from 'vitest';

import {
  canRequestSecureInputCompletion,
  getSecureInputPhase,
  getSecureInputStatusMessage,
  SECURE_INPUT_PHASE_MESSAGES,
  type SecureInputAvailability
} from './secure-input';

describe('secure-input model', () => {
  it('completionRequested에서 controlled phase를 파생한다', () => {
    expect(getSecureInputPhase(false)).toBe('WAITING_FOR_USER');
    expect(getSecureInputPhase(true)).toBe('COMPLETION_REQUESTED');
  });

  it('대기 중이고 busy 또는 disabled가 아닐 때만 완료를 요청할 수 있다', () => {
    expect(
      canRequestSecureInputCompletion({
        phase: 'WAITING_FOR_USER',
        disabled: false,
        isBusy: false
      })
    ).toBe(true);
  });

  it.each([
    {
      name: 'busy',
      availability: {
        phase: 'WAITING_FOR_USER',
        disabled: false,
        isBusy: true
      }
    },
    {
      name: 'disabled',
      availability: {
        phase: 'WAITING_FOR_USER',
        disabled: true,
        isBusy: false
      }
    },
    {
      name: 'completion requested',
      availability: {
        phase: 'COMPLETION_REQUESTED',
        disabled: false,
        isBusy: false
      }
    }
  ] satisfies Array<{
    name: string;
    availability: SecureInputAvailability;
  }>)('$name 상태에서는 완료 요청을 차단한다', ({ availability }) => {
    expect(canRequestSecureInputCompletion(availability)).toBe(false);
  });

  it('상태별 기본 문구는 완료 요청과 인증 성공을 구분한다', () => {
    const messages = Object.values(SECURE_INPUT_PHASE_MESSAGES).join(' ');

    expect(messages).toContain('직접 입력');
    expect(messages).toContain('요청을 전달');
    expect(messages).toContain('보호 모드를 유지');
    expect(messages).not.toMatch(/인증 성공|정답|검증 성공|자동화 재개/);
  });

  it('상태 우선순위에 맞는 안전한 문구를 반환한다', () => {
    expect(
      getSecureInputStatusMessage({
        phase: 'WAITING_FOR_USER',
        disabled: false,
        isBusy: true
      })
    ).toContain('처리하고 있습니다');
    expect(
      getSecureInputStatusMessage({
        phase: 'COMPLETION_REQUESTED',
        disabled: true,
        isBusy: false
      })
    ).toContain('요청을 전달했습니다');
    expect(
      getSecureInputStatusMessage({
        phase: 'WAITING_FOR_USER',
        disabled: true,
        isBusy: false
      })
    ).toContain('요청을 보낼 수 없습니다');
  });

  it('입력 객체를 변경하지 않는다', () => {
    const availability = Object.freeze({
      phase: 'WAITING_FOR_USER' as const,
      disabled: false,
      isBusy: false
    });
    const snapshot = { ...availability };

    canRequestSecureInputCompletion(availability);
    getSecureInputStatusMessage(availability);

    expect(availability).toEqual(snapshot);
  });

  it('모델 API는 보안 원문이나 길이 대신 boolean과 상태만 받는다', () => {
    expect(getSecureInputPhase).toHaveLength(1);
    expect(canRequestSecureInputCompletion).toHaveLength(1);
    expect(getSecureInputStatusMessage).toHaveLength(1);
  });
});
