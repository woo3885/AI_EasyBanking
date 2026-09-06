import type {
  DetectedTerm,
  TermsCategory,
  TermsRequirement,
  TermsSourceElement,
} from "./termsAgreement.types.js";

const REQUIRED_KEYWORDS = [
  "필수",
  "반드시",
  "동의해야",
  "동의 필요",
];

const OPTIONAL_KEYWORDS = [
  "선택",
  "마케팅",
  "광고",
  "혜택 안내",
  "상품 안내",
];

function includesKeyword(
  text: string,
  keywords: string[],
): boolean {
  const normalized = text
    .replace(/\s+/g, " ")
    .toLowerCase();

  return keywords.some((keyword) =>
    normalized.includes(keyword.toLowerCase()),
  );
}

/**
 * 약관이 필수인지 선택인지 판단합니다.
 */
function detectRequirement(
  text: string,
): TermsRequirement {
  if (includesKeyword(text, REQUIRED_KEYWORDS)) {
    return "REQUIRED";
  }

  if (includesKeyword(text, OPTIONAL_KEYWORDS)) {
    return "OPTIONAL";
  }

  return "UNKNOWN";
}

/**
 * 약관의 종류를 판단합니다.
 */
function detectCategory(
  text: string,
): TermsCategory {
  const normalized = text.replace(/\s+/g, " ");

  if (
    normalized.includes("개인정보") &&
    normalized.includes("제3자")
  ) {
    return "THIRD_PARTY";
  }

  if (
    normalized.includes("개인정보") ||
    normalized.includes("개인 정보")
  ) {
    return "PRIVACY";
  }

  if (
    normalized.includes("금융정보") ||
    normalized.includes("신용정보")
  ) {
    return "FINANCIAL_INFORMATION";
  }

  if (
    normalized.includes("마케팅") ||
    normalized.includes("광고") ||
    normalized.includes("상품 안내")
  ) {
    return "MARKETING";
  }

  if (
    normalized.includes("본인확인") ||
    normalized.includes("본인 인증") ||
    normalized.includes("실명확인")
  ) {
    return "IDENTITY_VERIFICATION";
  }

  if (
    normalized.includes("서비스 이용") ||
    normalized.includes("이용약관")
  ) {
    return "SERVICE";
  }

  return "OTHER";
}

/**
 * 긴 약관 문구에서 화면에 표시할 제목을 추출합니다.
 */
function createTitle(
  text: string,
): string {
  const normalized = text
    .replace(/\s+/g, " ")
    .replace(
      /^\[(필수|선택)\]\s*/g,
      "",
    )
    .trim();

  if (normalized.length <= 35) {
    return normalized;
  }

  return `${normalized.slice(0, 34)}…`;
}

/**
 * 약관 종류별 쉬운 설명을 생성합니다.
 */
function createEasySummary(
  category: TermsCategory,
  requirement: TermsRequirement,
): string {
  const prefix =
    requirement === "REQUIRED"
      ? "서비스 이용에 꼭 필요한 동의예요."
      : requirement === "OPTIONAL"
        ? "동의하지 않아도 서비스를 이용할 수 있어요."
        : "내용을 확인한 뒤 동의 여부를 선택해 주세요.";

  switch (category) {
    case "SERVICE":
      return `서비스 이용 방법과 책임에 관한 내용이에요. ${prefix}`;

    case "PRIVACY":
      return `개인정보를 수집하고 이용하는 방법에 관한 내용이에요. ${prefix}`;

    case "FINANCIAL_INFORMATION":
      return `금융정보나 신용정보를 이용하는 방법에 관한 내용이에요. ${prefix}`;

    case "MARKETING":
      return "상품이나 혜택 안내를 받을지 선택하는 내용이에요. 동의하지 않아도 돼요.";

    case "THIRD_PARTY":
      return `개인정보를 다른 회사에 제공하는 내용이에요. ${prefix}`;

    case "IDENTITY_VERIFICATION":
      return `본인 확인을 위해 정보를 사용하는 내용이에요. ${prefix}`;

    default:
      return `약관 내용을 확인하고 동의 여부를 선택하는 항목이에요. ${prefix}`;
  }
}

/**
 * DOM에서 받은 체크박스 후보를 약관 항목으로 변환합니다.
 */
export function detectTerms(
  elements: TermsSourceElement[],
): DetectedTerm[] {
  const detected = elements
    .filter((element) => {
      const text = element.text.trim();

      return (
        text.length > 0 &&
        (
          text.includes("동의") ||
          text.includes("약관") ||
          text.includes("개인정보") ||
          text.includes("신용정보") ||
          text.includes("마케팅")
        )
      );
    })
    .map((element) => {
      const requirement =
        detectRequirement(element.text);

      const category =
        detectCategory(element.text);

      return {
        // Never invent a Production selection ID. Until Backend provides a
        // dedicated term ID, the trusted snapshot elementId is preserved.
        termId: element.elementId,
        elementId: element.elementId,

        title: createTitle(element.text),
        requirement,
        category,

        easySummary: createEasySummary(
          category,
          requirement,
        ),

        checked: element.checked ?? false,
        disabled: element.disabled ?? false,
      };
    });

  const seenIds = new Set<string>();

  for (const term of detected) {
    if (
      !term.termId ||
      term.termId !== term.termId.trim()
    ) {
      throw new Error(
        "[AI Engine] detected term must preserve a non-blank exact elementId.",
      );
    }

    if (seenIds.has(term.termId)) {
      throw new Error(
        `[AI Engine] duplicate detected term elementId: ${term.termId}`,
      );
    }

    seenIds.add(term.termId);
  }

  return detected;
}
