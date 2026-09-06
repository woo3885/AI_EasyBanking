export type SensitiveDataType =
  | "PASSWORD"
  | "AUTH_CODE"
  | "ACCOUNT_NUMBER"
  | "CARD_NUMBER"
  | "RESIDENT_NUMBER"
  | "PHONE_NUMBER"
  | "UNKNOWN";

export interface SensitiveDataDetectionResult {
  detected: boolean;
  types: SensitiveDataType[];
  maskedText: string;
}

const SENSITIVE_PATTERNS: Array<{
  type: SensitiveDataType;
  pattern: RegExp;
}> = [
  {
    type: "RESIDENT_NUMBER",
    pattern: /\b\d{6}-?[1-4]\d{6}\b/g,
  },
  {
    type: "CARD_NUMBER",
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  },
  {
    type: "PHONE_NUMBER",
    pattern: /\b01[016789][-\s]?\d{3,4}[-\s]?\d{4}\b/g,
  },
];

export function detectSensitiveData(
  text: string,
): SensitiveDataDetectionResult {
  let maskedText = text;
  const detectedTypes = new Set<SensitiveDataType>();

  for (const { type, pattern } of SENSITIVE_PATTERNS) {
    const matches = maskedText.match(pattern);

    if (!matches) {
      continue;
    }

    detectedTypes.add(type);
    maskedText = maskedText.replace(pattern, "[민감정보 숨김]");
  }

  return {
    detected: detectedTypes.size > 0,
    types: [...detectedTypes],
    maskedText,
  };
}

export function getSensitiveInputGuide(
  fieldLabel: string,
): string {
  return `${fieldLabel} 항목은 민감정보가 포함될 수 있습니다. 보안을 위해 사용자가 직접 입력해 주세요.`;
}