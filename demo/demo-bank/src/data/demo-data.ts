import { ELEMENT_IDS } from '../constants/element-ids';

export interface DepositProduct {
  id: string;
  name: string;
  periodLabel: string;
  interestRateLabel: string;
  minimumAmount: number;
  description: string;
  cardElementId: string;
  selectButtonElementId: string;
}

export interface DemoAccount {
  id: string;
  label: string;
  bankName: string;
  maskedAccountNumber: string;
  balance: number;
  cardElementId: string;
  selectButtonElementId: string;
}

export const depositProducts: DepositProduct[] = [
  {
    id: 'deposit-12m',
    name: '12개월 정기예금',
    periodLabel: '12개월',
    interestRateLabel: '연 3.20%',
    minimumAmount: 100_000,
    description: '안정적인 목돈 운용을 위한 기본 예금 상품',
    cardElementId: ELEMENT_IDS.PRODUCT_DEPOSIT_12M,
    selectButtonElementId: ELEMENT_IDS.BUTTON_SELECT_DEPOSIT_12M
  },
  {
    id: 'deposit-preferred',
    name: '우대금리 정기예금',
    periodLabel: '12개월',
    interestRateLabel: '연 3.50%',
    minimumAmount: 1_000_000,
    description: '조건 충족 시 우대금리를 제공하는 예금 상품',
    cardElementId: ELEMENT_IDS.PRODUCT_DEPOSIT_PREFERRED,
    selectButtonElementId: ELEMENT_IDS.BUTTON_SELECT_DEPOSIT_PREFERRED
  }
];

/** D25·D27 정기예금 공동 시나리오에서 사용자가 명시한 Demo 가입 금액. */
export const DEMO_DEPOSIT_CONFIRMATION_AMOUNT = 1_000_000;

export const demoAccounts: DemoAccount[] = [
  {
    id: 'living-expense',
    label: '생활비 계좌',
    bankName: '데모은행',
    maskedAccountNumber: '110-***-123456',
    balance: 2_500_000,
    cardElementId: ELEMENT_IDS.ACCOUNT_LIVING_EXPENSE,
    selectButtonElementId:
      ELEMENT_IDS.BUTTON_SELECT_ACCOUNT_LIVING_EXPENSE
  },
  {
    id: 'savings',
    label: '저축 계좌',
    bankName: '데모은행',
    maskedAccountNumber: '220-***-654321',
    balance: 10_000_000,
    cardElementId: ELEMENT_IDS.ACCOUNT_SAVINGS,
    selectButtonElementId: ELEMENT_IDS.BUTTON_SELECT_ACCOUNT_SAVINGS
  }
];

const wonFormatter = new Intl.NumberFormat('ko-KR');

export function formatWon(amount: number): string {
  return `${wonFormatter.format(amount)}원`;
}
