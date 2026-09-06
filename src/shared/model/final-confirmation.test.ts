import { describe, expect, it } from 'vitest';

import {
  analyzeFinalConfirmationSummary,
  canApproveFinalConfirmation,
  createFinalConfirmationSummaryItemElementId,
  type FinalConfirmationSummary
} from './final-confirmation';

const validSummary: FinalConfirmationSummary = {
  transactionType: '계좌이체 데모',
  items: [
    { id: 'source-account', label: '출금 계좌', value: '생활비 계좌' },
    { id: 'recipient', label: '수취인', value: '데모 수취인' },
    { id: 'amount', label: '금액', value: '100,000원' }
  ]
};

describe('final confirmation summary model', () => {
  it('유효한 summary를 입력 순서 그대로 READY로 분석한다', () => {
    const analysis = analyzeFinalConfirmationSummary(validSummary);

    expect(analysis.state).toBe('READY');
    expect(analysis.summary?.items.map(({ id }) => id)).toEqual([
      'source-account',
      'recipient',
      'amount'
    ]);
  });

  it('빈 items는 EMPTY이며 빈 transactionType은 INVALID다', () => {
    expect(
      analyzeFinalConfirmationSummary({
        transactionType: '계좌이체 데모',
        items: []
      }).state
    ).toBe('EMPTY');
    expect(
      analyzeFinalConfirmationSummary({
        transactionType: '   ',
        items: []
      }).state
    ).toBe('INVALID');
  });

  it.each([
    ['duplicate ID', [validSummary.items[0], validSummary.items[0]]],
    ['uppercase ID', [{ id: 'SOURCE_ACCOUNT', label: '항목', value: '값' }]],
    ['underscore ID', [{ id: 'source_account', label: '항목', value: '값' }]],
    ['slash ID', [{ id: 'source/account', label: '항목', value: '값' }]],
    ['space ID', [{ id: 'source account', label: '항목', value: '값' }]],
    ['special ID', [{ id: 'source@account', label: '항목', value: '값' }]],
    ['password ID', [{ id: 'password', label: '항목', value: '값' }]],
    ['OTP ID', [{ id: 'otp', label: '항목', value: '값' }]],
    ['PIN ID', [{ id: 'pin', label: '항목', value: '값' }]],
    ['verification code ID', [{ id: 'verification-code', label: '항목', value: '값' }]],
    ['certificate password ID', [{ id: 'certificate-password', label: '항목', value: '값' }]],
    ['account password ID', [{ id: 'account-password', label: '항목', value: '값' }]],
    ['long numeric ID', [{ id: '1234-5678', label: '항목', value: '값' }]],
    ['blank label', [{ id: 'safe-item', label: '   ', value: '값' }]],
    ['blank value', [{ id: 'safe-item', label: '항목', value: '   ' }]]
  ] satisfies Array<[string, FinalConfirmationSummary['items']]>)('잘못된 %s를 INVALID로 처리한다', (_, items) => {
    expect(
      analyzeFinalConfirmationSummary({
        transactionType: '데모 거래',
        items
      }).state
    ).toBe('INVALID');
  });

  it.each([
    ['주민등록번호 형태', '900101-1234567'],
    ['휴대전화번호 형태', '010-1234-5678'],
    ['일반 전화번호 형태', '02-1234-5678'],
    ['미마스킹 계좌번호 형태', '110-123-123456'],
    ['긴 미포맷 숫자', '123456789012']
  ])('%s value를 INVALID로 처리한다', (_, value) => {
    expect(
      analyzeFinalConfirmationSummary({
        transactionType: '데모 거래',
        items: [{ id: 'unsafe-value', label: '표시 값', value }]
      }).state
    ).toBe('INVALID');
  });

  it('민감 형태가 transactionType이나 label에 있어도 INVALID로 처리한다', () => {
    expect(
      analyzeFinalConfirmationSummary({
        transactionType: '010-1234-5678',
        items: [{ id: 'safe-item', label: '항목', value: '안전한 값' }]
      }).state
    ).toBe('INVALID');
    expect(
      analyzeFinalConfirmationSummary({
        transactionType: '데모 거래',
        items: [
          { id: 'safe-item', label: '110-123-123456', value: '안전한 값' }
        ]
      }).state
    ).toBe('INVALID');
  });

  it.each(['100,000원', '10,000,000원', '12개월', '1년', '30일'])(
    '정상 표시 문자열 %s을 허용한다',
    (value) => {
      expect(
        analyzeFinalConfirmationSummary({
          transactionType: '정기예금 가입 데모',
          items: [{ id: 'safe-value', label: '표시 값', value }]
        }).state
      ).toBe('READY');
    }
  );

  it('입력 객체와 items를 변경하지 않고 정규화된 복사본을 반환한다', () => {
    const sourceItem = Object.freeze({
      id: 'safe-item',
      label: '  표시 항목  ',
      value: '  안전한 값  '
    });
    const sourceItems = Object.freeze([sourceItem]);
    const sourceSummary = Object.freeze({
      transactionType: '  데모 거래  ',
      items: sourceItems
    });

    const analysis = analyzeFinalConfirmationSummary(sourceSummary);

    expect(sourceSummary.transactionType).toBe('  데모 거래  ');
    expect(sourceItem.label).toBe('  표시 항목  ');
    expect(sourceItem.value).toBe('  안전한 값  ');
    expect(analysis.summary).not.toBe(sourceSummary);
    expect(analysis.summary?.items).not.toBe(sourceItems);
    expect(analysis.summary).toEqual({
      transactionType: '데모 거래',
      items: [{ id: 'safe-item', label: '표시 항목', value: '안전한 값' }]
    });
  });

  it('공개 item ID로 selector를 만들고 invalid ID는 거부한다', () => {
    expect(createFinalConfirmationSummaryItemElementId('source-account')).toBe(
      'summary-final-confirmation-source-account'
    );
    expect(createFinalConfirmationSummaryItemElementId('INVALID_ID')).toBeNull();
  });

  it.each([
    ['confirmed=false', validSummary, false, false, false, false],
    ['EMPTY', { transactionType: '데모 거래', items: [] }, true, false, false, false],
    ['INVALID', { transactionType: '', items: validSummary.items }, true, false, false, false],
    ['disabled', validSummary, true, true, false, false],
    ['busy', validSummary, true, false, true, false],
    ['approvalRequested', validSummary, true, false, false, true]
  ] satisfies Array<[
    string,
    FinalConfirmationSummary,
    boolean,
    boolean,
    boolean,
    boolean
  ]>)('%s 상태에서는 승인을 차단한다', (_, summary, confirmed, disabled, isBusy, approvalRequested) => {
    expect(
      canApproveFinalConfirmation(
        summary,
        confirmed,
        disabled,
        isBusy,
        approvalRequested
      )
    ).toBe(false);
  });

  it('READY이며 사용자가 확인하고 차단 상태가 없을 때만 승인 가능하다', () => {
    expect(canApproveFinalConfirmation(validSummary, true)).toBe(true);
  });
});
