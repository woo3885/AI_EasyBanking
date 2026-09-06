import type {
  SecureInputDetection,
  SecureInputSource,
  SecureInputType,
} from "./secureInput.types.js";

interface SecureInputRule {
  type: SecureInputType;
  keywords: string[];
  confidence: number;
}

const SECURE_INPUT_RULES: SecureInputRule[] = [
  {
    type: "CERTIFICATE_PASSWORD",
    keywords: [
      "인증서 비밀번호",
      "공동인증서 비밀번호",
      "금융인증서 비밀번호",
    ],
    confidence: 0.98,
  },

  {
    type: "SECURITY_CARD",
    keywords: [
      "보안카드",
      "보안 카드",
      "보안카드 번호",
    ],
    confidence: 0.98,
  },

  {
    type: "OTP",
    keywords: [
      "otp",
      "일회용 비밀번호",
      "일회용 인증번호",
      "일회용 인증 번호",
    ],
    confidence: 0.98,
  },

  {
    type: "PASSWORD",
    keywords: [
      "계좌 비밀번호",
      "로그인 비밀번호",
      "비밀번호",
      "password",
    ],
    confidence: 0.95,
  },

  {
    type: "PIN",
    keywords: [
      "핀번호",
      "핀 번호",
      "pin 번호",
      "pin number",
    ],
    confidence: 0.93,
  },

  {
    type: "AUTH_CODE",
    keywords: [
      "인증번호",
      "인증 번호",
      "문자로 받은 번호",
      "sms 인증",
      "문자 인증",
    ],
    confidence: 0.9,
  },
];

function normalizeText(
  value: string,
): string {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * 하나의 화면 요소가 민감정보 직접 입력 대상인지 판단합니다.
 */
export function detectSecureInput(
  source: SecureInputSource,
): SecureInputDetection {
  const normalized =
    normalizeText(source.text);

  for (const rule of SECURE_INPUT_RULES) {
    const matchedKeyword =
      rule.keywords.find((keyword) =>
        normalized.includes(
          keyword.toLowerCase(),
        ),
      );

    if (!matchedKeyword) {
      continue;
    }

    return {
      detected: true,

      secureInputType: rule.type,

      targetElementId:
        source.elementId ?? null,

      confidence: rule.confidence,

      reason:
        `"${matchedKeyword}" 표현이 감지되어 ` +
        `${rule.type} 직접 입력 화면으로 판단했습니다.`,
    };
  }

  return {
    detected: false,

    secureInputType: null,

    targetElementId:
      source.elementId ?? null,

    confidence: 0,

    reason:
      "민감정보 직접 입력 화면으로 판단할 표현을 찾지 못했습니다.",
  };
}

/**
 * 여러 DOM 요소 중 민감 입력 요소를 탐지합니다.
 */
export function detectSecureInputs(
  sources: SecureInputSource[],
): SecureInputDetection[] {
  return sources
    .map(detectSecureInput)
    .filter(
      (result) => result.detected,
    );
}