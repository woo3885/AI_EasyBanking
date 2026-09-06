export type SecureInputType =
  | "PASSWORD"
  | "OTP"
  | "PIN"
  | "AUTH_CODE"
  | "SECURITY_CARD"
  | "CERTIFICATE_PASSWORD"
  | "UNKNOWN";

export interface SecureInputSource {
  elementId?: string;

  /**
   * 화면 제목, label, placeholder 등
   * 민감 입력 판단에 사용할 텍스트입니다.
   */
  text: string;

  elementType?: string;
}

export interface SecureInputDetection {
  detected: boolean;

  secureInputType: SecureInputType | null;

  targetElementId: string | null;

  confidence: number;

  reason: string;
}

export interface SecureInputResult {
  decisionType: "SECURE_INPUT";

  secureInputType: SecureInputType;

  targetElementId: string | null;

  requiresUserAction: true;

  /**
   * AI가 값을 입력해서는 안 되는지를 나타냅니다.
   */
  aiInputBlocked: true;

  message: string;

  confidence: number;

  reason: string;
}