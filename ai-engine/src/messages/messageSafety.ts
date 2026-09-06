const MAX_INTERNAL_MESSAGE_LENGTH = 160;
const MAX_DECISION_LABEL_LENGTH = 120;

export const SAFE_INTERNAL_MESSAGE =
  "사용자 확인이 필요한 단계입니다.";

export const SAFE_DECISION_LABEL =
  "선택 항목";

const FORBIDDEN_TECHNICAL_CONTENT = [
  /chain[ -]?of[ -]?thought/i,
  /raw reasoning/i,
  /system prompt/i,
  /developer message/i,
  /prompt injection/i,
  /프롬프트/i,
  /stack trace/i,
  /\bat\s+\S+\s*\([^)]*:\d+:\d+\)/i,
  /\b(?:gemini|gpt|openai|claude)\b/i,
  /https?:\/\//i,
  /\/api\//i,
  /\blocalhost(?::\d+)?\b/i,
  /<\/?[a-z][^>]*>/i,
  /\belementId\b/i,
  /\b(?:selector|xpath|raw dom)\b/i,
  /(?:가입|인증|거래).{0,12}(?:완료|성공)/,
  /(?:추천 상품|추천드|가장 좋|자동 선택|자동 동의)/,
];

const SENSITIVE_VALUE_PATTERNS = [
  /\b\d{6}\s*-\s*[1-4]\d{6}\b/g,
  /\b01[016789][\s-]?\d{3,4}[\s-]?\d{4}\b/g,
  /\b(?:otp|인증번호)\s*[:=]?\s*\d{4,8}\b/gi,
  /\bpin\s*[:=]?\s*\d{4,8}\b/gi,
  /\b(?:password|비밀번호)\s*[:=]\s*\S+/gi,
  /(?:password|비밀번호)(?:는|가|은|이)?\s+[A-Za-z0-9!@#$%^&*_\-]{4,}/gi,
  /\b(?:account|계좌)\s*[:=]?\s*\d[\d\s-]{7,}\d\b/gi,
  /\b\d{13,19}\b/g,
  /\b\d{2,6}(?:[- ]\d{2,6}){2,4}\b/g,
];

export function sanitizeInternalMessage(
  value: string,
): string {
  let normalized = value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return SAFE_INTERNAL_MESSAGE;
  }

  if (
    FORBIDDEN_TECHNICAL_CONTENT.some((pattern) =>
      pattern.test(normalized),
    )
  ) {
    return SAFE_INTERNAL_MESSAGE;
  }

  for (const pattern of SENSITIVE_VALUE_PATTERNS) {
    normalized = normalized.replace(
      pattern,
      "[보호됨]",
    );
  }

  if (normalized.length > MAX_INTERNAL_MESSAGE_LENGTH) {
    normalized = normalized.slice(
      0,
      MAX_INTERNAL_MESSAGE_LENGTH,
    ).trimEnd();
  }

  return normalized || SAFE_INTERNAL_MESSAGE;
}

export function sanitizeDecisionLabel(
  value: string,
): string {
  const sanitized = sanitizeInternalMessage(
    value,
  );

  if (sanitized === SAFE_INTERNAL_MESSAGE) {
    return SAFE_DECISION_LABEL;
  }

  const label = sanitized.slice(
    0,
    MAX_DECISION_LABEL_LENGTH,
  ).trimEnd();

  return label || SAFE_DECISION_LABEL;
}
