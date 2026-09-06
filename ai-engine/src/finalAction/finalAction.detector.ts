import type {
  FinalActionDetection,
  FinalActionSource,
  FinalActionType,
} from "./finalAction.types.js";

interface FinalActionRule {
  type: FinalActionType;
  keywords: string[];
  confidence: number;
}

const FINAL_ACTION_RULES: FinalActionRule[] = [
  {
    type: "TRANSFER",
    keywords: [
      "이체하기",
      "송금하기",
      "이체 실행",
      "송금 실행",
      "보내기",
    ],
    confidence: 0.98,
  },

  {
    type: "SUBSCRIPTION",
    keywords: [
      "가입하기",
      "가입 신청",
      "상품 가입",
      "예금 가입",
      "적금 가입",
    ],
    confidence: 0.97,
  },

  {
    type: "CANCELLATION",
    keywords: [
      "해지하기",
      "해지 신청",
      "상품 해지",
      "예금 해지",
      "적금 해지",
    ],
    confidence: 0.98,
  },

  {
    type: "LIMIT_CHANGE",
    keywords: [
      "한도 변경",
      "한도변경",
      "변경 신청",
    ],
    confidence: 0.94,
  },

  {
    type: "PAYMENT",
    keywords: [
      "결제하기",
      "결제 완료",
      "결제 진행",
    ],
    confidence: 0.97,
  },
];

/**
 * 조회·안내처럼 실제 거래가 아닌 문구입니다.
 */
const NON_FINAL_KEYWORDS = [
  "조회",
  "내역",
  "안내",
  "방법",
  "설명",
  "확인만",
  "취소 방법",
  "해지 방법",
  "가입 방법",
];

function normalizeText(
  value: string,
): string {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function containsNonFinalKeyword(
  text: string,
): boolean {
  return NON_FINAL_KEYWORDS.some(
    (keyword) =>
      text.includes(
        keyword.toLowerCase(),
      ),
  );
}

/**
 * 화면 요소가 실제 금융 거래를 실행하는
 * 최종 Action인지 판단합니다.
 */
export function detectFinalAction(
  source: FinalActionSource,
): FinalActionDetection {
  const normalized =
    normalizeText(source.text);

  if (containsNonFinalKeyword(normalized)) {
    return {
      detected: false,
      finalActionType: null,

      targetElementId:
        source.elementId ?? null,

      confidence: 0,

      reason:
        "조회 또는 안내 목적의 문구이므로 최종 거래로 판단하지 않았습니다.",
    };
  }

  for (const rule of FINAL_ACTION_RULES) {
    const matchedKeyword =
      rule.keywords.find(
        (keyword) =>
          normalized.includes(
            keyword.toLowerCase(),
          ),
      );

    if (!matchedKeyword) {
      continue;
    }

    return {
      detected: true,

      finalActionType: rule.type,

      targetElementId:
        source.elementId ?? null,

      confidence: rule.confidence,

      reason:
        `"${matchedKeyword}" 표현이 감지되어 ` +
        `${rule.type} 최종 거래로 판단했습니다.`,
    };
  }

  return {
    detected: false,

    finalActionType: null,

    targetElementId:
      source.elementId ?? null,

    confidence: 0,

    reason:
      "최종 거래를 실행하는 표현을 찾지 못했습니다.",
  };
}