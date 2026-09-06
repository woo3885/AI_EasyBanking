export interface RiskWarningDetails {
  message: string;
}

export interface RiskWarningPresentation {
  message: string;
  guidance: readonly string[];
  usedFallback: boolean;
}

export interface RiskCancelAvailability {
  cancelRequested: boolean;
  disabled: boolean;
  isBusy: boolean;
  canCancel: boolean;
}

export const RISK_WARNING_FALLBACK_MESSAGE =
  '금융사기 또는 보이스피싱 위험이 감지될 수 있어 현재 금융 절차를 계속 진행하지 않습니다.';

export const RISK_WARNING_GUIDANCE = Object.freeze([
  '송금·가입·인증 절차를 계속하지 마세요.',
  '상대방이 알려 준 연락처를 사용하지 마세요.',
  '금융기관의 공식 앱이나 웹사이트에서 연락처를 직접 확인하세요.',
  '비밀번호·OTP·인증번호를 누구에게도 전달하지 마세요.'
] as const);

const RESIDENT_REGISTRATION_NUMBER_PATTERN = /\b\d{6}\s*-\s*[1-4]\d{6}\b/;
const MOBILE_PHONE_NUMBER_PATTERN = /\b01[016789][ -]?\d{3,4}[ -]?\d{4}\b/;
const LANDLINE_PHONE_NUMBER_PATTERN =
  /\b(?:02|0[3-6][1-5])[ -]?\d{3,4}[ -]?\d{4}\b/;
const UNMASKED_GROUPED_ACCOUNT_NUMBER_PATTERN =
  /\b\d{2,6}(?:-\d{2,6}){2,4}\b/;
const LONG_UNFORMATTED_NUMBER_PATTERN = /\b\d{10,16}\b/;
const RAW_CREDENTIAL_PATTERN =
  /(?:비밀번호|OTP|인증번호)\s*(?:은|는|:|=)?\s*[A-Za-z0-9!@#$%^&*]{4,}/i;

function containsSensitiveNumber(message: string): boolean {
  return (
    RESIDENT_REGISTRATION_NUMBER_PATTERN.test(message) ||
    MOBILE_PHONE_NUMBER_PATTERN.test(message) ||
    LANDLINE_PHONE_NUMBER_PATTERN.test(message) ||
    UNMASKED_GROUPED_ACCOUNT_NUMBER_PATTERN.test(message) ||
    LONG_UNFORMATTED_NUMBER_PATTERN.test(message) ||
    RAW_CREDENTIAL_PATTERN.test(message)
  );
}

export function createRiskWarningPresentation(
  details: RiskWarningDetails
): RiskWarningPresentation {
  const normalizedMessage = details.message.trim();
  const usedFallback =
    normalizedMessage.length === 0 || containsSensitiveNumber(normalizedMessage);

  return Object.freeze({
    message: usedFallback
      ? RISK_WARNING_FALLBACK_MESSAGE
      : normalizedMessage,
    guidance: RISK_WARNING_GUIDANCE,
    usedFallback
  });
}

export function canRequestRiskCancellation(
  availability: RiskCancelAvailability
): boolean {
  return (
    availability.canCancel &&
    !availability.disabled &&
    !availability.isBusy &&
    !availability.cancelRequested
  );
}
