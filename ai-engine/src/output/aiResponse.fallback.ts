import type { StructuredAIResponse } from "./aiResponse.types.js";

export function createStructuredFallbackResponse(
  requestId: string,
): StructuredAIResponse {
  return {
    requestId,
    status: "ERROR",
    action: "NONE",
    targetElementId: null,
    inputValue: null,
    message:
      "현재 AI 응답을 생성하기 어렵습니다. 잠시 후 다시 시도하거나 필요한 작업을 직접 선택해주세요.",
    confidence: 0,
    requiresUserAction: true,
    decisionType: null,
    secureInputType: null,
    riskType: null,
    options: null,
    confirmationId: null,
    summary: null,
  };
}