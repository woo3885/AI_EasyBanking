import { describe, expect, it } from 'vitest';

import {
  analyzeAgreementTerms,
  areAllRequiredAgreementTermsSelected,
  canConfirmTermsAgreement,
  createAgreementTermElementId,
  createTermsAgreementConfirmPayload,
  getKnownSelectedAgreementTermIds,
  getRequiredAgreementTermIds,
  hasUnknownSelectedAgreementTermId,
  isValidAgreementTermId,
  type AgreementTerm
} from './terms-agreement';

const terms: readonly AgreementTerm[] = [
  { id: 'service-agreement', label: '서비스 이용약관', required: true },
  {
    id: 'personal-information',
    label: '개인정보 수집·이용',
    required: true
  },
  { id: 'marketing-information', label: '마케팅 정보 수신', required: false }
];

describe('terms agreement model', () => {
  it.each(['service-agreement', 'term-1', 'personal-information'])(
    '공개 가능한 kebab-case ID %s를 허용한다',
    (termId) => {
      expect(isValidAgreementTermId(termId)).toBe(true);
    }
  );

  it.each([
    '',
    ' ',
    ' service-agreement',
    'service-agreement ',
    'Service-agreement',
    'service_agreement',
    'service/agreement',
    'service?agreement',
    '-service-agreement',
    'service-agreement-',
    'service--agreement',
    '110-123-456789'
  ])('안전하지 않은 ID %j를 거부한다', (termId) => {
    expect(isValidAgreementTermId(termId)).toBe(false);
    expect(createAgreementTermElementId(termId)).toBeNull();
  });

  it('유효한 ID로 고정 규칙의 DOM ID를 생성한다', () => {
    expect(createAgreementTermElementId('service-agreement')).toBe(
      'term-user-agreement-service-agreement'
    );
  });

  it('유효한 목록을 입력 순서 그대로 READY로 분석한다', () => {
    const analysis = analyzeAgreementTerms(terms);

    expect(analysis.state).toBe('READY');
    expect(analysis.terms.map(({ id }) => id)).toEqual([
      'service-agreement',
      'personal-information',
      'marketing-information'
    ]);
  });

  it('빈 목록을 EMPTY로 분석한다', () => {
    expect(analyzeAgreementTerms([])).toEqual({ state: 'EMPTY', terms: [] });
  });

  it.each([
    [[{ id: 'INVALID_ID', label: '약관', required: true }], '잘못된 ID'],
    [[{ id: 'blank-label', label: ' ', required: true }], '빈 label'],
    [
      [
        { id: 'same-term', label: '첫 약관', required: true },
        { id: 'same-term', label: '둘째 약관', required: false }
      ],
      '중복 ID'
    ]
  ] satisfies Array<[AgreementTerm[], string]>)(
    '%s 목록을 INVALID로 분석하고 원본을 노출하지 않는다',
    (invalidTerms) => {
      expect(analyzeAgreementTerms(invalidTerms)).toEqual({
        state: 'INVALID',
        terms: []
      });
    }
  );

  it('입력 배열과 term 객체를 변경하지 않고 반환 객체도 복제한다', () => {
    const mutableTerms = terms.map((term) => ({ ...term }));
    const original = mutableTerms.map((term) => ({ ...term }));
    const analysis = analyzeAgreementTerms(mutableTerms);

    analysis.terms[0].label = '변경된 반환값';
    analysis.terms.reverse();

    expect(mutableTerms).toEqual(original);
    expect(mutableTerms[0]).not.toBe(analysis.terms[0]);
  });

  it('필수 약관 ID만 입력 순서대로 반환한다', () => {
    expect(getRequiredAgreementTermIds(terms)).toEqual([
      'service-agreement',
      'personal-information'
    ]);
  });

  it('알려진 활성 선택 ID만 약관 순서대로 반환한다', () => {
    const withDisabled = [
      terms[0],
      { ...terms[1], disabled: true },
      terms[2]
    ];
    const selected = new Set([
      'marketing-information',
      'personal-information',
      'service-agreement'
    ]);

    expect(getKnownSelectedAgreementTermIds(withDisabled, selected)).toEqual([
      'service-agreement',
      'marketing-information'
    ]);
  });

  it('현재 목록에 없는 선택 ID를 감지한다', () => {
    expect(
      hasUnknownSelectedAgreementTermId(terms, new Set(['unknown-term']))
    ).toBe(true);
    expect(
      hasUnknownSelectedAgreementTermId(
        terms,
        new Set(['service-agreement'])
      )
    ).toBe(false);
  });

  it('필수 약관을 모두 선택해야 Gate를 연다', () => {
    expect(areAllRequiredAgreementTermsSelected(terms, new Set())).toBe(false);
    expect(
      areAllRequiredAgreementTermsSelected(
        terms,
        new Set(['service-agreement'])
      )
    ).toBe(false);
    expect(
      areAllRequiredAgreementTermsSelected(
        terms,
        new Set(['service-agreement', 'personal-information'])
      )
    ).toBe(true);
  });

  it('선택 약관의 선택 여부는 Gate에 영향을 주지 않는다', () => {
    const requiredSelected = new Set([
      'service-agreement',
      'personal-information'
    ]);
    const allSelected = new Set([...requiredSelected, 'marketing-information']);

    expect(canConfirmTermsAgreement(terms, requiredSelected)).toBe(true);
    expect(canConfirmTermsAgreement(terms, allSelected)).toBe(true);
  });

  it('필수 약관이 없는 READY 목록은 직접 확인할 수 있다', () => {
    const optionalTerms = [
      { id: 'optional-news', label: '소식 수신', required: false }
    ];

    expect(canConfirmTermsAgreement(optionalTerms, new Set())).toBe(true);
    expect(createTermsAgreementConfirmPayload(optionalTerms, new Set())).toEqual(
      []
    );
  });

  it('disabled 선택 약관은 Gate와 payload에서 제외한다', () => {
    const disabledOptionalTerms = [
      ...terms.slice(0, 2),
      { ...terms[2], disabled: true }
    ];
    const selected = new Set([
      'service-agreement',
      'personal-information',
      'marketing-information'
    ]);

    expect(canConfirmTermsAgreement(disabledOptionalTerms, selected)).toBe(true);
    expect(
      createTermsAgreementConfirmPayload(disabledOptionalTerms, selected)
    ).toEqual(['service-agreement', 'personal-information']);
  });

  it('disabled 필수 약관은 선택 Set에 있어도 Gate를 차단한다', () => {
    const disabledRequiredTerms = [
      { ...terms[0], disabled: true },
      terms[1],
      terms[2]
    ];
    const selected = new Set([
      'service-agreement',
      'personal-information'
    ]);

    expect(canConfirmTermsAgreement(disabledRequiredTerms, selected)).toBe(
      false
    );
    expect(
      createTermsAgreementConfirmPayload(disabledRequiredTerms, selected)
    ).toBeNull();
  });

  it('unknown 선택 ID는 조용히 제거하지 않고 Gate를 차단한다', () => {
    const selected = new Set([
      'service-agreement',
      'personal-information',
      'unknown-term'
    ]);

    expect(canConfirmTermsAgreement(terms, selected)).toBe(false);
    expect(createTermsAgreementConfirmPayload(terms, selected)).toBeNull();
  });

  it('panel disabled와 busy에서는 Gate를 차단한다', () => {
    const selected = new Set([
      'service-agreement',
      'personal-information'
    ]);

    expect(canConfirmTermsAgreement(terms, selected, true, false)).toBe(false);
    expect(canConfirmTermsAgreement(terms, selected, false, true)).toBe(false);
  });

  it('EMPTY와 INVALID 목록에서는 Gate와 payload를 차단한다', () => {
    const invalidTerms = [
      { id: 'same', label: '첫 약관', required: true },
      { id: 'same', label: '둘째 약관', required: true }
    ];

    expect(canConfirmTermsAgreement([], new Set())).toBe(false);
    expect(createTermsAgreementConfirmPayload([], new Set())).toBeNull();
    expect(canConfirmTermsAgreement(invalidTerms, new Set(['same']))).toBe(
      false
    );
    expect(
      createTermsAgreementConfirmPayload(invalidTerms, new Set(['same']))
    ).toBeNull();
  });

  it('payload는 선택된 활성 ID만 terms 순서대로 새 배열에 담는다', () => {
    const selected = new Set([
      'marketing-information',
      'personal-information',
      'service-agreement'
    ]);
    const originalSelected = new Set(selected);

    const firstPayload = createTermsAgreementConfirmPayload(terms, selected);
    const secondPayload = createTermsAgreementConfirmPayload(terms, selected);

    expect(firstPayload).toEqual([
      'service-agreement',
      'personal-information',
      'marketing-information'
    ]);
    expect(firstPayload).not.toBe(secondPayload);
    expect(selected).toEqual(originalSelected);
  });
});
