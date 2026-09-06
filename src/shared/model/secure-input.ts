export type SecureInputPhase =
  | 'WAITING_FOR_USER'
  | 'COMPLETION_REQUESTED';

export interface SecureInputAvailability {
  phase: SecureInputPhase;
  disabled: boolean;
  isBusy: boolean;
}

export const SECURE_INPUT_PHASE_MESSAGES: Record<
  SecureInputPhase,
  string
> = {
  WAITING_FOR_USER:
    '원격 금융 화면에서 보안 정보를 직접 입력한 뒤 입력 완료 버튼을 눌러 주세요.',
  COMPLETION_REQUESTED:
    '입력 완료 요청을 전달했습니다. 안전 확인이 끝날 때까지 보호 모드를 유지합니다.'
};

export const SECURE_INPUT_BUSY_MESSAGE =
  '입력 완료 요청을 처리하고 있습니다. 안전 확인 전까지 보호 모드를 유지합니다.';

export const SECURE_INPUT_DISABLED_MESSAGE =
  '현재는 입력 완료 요청을 보낼 수 없습니다. 보호 모드를 유지해 주세요.';

export function getSecureInputPhase(
  completionRequested: boolean
): SecureInputPhase {
  return completionRequested
    ? 'COMPLETION_REQUESTED'
    : 'WAITING_FOR_USER';
}

export function canRequestSecureInputCompletion(
  availability: SecureInputAvailability
): boolean {
  return (
    availability.phase === 'WAITING_FOR_USER' &&
    !availability.disabled &&
    !availability.isBusy
  );
}

export function getSecureInputStatusMessage(
  availability: SecureInputAvailability
): string {
  if (availability.isBusy) {
    return SECURE_INPUT_BUSY_MESSAGE;
  }

  if (availability.phase === 'COMPLETION_REQUESTED') {
    return SECURE_INPUT_PHASE_MESSAGES.COMPLETION_REQUESTED;
  }

  if (availability.disabled) {
    return SECURE_INPUT_DISABLED_MESSAGE;
  }

  return SECURE_INPUT_PHASE_MESSAGES.WAITING_FOR_USER;
}
