import { ELEMENT_IDS } from '../constants/element-ids';

export interface DepositTerm {
  id: string;
  label: string;
  required: boolean;
  summary: string;
  itemElementId: string;
  checkboxElementId: string;
}

export const depositTerms: DepositTerm[] = [
  {
    id: 'service-required',
    label: '서비스 이용약관',
    required: true,
    summary: '데모 예금 서비스 이용 조건을 안내하는 Mock 약관입니다.',
    itemElementId: ELEMENT_IDS.TERM_SERVICE_REQUIRED,
    checkboxElementId: ELEMENT_IDS.CHECKBOX_TERM_SERVICE_REQUIRED
  },
  {
    id: 'privacy-required',
    label: '개인정보 수집·이용',
    required: true,
    summary: '데모 흐름에 필요한 개인정보 처리 범위를 안내합니다.',
    itemElementId: ELEMENT_IDS.TERM_PRIVACY_REQUIRED,
    checkboxElementId: ELEMENT_IDS.CHECKBOX_TERM_PRIVACY_REQUIRED
  },
  {
    id: 'marketing-optional',
    label: '마케팅 정보 수신',
    required: false,
    summary: '데모 상품과 혜택 안내 수신 여부를 선택하는 항목입니다.',
    itemElementId: ELEMENT_IDS.TERM_MARKETING_OPTIONAL,
    checkboxElementId: ELEMENT_IDS.CHECKBOX_TERM_MARKETING_OPTIONAL
  }
];
