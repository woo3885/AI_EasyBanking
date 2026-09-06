import { describe, expect, it } from 'vitest';

import {
  canRequestRiskCancellation,
  createRiskWarningPresentation,
  RISK_WARNING_FALLBACK_MESSAGE,
  RISK_WARNING_GUIDANCE,
  type RiskWarningDetails
} from './risk-warning';

describe('risk warning presentation model', () => {
  it('정상 message를 trim해서 그대로 표시한다', () => {
    const result = createRiskWarningPresentation({
      message: '  의심스러운 송금 요청일 수 있어 확인이 필요합니다.  '
    });

    expect(result).toMatchObject({
      message: '의심스러운 송금 요청일 수 있어 확인이 필요합니다.',
      usedFallback: false
    });
  });

  it.each(['', '   '])('빈 message %j를 fallback으로 대체한다', (message) => {
    expect(createRiskWarningPresentation({ message })).toMatchObject({
      message: RISK_WARNING_FALLBACK_MESSAGE,
      usedFallback: true
    });
  });

  it.each([
    ['주민등록번호 형태', '확인 값은 900101-1234567입니다.'],
    ['휴대전화번호 형태', '연락처는 010-1234-5678입니다.'],
    ['일반 전화번호 형태', '연락처는 02-1234-5678입니다.'],
    ['미마스킹 계좌번호 형태', '계좌는 110-123-123456입니다.'],
    ['긴 숫자 형태', '확인 값은 123456789012입니다.'],
    ['비밀번호 원문 의심 형태', '비밀번호는 demo1234입니다.'],
    ['OTP 원문 의심 형태', 'OTP: 123456'],
    ['인증번호 원문 의심 형태', '인증번호는 A1B2C3입니다.']
  ])('%s를 fallback으로 대체한다', (_, message) => {
    expect(createRiskWarningPresentation({ message })).toMatchObject({
      message: RISK_WARNING_FALLBACK_MESSAGE,
      usedFallback: true
    });
  });

  it.each([
    '100만 원을 보내 달라는 요청을 다시 확인하세요.',
    '공식 앱이나 웹사이트에서 확인하세요.'
  ])('안전한 일반 안내 %j를 허용한다', (message) => {
    expect(createRiskWarningPresentation({ message })).toMatchObject({
      message,
      usedFallback: false
    });
  });

  it('HTML처럼 보이는 문자열을 실행용으로 변환하지 않고 text로 유지한다', () => {
    const message = '<strong>의심스러운 요청일 수 있습니다.</strong>';

    expect(createRiskWarningPresentation({ message }).message).toBe(message);
  });

  it('고정 guidance를 빈 값과 중복 없이 정해진 순서로 제공한다', () => {
    const presentation = createRiskWarningPresentation({ message: '위험 안내' });

    expect(presentation.guidance).toEqual(RISK_WARNING_GUIDANCE);
    expect(presentation.guidance).toHaveLength(4);
    expect(presentation.guidance.every((item) => item.trim().length > 0)).toBe(
      true
    );
    expect(new Set(presentation.guidance).size).toBe(
      presentation.guidance.length
    );
    expect(presentation.guidance).toEqual([
      '송금·가입·인증 절차를 계속하지 마세요.',
      '상대방이 알려 준 연락처를 사용하지 마세요.',
      '금융기관의 공식 앱이나 웹사이트에서 연락처를 직접 확인하세요.',
      '비밀번호·OTP·인증번호를 누구에게도 전달하지 마세요.'
    ]);
  });

  it('입력 객체를 변경하지 않고 불변 presentation을 반환한다', () => {
    const details = Object.freeze<RiskWarningDetails>({
      message: '  위험 가능성을 확인해 주세요.  '
    });
    const result = createRiskWarningPresentation(details);

    expect(details.message).toBe('  위험 가능성을 확인해 주세요.  ');
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.guidance)).toBe(true);
  });
});

describe('risk cancellation gate', () => {
  it('모든 허용 조건을 만족할 때만 취소 요청을 허용한다', () => {
    expect(
      canRequestRiskCancellation({
        canCancel: true,
        disabled: false,
        isBusy: false,
        cancelRequested: false
      })
    ).toBe(true);
  });

  it.each([
    ['canCancel=false', { canCancel: false }],
    ['disabled=true', { disabled: true }],
    ['isBusy=true', { isBusy: true }],
    ['cancelRequested=true', { cancelRequested: true }]
  ])('%s이면 취소 요청을 차단한다', (_, override) => {
    expect(
      canRequestRiskCancellation({
        canCancel: true,
        disabled: false,
        isBusy: false,
        cancelRequested: false,
        ...override
      })
    ).toBe(false);
  });
});
