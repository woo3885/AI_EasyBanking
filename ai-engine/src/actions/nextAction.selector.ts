import type {
  DomModelInput,
  ModelDomElement,
} from "../dom/types.js";

import type {
  NextActionDecision,
} from "./nextAction.types.js";

/**
 * UserGoal 전체 타입에 직접 의존하지 않고,
 * 다음 행동 판단에 필요한 최소 정보만 받습니다.
 */
export interface ActionGoalInput {
  rawMessage: string;

  intent?: string;

  amount?: number;

  recipient?: string;

  duration?: {
    value: number;
    unit: string;
  };

  conditions?: string[];
}

/**
 * 비교를 위해 문자열을 정규화합니다.
 */
function normalize(
  value?: string,
): string {
  return (
    value
      ?.toLowerCase()
      .replace(/\s+/g, "")
      .trim() ?? ""
  );
}

/**
 * 목표 문장에서 행동 판단에 사용할 검색어를 생성합니다.
 */
function extractGoalKeywords(
  goal: ActionGoalInput,
): string[] {
  const keywords =
    new Set<string>();

  const rawMessage =
    normalize(
      goal.rawMessage,
    );

  if (rawMessage) {
    keywords.add(
      rawMessage,
    );
  }

  const keywordCandidates = [
    "예금",
    "상품",
    "검색",
    "조회",
    "가입",
    "신청",
    "이체",
    "송금",
    "잔액",
    "금액",
    "한도",
    "변경",
    "확인",
    "다음",
  ];

  for (
    const keyword
    of keywordCandidates
  ) {
    if (
      rawMessage.includes(
        normalize(keyword),
      )
    ) {
      keywords.add(
        keyword,
      );
    }
  }

  if (goal.intent) {
    switch (
      goal.intent
    ) {
      case "DEPOSIT":
        keywords.add(
          "예금",
        );

        keywords.add(
          "상품",
        );
        break;

      case "TRANSFER":
        keywords.add(
          "이체",
        );

        keywords.add(
          "송금",
        );

        keywords.add(
          "금액",
        );
        break;

      case "INQUIRY":
        keywords.add(
          "조회",
        );

        keywords.add(
          "확인",
        );
        break;

      case "CHANGE":
        keywords.add(
          "변경",
        );

        keywords.add(
          "한도",
        );
        break;
    }
  }

  return [
    ...keywords,
  ];
}

/**
 * DOM 요소의 label과 목표 키워드가
 * 얼마나 일치하는지 계산합니다.
 */
function calculateElementScore(
  element: ModelDomElement,
  keywords: string[],
): number {
  const label =
    normalize(
      element.label,
    );

  if (!label) {
    return 0;
  }

  let score = 0;

  for (
    const keyword
    of keywords
  ) {
    const normalizedKeyword =
      normalize(
        keyword,
      );

    if (
      !normalizedKeyword
    ) {
      continue;
    }

    if (
      label ===
      normalizedKeyword
    ) {
      score += 5;
      continue;
    }

    if (
      label.includes(
        normalizedKeyword,
      )
    ) {
      score += 3;
      continue;
    }

    if (
      normalizedKeyword.includes(
        label,
      )
    ) {
      score += 1;
    }
  }

  if (
    element.actionable
  ) {
    score += 1;
  }

  return score;
}

/**
 * 사용자의 목적과 가장 가까운 조작 가능한 요소를 찾습니다.
 */
function findBestActionableElement(
  goal: ActionGoalInput,
  elements: ModelDomElement[],
  keywords: string[],
): {
  element: ModelDomElement;
  score: number;
} | null {
  let bestMatch: {
    element: ModelDomElement;
    score: number;
  } | null = null;

  for (
    const element
    of elements
  ) {
    if (
      !element.actionable
    ) {
      continue;
    }

    let score =
      calculateElementScore(
        element,
        keywords,
      );

    const rawMessage =
      normalize(
        goal.rawMessage,
      );

    const elementLabel =
      normalize(
        element.label,
      );

    if (
      element.actionHint ===
        "INPUT" &&
      (
        rawMessage.includes(
          "찾",
        ) ||
        rawMessage.includes(
          "검색",
        ) ||
        rawMessage.includes(
          "조회",
        )
      )
    ) {
      score += 4;
    }

    if (
      elementLabel.includes(
        "가입",
      ) &&
      !rawMessage.includes(
        "가입",
      )
    ) {
      score -= 3;
    }

    if (
      !bestMatch ||
      score >
        bestMatch.score
    ) {
      bestMatch = {
        element,
        score,
      };
    }
  }

  return bestMatch;
}

/**
 * 입력창에 자동으로 넣을 수 있는 값을 결정합니다.
 */
function determineInputValue(
  goal: ActionGoalInput,
  element: ModelDomElement,
): string | undefined {
  const label =
    normalize(
      element.label,
    );

  const message =
    goal.rawMessage;

  if (
    label.includes(
      "상품",
    ) ||
    label.includes(
      "검색",
    ) ||
    label.includes(
      "예금",
    )
  ) {
    if (
      goal.intent ===
      "DEPOSIT"
    ) {
      return goal.conditions
        ?.length
        ? `예금 ${goal.conditions.join(" ")}`
        : "예금";
    }
  }

  if (
    label.includes(
      "금액",
    ) &&
    goal.amount !==
      undefined
  ) {
    return String(
      goal.amount,
    );
  }

  if (
    (
      label.includes(
        "받는분",
      ) ||
      label.includes(
        "수취인",
      ) ||
      label.includes(
        "이름",
      )
    ) &&
    goal.recipient
  ) {
    return goal.recipient;
  }

  if (
    label.includes(
      "검색",
    ) ||
    label.includes(
      "입력",
    )
  ) {
    return message;
  }

  return undefined;
}

/**
 * UserGoal과 현재 DOM을 기반으로
 * 다음 행동 하나를 결정합니다.
 */
export function selectNextAction(
  goal: ActionGoalInput,
  dom: DomModelInput,
): NextActionDecision {
  const keywords =
    extractGoalKeywords(
      goal,
    );

  const bestMatch =
    findBestActionableElement(
      goal,
      dom.elements,
      keywords,
    );

  /*
   * 현재 화면에서 목표와 관련된
   * 조작 가능한 요소를 찾지 못한 경우
   * 다음 요소 탐색을 위해 아래로 스크롤합니다.
   */
  if (
    !bestMatch ||
    bestMatch.score <= 1
  ) {
    return {
      action:
        "SCROLL",

      direction:
        "DOWN",

      confidence:
        0.4,

      reason:
        "현재 화면에서 사용자 목표와 관련된 조작 가능한 요소를 찾지 못했습니다.",
    };
  }

  const {
    element,
    score,
  } = bestMatch;

  if (
    element.actionHint ===
    "INPUT"
  ) {
    const value =
      determineInputValue(
        goal,
        element,
      );

    if (!value) {
      return {
        action:
          "NONE",

        targetId:
          element.id,

        confidence:
          0.3,

        reason:
          "입력 대상은 찾았지만 입력할 값을 결정할 수 없습니다.",
      };
    }

    return {
      action:
        "TYPE",

      targetId:
        element.id,

      value,

      confidence:
        Math.min(
          0.5 +
            score * 0.05,
          0.95,
        ),

      reason:
        `"${element.label}" 입력 요소가 사용자 목표와 가장 관련성이 높습니다.`,
    };
  }

  if (
    element.actionHint ===
    "CLICK"
  ) {
    return {
      action:
        "CLICK",

      targetId:
        element.id,

      confidence:
        Math.min(
          0.5 +
            score * 0.05,
          0.95,
        ),

      reason:
        `"${element.label}" 요소가 사용자 목표와 가장 관련성이 높습니다.`,
    };
  }

  return {
    action:
      "NONE",

    confidence:
      0.2,

    reason:
      "관련 요소는 찾았지만 실행 가능한 행동을 결정하지 못했습니다.",
  };
}