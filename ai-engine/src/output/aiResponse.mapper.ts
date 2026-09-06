import type {
  NextActionDecision,
} from "../actions/nextAction.types.js";

import type {
  BrowserActionType,
  StructuredAIResponse,
} from "./aiResponse.types.js";

export interface AIResponseMapperOptions {
  requestId: string;
  message?: string;
}

function mapActionType(
  action: NextActionDecision["action"],
): BrowserActionType {
  switch (action) {
    case "TYPE":
      return "TYPE";

    case "CLICK":
      return "CLICK";

    case "SCROLL":
      return "SCROLL";

    case "NONE":
      return "NONE";
  }
}

function requiresUserAction(
  decision: NextActionDecision,
): boolean {
  const text = decision.reason.toLowerCase();

  const keywords = [
    "가입",
    "신청",
    "이체",
    "송금",
    "결제",
    "제출",
    "해지",
    "최종 확인",
    "사용자 확인",
  ];

  return keywords.some((keyword) =>
    text.includes(keyword),
  );
}

export function mapDecisionToAIResponse(
  decision: NextActionDecision,
  options: AIResponseMapperOptions,
): StructuredAIResponse {
  const action = mapActionType(decision.action);
  const userActionRequired =
    requiresUserAction(decision);

  return {
    requestId: options.requestId,

    status: userActionRequired
      ? "USER_DECISION_REQUIRED"
      : "AI_EXECUTING",

    action,

    targetElementId:
      action === "CLICK" || action === "TYPE"
        ? decision.targetId ?? null
        : null,

    inputValue:
      action === "TYPE"
        ? decision.value ?? null
        : null,

    message:
      options.message?.trim() ||
      "다음 작업을 확인하고 있어요.",

    confidence: Math.max(
      0,
      Math.min(1, decision.confidence),
    ),

    requiresUserAction: userActionRequired,

    decisionType: null,
    secureInputType: null,
    riskType: null,
    options: null,
    confirmationId: null,
    summary: null,
  };
}

export function stringifyAIResponse(
  response: StructuredAIResponse,
): string {
  return JSON.stringify(response, null, 2);
}