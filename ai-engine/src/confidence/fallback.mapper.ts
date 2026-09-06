import type {
  ConfidenceDecision,
  FallbackResult,
} from "./confidence.types.js";

/**
 * ConfidenceDecision을 사용자에게 보여줄
 * Fallback 결과로 변환합니다.
 *
 * HIGH confidence의 CONTINUE 상태에서는
 * Fallback 결과가 필요하지 않으므로 null을 반환합니다.
 */
export function createFallbackResult(
  decision: ConfidenceDecision,
): FallbackResult | null {
  if (
    decision.action === "CONTINUE"
  ) {
    return null;
  }

  if (
    decision.action ===
    "ASK_CLARIFICATION"
  ) {
    return {
      decisionType: "FALLBACK",

      confidence:
        decision.confidence,

      confidenceLevel:
        decision.level,

      fallbackAction:
        "ASK_CLARIFICATION",

      requiresUserAction: true,

      message:
        "요청을 정확히 이해했는지 한 번 더 확인할게요.",

      options: null,

      reason:
        decision.reason,
    };
  }

  return {
    decisionType: "FALLBACK",

    confidence:
      decision.confidence,

    confidenceLevel:
      decision.level,

    fallbackAction:
      "DIRECT_SELECTION",

    requiresUserAction: true,

    message:
      "원하는 업무를 직접 선택해 주세요.",

    options: [
      "예금 상품 찾기",
      "송금하기",
      "계좌 조회",
      "한도 변경",
      "기타 업무",
    ],

    reason:
      decision.reason,
  };
}

export function stringifyFallbackResult(
  result: FallbackResult,
): string {
  return JSON.stringify(
    result,
    null,
    2,
  );
}