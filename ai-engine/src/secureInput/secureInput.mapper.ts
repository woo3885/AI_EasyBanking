import type {
  SecureInputDetection,
  SecureInputResult,
  SecureInputType,
} from "./secureInput.types.js";

function createSecureInputMessage(
  type: SecureInputType,
): string {
  switch (type) {
    case "PASSWORD":
      return "비밀번호는 직접 입력해 주세요.";

    case "OTP":
      return "OTP 번호는 직접 입력해 주세요.";

    case "PIN":
      return "PIN 번호는 직접 입력해 주세요.";

    case "AUTH_CODE":
      return "인증번호는 직접 입력해 주세요.";

    case "SECURITY_CARD":
      return "보안카드 정보는 직접 입력해 주세요.";

    case "CERTIFICATE_PASSWORD":
      return "인증서 비밀번호는 직접 입력해 주세요.";

    default:
      return "중요한 인증 정보는 직접 입력해 주세요.";
  }
}

/**
 * 민감 입력 탐지 결과를 SECURE_INPUT 결과로 변환합니다.
 *
 * B팀 보안 규칙이 최종 판단보다 우선하며,
 * 이 결과는 AI 측 보조 판단 정보입니다.
 */
export function createSecureInputResult(
  detection: SecureInputDetection,
): SecureInputResult | null {
  if (
    !detection.detected ||
    !detection.secureInputType
  ) {
    return null;
  }

  return {
    decisionType: "SECURE_INPUT",

    secureInputType:
      detection.secureInputType,

    targetElementId:
      detection.targetElementId,

    requiresUserAction: true,

    aiInputBlocked: true,

    message: createSecureInputMessage(
      detection.secureInputType,
    ),

    confidence: detection.confidence,

    reason: detection.reason,
  };
}

export function stringifySecureInputResult(
  result: SecureInputResult,
): string {
  return JSON.stringify(
    result,
    null,
    2,
  );
}