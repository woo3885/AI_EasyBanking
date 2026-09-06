export type DepositPasswordInputState =
  | 'EMPTY'
  | 'ENTERED'
  | 'COMPLETION_RECORDED';

export function getDepositPasswordInputState(
  hasInput: boolean
): DepositPasswordInputState {
  return hasInput ? 'ENTERED' : 'EMPTY';
}
