import { describe, expect, it } from 'vitest';

import {
  analyzeUserDecisionOptions,
  canConfirmUserDecision,
  createUserDecisionOptionElementId,
  getSelectedUserDecisionOption,
  isValidUserDecisionOptionId,
  type UserDecisionOption
} from './user-decision';

const validOptions: readonly UserDecisionOption[] = [
  { id: 'deposit-12m', label: 'Mock 정기예금' },
  { id: 'deposit-preferred', label: 'Mock 우대 상품', disabled: true }
];

describe('user decision model', () => {
  it.each(['deposit-12m', 'living-expense', 'hong-gildong'])(
    '유효한 kebab-case ID %s를 허용한다',
    (optionId) => {
      expect(isValidUserDecisionOptionId(optionId)).toBe(true);
    }
  );

  it.each([
    '',
    '   ',
    ' deposit-12m',
    'deposit-12m ',
    'Deposit-12m',
    'deposit_12m',
    'deposit/12m',
    'deposit?term=12',
    '<deposit>',
    '110-123-456789'
  ])('안전하지 않은 ID %j를 거부한다', (optionId) => {
    expect(isValidUserDecisionOptionId(optionId)).toBe(false);
    expect(createUserDecisionOptionElementId(optionId)).toBeNull();
  });

  it('유효한 option ID로 고정 DOM ID를 생성한다', () => {
    expect(createUserDecisionOptionElementId('deposit-12m')).toBe(
      'option-user-decision-deposit-12m'
    );
  });

  it('빈 options를 EMPTY로 분류한다', () => {
    expect(analyzeUserDecisionOptions([])).toEqual({
      state: 'EMPTY',
      options: []
    });
  });

  it('유효한 options를 입력 순서 그대로 READY로 분류한다', () => {
    const analysis = analyzeUserDecisionOptions(validOptions);

    expect(analysis.state).toBe('READY');
    expect(analysis.options.map(({ id }) => id)).toEqual([
      'deposit-12m',
      'deposit-preferred'
    ]);
  });

  it.each([
    [[{ id: 'INVALID_ID', label: '항목' }], '잘못된 ID'],
    [
      [
        { id: 'same-option', label: '첫 번째' },
        { id: 'same-option', label: '두 번째' }
      ],
      '중복 ID'
    ],
    [[{ id: 'empty-label', label: '' }], '빈 label'],
    [[{ id: 'blank-label', label: '   ' }], '공백 label']
  ] satisfies Array<[UserDecisionOption[], string]>)(
    '%s 목록을 INVALID로 분류한다',
    (options) => {
      expect(analyzeUserDecisionOptions(options)).toEqual({
        state: 'INVALID',
        options: []
      });
    }
  );

  it('입력 배열과 option 객체를 변경하지 않는다', () => {
    const first = { id: 'first-option', label: '첫 번째' };
    const second = { id: 'second-option', label: '두 번째' };
    const options = [first, second];
    const originalArray = [...options];
    const originalFirst = { ...first };

    analyzeUserDecisionOptions(options);

    expect(options).toEqual(originalArray);
    expect(first).toEqual(originalFirst);
    expect(options[0]).toBe(first);
  });

  it('반환 객체의 외부 변경이 다음 호출 결과를 오염시키지 않는다', () => {
    const firstAnalysis = analyzeUserDecisionOptions(validOptions);

    firstAnalysis.options[0].label = '외부에서 변경한 label';
    firstAnalysis.options.reverse();

    const secondAnalysis = analyzeUserDecisionOptions(validOptions);
    expect(secondAnalysis.options.map(({ label }) => label)).toEqual([
      'Mock 정기예금',
      'Mock 우대 상품'
    ]);
  });

  it('존재하고 활성화된 selected ID만 반환한다', () => {
    expect(
      getSelectedUserDecisionOption(validOptions, 'deposit-12m')
    ).toMatchObject({ id: 'deposit-12m' });
    expect(getSelectedUserDecisionOption(validOptions, null)).toBeNull();
    expect(
      getSelectedUserDecisionOption(validOptions, 'unknown-option')
    ).toBeNull();
    expect(
      getSelectedUserDecisionOption(validOptions, 'deposit-preferred')
    ).toBeNull();
  });

  it('유효 선택과 panel 상태를 함께 사용해 confirm 가능 여부를 판단한다', () => {
    expect(canConfirmUserDecision(validOptions, 'deposit-12m')).toBe(true);
    expect(canConfirmUserDecision(validOptions, null)).toBe(false);
    expect(
      canConfirmUserDecision(validOptions, 'deposit-preferred')
    ).toBe(false);
    expect(
      canConfirmUserDecision(validOptions, 'deposit-12m', true, false)
    ).toBe(false);
    expect(
      canConfirmUserDecision(validOptions, 'deposit-12m', false, true)
    ).toBe(false);
  });

  it('INVALID 목록에서는 선택과 confirm을 허용하지 않는다', () => {
    const invalidOptions = [
      { id: 'duplicate', label: '첫 번째' },
      { id: 'duplicate', label: '두 번째' }
    ];

    expect(
      getSelectedUserDecisionOption(invalidOptions, 'duplicate')
    ).toBeNull();
    expect(canConfirmUserDecision(invalidOptions, 'duplicate')).toBe(false);
  });
});
