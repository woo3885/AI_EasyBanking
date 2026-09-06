export type TransferOtpInputState =
  | 'EMPTY'
  | 'ENTERED'
  | 'COMPLETION_RECORDED';

export function getTransferOtpInputState(
  hasInput: boolean
): TransferOtpInputState {
  return hasInput ? 'ENTERED' : 'EMPTY';
}
