export type ActionRiskLevel =
  | "SAFE"
  | "CONFIRM_REQUIRED"
  | "BLOCKED";

export type RemoteActionType =
  | "CLICK"
  | "INPUT"
  | "SCROLL"
  | "BACK";

export interface ActionPolicyResult {
  riskLevel: ActionRiskLevel;
  canExecute: boolean;
  requiresConfirmation: boolean;
  reason: string;
}

const CONFIRM_REQUIRED_KEYWORDS = [
  "로그인",
  "가입",
  "신청",
  "제출",
  "송금",
  "이체",
  "결제",
  "구매",
  "개설",
  "해지",
  "동의",
  "인증",
  "전자서명",
  "대출",
  "한도조회",
  "자동이체",
];

const BLOCKED_KEYWORDS = [
  "비밀번호 입력",
  "인증번호 입력",
  "otp 입력",
  "보안카드 입력",
  "주민등록번호 입력",
  "보안 우회",
];

const SAFE_KEYWORDS = [
  "메뉴",
  "조회",
  "상세보기",
  "검색",
  "뒤로",
  "다음 페이지",
  "이전 페이지",
  "금리순",
  "상품 비교",
  "스크롤",
];

function normalizeText(text: string): string {
  return text.trim().toLowerCase();
}

function containsKeyword(
  text: string,
  keywords: string[],
): string | undefined {
  return keywords.find((keyword) =>
    text.includes(keyword.toLowerCase()),
  );
}

export function evaluateActionPolicy(
  action: RemoteActionType,
  elementText: string,
): ActionPolicyResult {
  const normalizedText = normalizeText(elementText);

  const blockedKeyword = containsKeyword(
    normalizedText,
    BLOCKED_KEYWORDS,
  );

  if (blockedKeyword) {
    return {
      riskLevel: "BLOCKED",
      canExecute: false,
      requiresConfirmation: false,
      reason: `"${blockedKeyword}" 관련 행동은 AI가 대신 수행할 수 없습니다.`,
    };
  }

  const confirmationKeyword = containsKeyword(
    normalizedText,
    CONFIRM_REQUIRED_KEYWORDS,
  );

  if (confirmationKeyword) {
    return {
      riskLevel: "CONFIRM_REQUIRED",
      canExecute: false,
      requiresConfirmation: true,
      reason: `"${confirmationKeyword}" 행동은 사용자의 명시적인 확인이 필요합니다.`,
    };
  }

  if (action === "INPUT") {
    return {
      riskLevel: "CONFIRM_REQUIRED",
      canExecute: false,
      requiresConfirmation: true,
      reason: "입력 행동은 개인정보가 포함될 수 있으므로 확인이 필요합니다.",
    };
  }

  const safeKeyword = containsKeyword(
    normalizedText,
    SAFE_KEYWORDS,
  );

  if (safeKeyword || action === "SCROLL" || action === "BACK") {
    return {
      riskLevel: "SAFE",
      canExecute: true,
      requiresConfirmation: false,
      reason: "조회 또는 화면 탐색 목적의 안전한 행동입니다.",
    };
  }

  return {
    riskLevel: "CONFIRM_REQUIRED",
    canExecute: false,
    requiresConfirmation: true,
    reason:
      "행동의 영향을 명확하게 판단할 수 없어 사용자 확인이 필요합니다.",
  };
}