import type {
  ConfidenceDecision,
  ConfidenceInput,
} from "./confidence.types.js";

export const HIGH_CONFIDENCE_THRESHOLD = 0.8;
export const MEDIUM_CONFIDENCE_THRESHOLD = 0.5;

/**
 * confidence 값은 0~1 범위로 보정합니다.
 */
function normalizeConfidence(
  confidence: number,
): number {
  if (confidence < 0) {
    return 0;
  }

  if (confidence > 1) {
    return 1;
  }

  return confidence;
}

/**
 * AI 판단의 confidence를 공통 기준으로 평가합니다.
 *
 * HIGH
 * - 기존 판단 흐름을 계속 진행할 수 있습니다.
 *
 * MEDIUM
 * - 사용자의 의도를 한 번 더 확인합니다.
 *
 * LOW
 * - AI가 임의로 판단하지 않고 사용자가 직접 선택합니다.
 */
export function evaluateConfidence(
  input: ConfidenceInput,
): ConfidenceDecision {
  const confidence =
    normalizeConfidence(
      input.confidence,
    );

  /**
   * 사용자의 요청 자체가 불명확하다고
   * 명시된 경우 confidence와 관계없이
   * 추가 확인을 요청합니다.
   */
  if (input.ambiguous) {
    return {
      confidence,

      level:
        confidence >=
        HIGH_CONFIDENCE_THRESHOLD
          ? "HIGH"
          : confidence >=
              MEDIUM_CONFIDENCE_THRESHOLD
            ? "MEDIUM"
            : "LOW",

      action: "ASK_CLARIFICATION",

      requiresUserAction: true,

      reason:
        "사용자의 요청이 여러 의미로 해석될 수 있어 추가 확인이 필요합니다.",
    };
  }

  if (
    confidence >=
    HIGH_CONFIDENCE_THRESHOLD
  ) {
    return {
      confidence,

      level: "HIGH",

      action: "CONTINUE",

      requiresUserAction: false,

      reason:
        "신뢰도가 높아 현재 판단을 계속 진행할 수 있습니다.",
    };
  }

  if (
    confidence >=
    MEDIUM_CONFIDENCE_THRESHOLD
  ) {
    return {
      confidence,

      level: "MEDIUM",

      action: "ASK_CLARIFICATION",

      requiresUserAction: true,

      reason:
        "판단이 다소 불명확하여 사용자에게 한 번 더 확인해야 합니다.",
    };
  }

  return {
    confidence,

    level: "LOW",

    action: "DIRECT_SELECTION",

    requiresUserAction: true,

    reason:
      "신뢰도가 낮아 AI가 임의로 결정하지 않고 사용자가 직접 선택해야 합니다.",
  };
}