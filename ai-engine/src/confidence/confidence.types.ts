export type ConfidenceLevel =
  | "HIGH"
  | "MEDIUM"
  | "LOW";

export type ConfidenceAction =
  | "CONTINUE"
  | "ASK_CLARIFICATION"
  | "DIRECT_SELECTION";

export interface ConfidenceInput {
  confidence: number;

  /**
   * 어떤 AI 판단 결과의 confidence인지 표시합니다.
   */
  source:
    | "INTENT"
    | "USER_GOAL"
    | "NEXT_ACTION"
    | "SECURE_INPUT"
    | "FINAL_CONFIRMATION"
    | "RISK_WARNING"
    | "OTHER";

  /**
   * 사용자의 요청 자체가 불명확하다고
   * 별도로 판단된 경우 사용합니다.
   */
  ambiguous?: boolean;
}

export interface ConfidenceDecision {
  confidence: number;

  level: ConfidenceLevel;

  action: ConfidenceAction;

  requiresUserAction: boolean;

  reason: string;
}

export interface FallbackResult {
  decisionType: "FALLBACK";

  confidence: number;

  confidenceLevel: ConfidenceLevel;

  fallbackAction:
    | "ASK_CLARIFICATION"
    | "DIRECT_SELECTION";

  requiresUserAction: true;

  message: string;

  options: string[] | null;

  reason: string;
}