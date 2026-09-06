import {
  selectNextAction,
} from "../actions/nextAction.selector.js";

import {
  compareTargetDecision,
  evaluateTargetAccuracy,
} from "../accuracy/targetAccuracy.evaluator.js";

import type {
  ActionGoalInput,
} from "../actions/nextAction.selector.js";

import type {
  DomModelInput,
} from "../dom/types.js";

interface TargetTestCase {
  name: string;

  goal: ActionGoalInput;

  dom: DomModelInput;

  expectedAction: string;

  expectedTargetId: string | null;
}

const testCases: TargetTestCase[] = [
  /*
   * 1. 홈 화면 → 예금 메뉴
   */
  {
    name: "홈 화면 - 예금 메뉴 선택",

    goal: {
      rawMessage:
        "금리가 높은 예금 상품을 찾고 싶어요.",

      intent:
        "DEPOSIT",

      conditions: [
        "금리가 높은",
      ],
    },

    dom: {
      page: {
        url:
          "https://demo-bank.local/",

        title:
          "금융길잡이 데모은행",
      },

      elements: [
        {
          id:
            "el-home-deposit",

          type:
            "button",

          label:
            "예금",

          actionable:
            true,

          actionHint:
            "CLICK",
        },

        {
          id:
            "el-home-transfer",

          type:
            "button",

          label:
            "계좌이체",

          actionable:
            true,

          actionHint:
            "CLICK",
        },
      ],

      metadata: {
        originalElementCount:
          2,

        modelElementCount:
          2,
      },
    },

    expectedAction:
      "CLICK",

    expectedTargetId:
      "el-home-deposit",
  },

  /*
   * 2. 예금 상품 화면 → 검색창 입력
   */
  {
    name:
      "예금 화면 - 상품 검색 입력",

    goal: {
      rawMessage:
        "금리가 높은 예금 상품을 찾고 싶어요.",

      intent:
        "DEPOSIT",

      conditions: [
        "금리가 높은",
      ],
    },

    dom: {
      page: {
        url:
          "https://demo-bank.local/deposit",

        title:
          "예금 상품",
      },

      elements: [
        {
          id:
            "el-deposit-search",

          type:
            "input",

          label:
            "예금 상품 검색",

          actionable:
            true,

          actionHint:
            "INPUT",
        },

        {
          id:
            "el-deposit-search-button",

          type:
            "button",

          label:
            "검색",

          actionable:
            true,

          actionHint:
            "CLICK",
        },
      ],

      metadata: {
        originalElementCount:
          2,

        modelElementCount:
          2,
      },
    },

    expectedAction:
      "TYPE",

    expectedTargetId:
      "el-deposit-search",
  },

  /*
   * 3. 홈 화면 → 계좌이체
   */
  {
    name:
      "홈 화면 - 계좌이체 선택",

    goal: {
      rawMessage:
        "친구에게 10만원을 보내고 싶어요.",

      intent:
        "TRANSFER",

      amount:
        100000,

      recipient:
        "친구",
    },

    dom: {
      page: {
        url:
          "https://demo-bank.local/",

        title:
          "금융길잡이 데모은행",
      },

      elements: [
        {
          id:
            "el-transfer",

          type:
            "button",

          label:
            "계좌이체",

          actionable:
            true,

          actionHint:
            "CLICK",
        },

        {
          id:
            "el-deposit",

          type:
            "button",

          label:
            "예금",

          actionable:
            true,

          actionHint:
            "CLICK",
        },
      ],

      metadata: {
        originalElementCount:
          2,

        modelElementCount:
          2,
      },
    },

    expectedAction:
      "CLICK",

    expectedTargetId:
      "el-transfer",
  },

  /*
   * 4. 이체 금액 화면 → 금액 입력
   */
  {
    name:
      "이체 화면 - 금액 입력",

    goal: {
      rawMessage:
        "친구에게 10만원을 보내고 싶어요.",

      intent:
        "TRANSFER",

      amount:
        100000,

      recipient:
        "친구",
    },

    dom: {
      page: {
        url:
          "https://demo-bank.local/transfer/amount",

        title:
          "이체 금액 입력",
      },

      elements: [
        {
          id:
            "el-transfer-amount",

          type:
            "input",

          label:
            "금액 입력",

          actionable:
            true,

          actionHint:
            "INPUT",
        },

        {
          id:
            "el-transfer-next",

          type:
            "button",

          label:
            "다음",

          actionable:
            true,

          actionHint:
            "CLICK",
        },
      ],

      metadata: {
        originalElementCount:
          2,

        modelElementCount:
          2,
      },
    },

    expectedAction:
      "TYPE",

    expectedTargetId:
      "el-transfer-amount",
  },

  /*
   * 5. 관련 Target이 없는 화면 → SCROLL
   */
  {
    name:
      "관련 요소 없음 - 아래로 탐색",

    goal: {
      rawMessage:
        "예금 상품을 찾고 싶어요.",

      intent:
        "DEPOSIT",
    },

    dom: {
      page: {
        url:
          "https://demo-bank.local/notice",

        title:
          "공지사항",
      },

      elements: [
        {
          id:
            "el-notice",

          type:
            "text",

          label:
            "공지사항 안내",

          actionable:
            false,
        },
      ],

      metadata: {
        originalElementCount:
          1,

        modelElementCount:
          1,
      },
    },

    expectedAction:
      "SCROLL",

    expectedTargetId:
      null,
  },
];

const results =
  testCases.map(
    (testCase) => {
      const decision =
        selectNextAction(
          testCase.goal,
          testCase.dom,
        );

      return compareTargetDecision(
        testCase.name,
        testCase.expectedAction,
        testCase.expectedTargetId,
        decision,
      );
    },
  );

const summary =
  evaluateTargetAccuracy(
    results,
  );

console.log();
console.log(
  "========================================",
);

console.log(
  "D19 Target Accuracy Test",
);

console.log(
  "========================================",
);

for (
  const result
  of summary.results
) {
  console.log();

  console.log(
    `[화면] ${result.name}`,
  );

  console.log(
    `[기대] ${result.expectedAction} / ${result.expectedTargetId ?? "없음"}`,
  );

  console.log(
    `[실제] ${result.actualAction} / ${result.actualTargetId ?? "없음"}`,
  );

  console.log(
    `[결과] ${
      result.correct
        ? "PASS"
        : "FAIL"
    }`,
  );
}

console.log();

console.log(
  `[정답] ${summary.correct}/${summary.total}`,
);

console.log(
  `[정답률] ${
    (
      summary.accuracy *
      100
    ).toFixed(1)
  }%`,
);

if (
  summary.correct !==
  summary.total
) {
  process.exitCode = 1;
}