import { formatWon } from '../data/demo-data';

export type TransferAmountValidationState =
  | 'EMPTY'
  | 'INVALID_FORMAT'
  | 'NON_POSITIVE'
  | 'UNSAFE_INTEGER'
  | 'EXCEEDS_BALANCE'
  | 'VALID';

export interface TransferAmountValidationResult {
  state: TransferAmountValidationState;
  parsedAmount: number | null;
  formattedAmount: string | null;
  message: string;
}

export function validateTransferAmount(
  rawAmount: string,
  availableBalance: number
): TransferAmountValidationResult {
  const normalizedAmount = rawAmount.trim();

  if (normalizedAmount === '') {
    return {
      state: 'EMPTY',
      parsedAmount: null,
      formattedAmount: null,
      message: '이체 금액을 입력해 주세요.'
    };
  }

  if (!/^-?\d+$/u.test(normalizedAmount)) {
    return {
      state: 'INVALID_FORMAT',
      parsedAmount: null,
      formattedAmount: null,
      message: '이체 금액은 쉼표 없이 숫자만 입력해 주세요.'
    };
  }

  const parsedAmount = Number(normalizedAmount);

  if (parsedAmount <= 0) {
    return {
      state: 'NON_POSITIVE',
      parsedAmount,
      formattedAmount: null,
      message: '이체 금액은 1원 이상 입력해 주세요.'
    };
  }

  if (!Number.isSafeInteger(parsedAmount)) {
    return {
      state: 'UNSAFE_INTEGER',
      parsedAmount,
      formattedAmount: null,
      message: '입력할 수 있는 금액 범위를 초과했습니다.'
    };
  }

  if (parsedAmount > availableBalance) {
    return {
      state: 'EXCEEDS_BALANCE',
      parsedAmount,
      formattedAmount: null,
      message: `출금 가능 Mock 잔액 ${formatWon(availableBalance)} 이하로 입력해 주세요.`
    };
  }

  const formattedAmount = formatWon(parsedAmount);

  return {
    state: 'VALID',
    parsedAmount,
    formattedAmount,
    message: `${formattedAmount}을 입력했습니다.`
  };
}
