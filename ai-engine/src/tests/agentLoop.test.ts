import {
  runAgentLoop,
} from "../agent/agentLoop.runner.js";

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

function createResponse(
  requestId: string,
  action: StructuredAIResponse["action"],
  status: StructuredAIResponse["status"] = "AI_EXECUTING",
): StructuredAIResponse {
  return {
    requestId,

    status,

    action,

    targetElementId: null,

    inputValue: null,

    message:
      `${action} 실행`,

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
}

/*
 * Step 1
 * 홈 화면
 */
const snapshot1 =
  createSnapshot(
    "snap-001",
    "/",
    "홈",
  );

/*
 * Step 2
 * 예금 목록 화면
 */
const snapshot2 =
  createSnapshot(
    "snap-002",
    "/deposit",
    "예금 목록",
  );

/*
 * Step 3
 * 목표 완료 화면
 */
const snapshot3 =
  createSnapshot(
    "snap-003",
    "/deposit/result",
    "예금 검색 결과",
  );

const decisions:
  StructuredAIResponse[] = [
  createResponse(
    "req-1",
    "CLICK",
  ),

  createResponse(
    "req-2",
    "SCROLL",
  ),

  createResponse(
    "req-3",
    // Agent Loop internal completion fixture; not a Production wire response.
    "NONE",
    "COMPLETED",
  ),
];

let decisionIndex = 0;

let executeCount = 0;

let nextSnapshotIndex = 0;

const nextSnapshots = [
  snapshot2,
  snapshot3,
];

const result =
  await runAgentLoop(
    {
      rawMessage:
        "금리가 높은 예금 상품을 찾고 싶어요.",

      intent:
        "DEPOSIT",

      conditions: [
        "금리가 높은",
      ],
    },

    snapshot1,

    {
      decide:
        async (
          request,
        ) => {
          console.log();
          console.log(
            `[AI 판단] ${request.requestId}`,
          );

          console.log(
            `[현재 DOM] ${request.domSnapshot.snapshotId}`,
          );

          const decision =
            decisions[
              decisionIndex
            ];

          if (!decision) {
            throw new Error(
              `준비된 AI 판단 결과가 없습니다. index=${decisionIndex}`,
            );
          }

          decisionIndex++;

          return decision;
        },

      execute:
        async (
          response,
        ) => {
          executeCount++;

          console.log(
            `[Action 실행] ${response.action}`,
          );
        },

      getNextSnapshot:
        async () => {
          const snapshot =
            nextSnapshots[
              nextSnapshotIndex
            ];

          if (!snapshot) {
            throw new Error(
              `준비된 다음 Snapshot이 없습니다. index=${nextSnapshotIndex}`,
            );
          }

          nextSnapshotIndex++;

          console.log(
            `[새 DOM] ${snapshot.snapshotId}`,
          );

          return snapshot;
        },

      createRequestId:
        (
          stepNumber,
        ) =>
          `req-loop-${stepNumber}`,
    },

    10,
  );

console.log();
console.log(
  "========================================",
);

console.log(
  "D20 Agent Loop Test",
);

console.log(
  "========================================",
);

console.log(
  `[최종 상태] ${result.status}`,
);

console.log(
  `[총 판단 횟수] ${result.steps.length}`,
);

console.log(
  `[Action 실행 횟수] ${executeCount}`,
);

console.log(
  `[최종 Snapshot] ${result.finalSnapshot.snapshotId}`,
);

if (
  result.status !==
  "COMPLETED"
) {
  throw new Error(
    `예상 상태 COMPLETED, 실제 ${result.status}`,
  );
}

if (
  result.steps.length !==
  3
) {
  throw new Error(
    `예상 판단 횟수 3, 실제 ${result.steps.length}`,
  );
}

if (
  executeCount !==
  2
) {
  throw new Error(
    `예상 Action 실행 횟수 2, 실제 ${executeCount}`,
  );
}

if (
  result.finalSnapshot.snapshotId !==
  "snap-003"
) {
  throw new Error(
    `예상 최종 Snapshot snap-003, 실제 ${result.finalSnapshot.snapshotId}`,
  );
}

console.log();
console.log(
  "D20 Agent Loop Test SUCCESS",
);
