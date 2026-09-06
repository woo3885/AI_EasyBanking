import { formatWon } from '../data/demo-data';

export type DepositAmountValidationState =
  | 'EMPTY'
  | 'INVALID_FORMAT'
  | 'NON_POSITIVE'
  | 'BELOW_MINIMUM'
  | 'UNSAFE_INTEGER'
  | 'VALID';

export interface DepositAmountValidationResult {
  state: DepositAmountValidationState;
  numericAmount: number | null;
  formattedAmount: string | null;
  message: string;
}

export function validateDepositAmount(
  rawAmount: string,
  minimumAmount: number
): DepositAmountValidationResult {
  const normalizedAmount = rawAmount.trim();

  if (normalizedAmount === '') {
    return {
      state: 'EMPTY',
      numericAmount: null,
      formattedAmount: null,
      message: '가입 금액을 입력해 주세요.'
    };
  }

  if (!/^-?\d+$/u.test(normalizedAmount)) {
    return {
      state: 'INVALID_FORMAT',
      numericAmount: null,
      formattedAmount: null,
      message: '가입 금액은 쉼표 없이 숫자만 입력해 주세요.'
    };
  }

  const numericAmount = Number(normalizedAmount);

  if (numericAmount <= 0) {
    return {
      state: 'NON_POSITIVE',
      numericAmount,
      formattedAmount: null,
      message: '가입 금액은 1원 이상 입력해 주세요.'
    };
  }

  if (!Number.isSafeInteger(numericAmount)) {
    return {
      state: 'UNSAFE_INTEGER',
      numericAmount,
      formattedAmount: null,
      message: '입력할 수 있는 금액 범위를 초과했습니다.'
    };
  }

  if (numericAmount < minimumAmount) {
    return {
      state: 'BELOW_MINIMUM',
      numericAmount,
      formattedAmount: null,
      message: `최소 가입 금액 ${formatWon(minimumAmount)} 이상 입력해 주세요.`
    };
  }

  const formattedAmount = formatWon(numericAmount);

  return {
    state: 'VALID',
    numericAmount,
    formattedAmount,
    message: `${formattedAmount}을 가입 금액으로 사용할 수 있습니다.`
  };
}
