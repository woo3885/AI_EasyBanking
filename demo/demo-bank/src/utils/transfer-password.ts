export type TransferPasswordInputState =
  | 'EMPTY'
  | 'ENTERED'
  | 'COMPLETION_RECORDED';

export function resolveTransferPasswordInputState(
  hasInput: boolean
): TransferPasswordInputState {
  return hasInput ? 'ENTERED' : 'EMPTY';
}
