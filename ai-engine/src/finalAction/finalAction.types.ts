export type FinalActionType =
  | "TRANSFER"
  | "SUBSCRIPTION"
  | "CANCELLATION"
  | "LIMIT_CHANGE"
  | "PAYMENT"
  | "UNKNOWN";

export interface FinalActionSource {
  elementId?: string;

  /**
   * 버튼, 링크, 화면 문구 등
   * 최종 거래 여부를 판단할 텍스트입니다.
   */
  text: string;

  elementType?: string;
}

export interface FinalActionDetection {
  detected: boolean;

  finalActionType: FinalActionType | null;

  targetElementId: string | null;

  confidence: number;

  reason: string;
}

export interface FinalConfirmationResult {
  decisionType: "FINAL_CONFIRMATION";

  finalActionType: FinalActionType;

  targetElementId: string | null;

  requiresUserAction: true;

  /**
   * 사용자 확인 전에는 실행하면 안 됩니다.
   */
  executionBlocked: true;

  confirmationId: null;

  message: string;

  summary: null;

  confidence: number;

  reason: string;
}
