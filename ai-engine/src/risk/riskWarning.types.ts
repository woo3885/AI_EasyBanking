export type RiskType =
  | "VOICE_PHISHING"
  | "SAFE_ACCOUNT_SCAM"
  | "PRESSURED_TRANSFER"
  | "IMPERSONATION"
  | "REMOTE_APP_REQUEST"
  | "UNKNOWN";

export type RiskLevel =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export interface RiskSource {
  /**
   * 사용자가 입력한 문장 또는 현재 화면 문구입니다.
   */
  text: string;

  sourceType?:
    | "USER_MESSAGE"
    | "PAGE_TEXT"
    | "ELEMENT_TEXT";
}

export interface RiskDetection {
  detected: boolean;

  riskType: RiskType | null;

  riskLevel: RiskLevel | null;

  confidence: number;

  matchedKeywords: string[];

  reason: string;
}

export interface RiskWarningResult {
  decisionType: "RISK_WARNING";

  riskType: RiskType;

  riskLevel: RiskLevel;

  requiresUserAction: true;

  /**
   * 위험 상황에서는 AI의 금융 거래 진행을 중단합니다.
   */
  transactionBlocked: true;

  message: string;

  summary: string;

  confidence: number;

  matchedKeywords: string[];

  reason: string;
}