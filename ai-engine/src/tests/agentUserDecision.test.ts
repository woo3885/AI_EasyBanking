import {
  resumeAgentLoopAfterUserDecision,
  runAgentLoop,
} from "../agent/agentLoop.runner.js";

import {
  UserDecisionContextStore,
} from "../workflow/userDecisionContext.store.js";

import type {
  BackendSanitizedDomSnapshot,
} from "../api/aiRequest.types.js";

import type {
  StructuredAIResponse,
} from "../output/aiResponse.types.js";

function createSnapshot(
  snapshotId: string,
  url: string,
  title: string,
): BackendSanitizedDomSnapshot {
  return {
    schemaVersion: "1.0",

    snapshotId,

    page: {
      url,
      title,
      productId: null,
      productName: null,
      productPeriod: null,
    },

    elements: [],
  };
}

/*
 * 사용자 선택 전 화면
 */
const beforeDecisionSnapshot =
  createSnapshot(
    "snap-before-decision",
    "/deposit/products",
    "예금 상품 선택",
  );

/*
 * 사용자가 상품을 선택한 뒤
 * Backend에서 새로 생성했다고 가정하는 DOM
 */
const afterDecisionSnapshot =
  createSnapshot(
    "snap-after-decision",
    "/deposit/product/1",
    "선택한 예금 상품",
  );

const waitingResponse:
  StructuredAIResponse = {
  requestId:
    "req-user-decision",

  status:
    "USER_DECISION_REQUIRED",

  action:
    "WAIT_FOR_USER",

  targetElementId:
    null,

  inputValue:
    null,

  message:
    "가입할 상품을 선택해주세요.",

  confidence:
    1,

  requiresUserAction:
    true,

  decisionType:
    "PRODUCT_SELECTION",

  secureInputType:
    null,

  riskType:
    null,

  options: [
    {
      id:
        "product-1",

      label:
        "정기예금 A",
    },

    {
      id:
        "product-2",

      label:
        "정기예금 B",
    },
  ],

  confirmationId:
    null,

  summary:
    null,
};

const completedResponse:
  StructuredAIResponse = {
  /* Agent Loop internal completion fixture; not a Production wire response. */
  requestId:
    "req-after-decision",

  status:
    "COMPLETED",

  action:
    "NONE",

  targetElementId:
    null,

  inputValue:
    null,

  message:
    "상품 선택 이후 단계가 완료되었습니다.",

  confidence:
    1,

  requiresUserAction:
    false,

  decisionType:
    null,

  secureInputType:
    null,

  riskType:
    null,

  options:
    null,

  confirmationId:
    null,

  summary:
    null,
};

const userGoal = {
  rawMessage:
    "금리가 높은 예금 상품을 찾고 싶어요.",

  intent:
    "DEPOSIT",

  conditions: [
    "금리가 높은",
  ],
};

/*
 * 1단계
 * USER_DECISION_REQUIRED에서
 * Agent Loop가 멈추는지 확인
 */
let executeBeforeDecision = 0;

let snapshotRequestBeforeDecision = 0;

const pausedResult =
  await runAgentLoop(
    userGoal,

    beforeDecisionSnapshot,

    {
      decide:
        async () =>
          waitingResponse,

      execute:
        async () => {
          executeBeforeDecision++;
        },

      getNextSnapshot:
        async () => {
          snapshotRequestBeforeDecision++;

          return afterDecisionSnapshot;
        },

      createRequestId:
        (
          stepNumber,
        ) =>
          `req-pause-${stepNumber}`,
    },
  );

console.log();
console.log(
  "========================================",
);

console.log(
  "D21 USER_DECISION Pause Test",
);

console.log(
  "========================================",
);

console.log(
  `[상태] ${pausedResult.status}`,
);

console.log(
  `[Action 실행 횟수] ${executeBeforeDecision}`,
);

console.log(
  `[새 DOM 요청 횟수] ${snapshotRequestBeforeDecision}`,
);

if (
  pausedResult.status !==
  "WAITING_FOR_USER"
) {
  throw new Error(
    `예상 WAITING_FOR_USER, 실제 ${pausedResult.status}`,
  );
}

if (
  executeBeforeDecision !== 0
) {
  throw new Error(
    "사용자 선택 대기 중 Browser Action이 실행되었습니다.",
  );
}

if (
  snapshotRequestBeforeDecision !== 0
) {
  throw new Error(
    "사용자 선택 전에 새 DOM을 요청했습니다.",
  );
}

console.log();
console.log(
  "USER_DECISION pause SUCCESS",
);

/*
 * 2단계
 * 사용자가 선택을 완료하고
 * 새로운 Snapshot을 받은 뒤
 * Agent Loop를 재개합니다.
 */
const contextStore =
  new UserDecisionContextStore();

contextStore.registerPending({
  decisionId: "decision-product-1",
  decisionType: "PRODUCT_SELECTION",
  optionIds: [
    "product-1",
    "product-2",
  ],
  snapshotId:
    beforeDecisionSnapshot.snapshotId,
});

let receivedSelectedOptionIds:
  readonly string[] | undefined;

const resumedResult =
  await resumeAgentLoopAfterUserDecision(
    userGoal,

    pausedResult,

    {
      decisionId: "decision-product-1",
      decisionType: "PRODUCT_SELECTION",
      selectedOptionIds: [
        "product-2",
      ],
      sourceSnapshotId:
        beforeDecisionSnapshot.snapshotId,
    },

    afterDecisionSnapshot,

    contextStore,

    {
      decide:
        async (request) => {
          receivedSelectedOptionIds =
            request.userDecisionContext
              ?.selectedOptionIds;

          return completedResponse;
        },

      execute:
        async () => {
          throw new Error(
            "COMPLETED 상태에서 Action을 실행하면 안 됩니다.",
          );
        },

      getNextSnapshot:
        async () => {
          throw new Error(
            "COMPLETED 상태에서 새 DOM을 요청하면 안 됩니다.",
          );
        },

      createRequestId:
        (
          stepNumber,
        ) =>
          `req-resume-${stepNumber}`,
    },
  );

console.log();
console.log(
  "========================================",
);

console.log(
  "D21 USER_DECISION Resume Test",
);

console.log(
  "========================================",
);

console.log(
  `[상태] ${resumedResult.status}`,
);

console.log(
  `[재개 Snapshot] ${resumedResult.finalSnapshot.snapshotId}`,
);

if (
  resumedResult.status !==
  "COMPLETED"
) {
  throw new Error(
    `예상 COMPLETED, 실제 ${resumedResult.status}`,
  );
}

if (
  resumedResult.finalSnapshot.snapshotId !==
  "snap-after-decision"
) {
  throw new Error(
    "사용자 선택 이후의 새 Snapshot으로 재개되지 않았습니다.",
  );
}

if (
  receivedSelectedOptionIds?.length !== 1 ||
  receivedSelectedOptionIds[0] !== "product-2"
) {
  throw new Error(
    "Verified user selection IDs were not preserved in the resumed request.",
  );
}

console.log();
console.log(
  "USER_DECISION resume SUCCESS",
);

console.log();
console.log(
  "D21 USER_DECISION Test SUCCESS",
);
