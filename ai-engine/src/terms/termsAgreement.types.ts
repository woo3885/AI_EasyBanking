export type TermsRequirement =
  | "REQUIRED"
  | "OPTIONAL"
  | "UNKNOWN";

export type TermsCategory =
  | "SERVICE"
  | "PRIVACY"
  | "FINANCIAL_INFORMATION"
  | "MARKETING"
  | "THIRD_PARTY"
  | "IDENTITY_VERIFICATION"
  | "OTHER";

export interface TermsSourceElement {
  elementId: string;
  text: string;

  checked?: boolean;
  disabled?: boolean;
}

export interface DetectedTerm {
  termId: string;
  elementId: string;

  title: string;
  requirement: TermsRequirement;
  category: TermsCategory;

  /**
   * 고령층 사용자가 이해하기 쉬운 약관 설명입니다.
   */
  easySummary: string;

  checked: boolean;
  disabled: boolean;
}

export interface TermsAgreementResult {
  decisionType: "TERMS_AGREEMENT";

  detected: boolean;
  requiresUserAction: boolean;

  requiredTerms: DetectedTerm[];
  optionalTerms: DetectedTerm[];
  unknownTerms: DetectedTerm[];

  allRequiredAgreed: boolean;

  message: string;
  summary: string;
}