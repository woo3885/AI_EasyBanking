import {
  resumeAgentLoopAfterSecureInput,
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

/*
 * 보안 입력 전 화면
 */
const secureInputSnapshot =
  createSnapshot(
    "snap-secure-input",
    "/transfer/otp",
    "OTP 인증",
  );

/*
 * 사용자가 OTP 입력을 완료한 뒤
 * Backend에서 새로 생성했다고 가정하는 DOM
 */
const afterSecureInputSnapshot =
  createSnapshot(
    "snap-after-secure-input",
    "/transfer/complete",
    "이체 완료",
  );

const secureInputResponse:
  StructuredAIResponse = {
  requestId:
    "req-secure-input",

  status:
    "SECURE_INPUT_REQUIRED",

  action:
    "PAUSE_FOR_SECURE_INPUT",

  targetElementId:
    null,

  inputValue:
    null,

  message:
    "OTP 인증번호를 직접 입력해주세요.",

  confidence:
    1,

  requiresUserAction:
    true,

  decisionType:
    null,

  secureInputType:
    "OTP",

  riskType:
    null,

  options:
    null,

  confirmationId:
    null,

  summary:
    null,
};

const completedResponse:
  StructuredAIResponse = {
  /* Agent Loop internal completion fixture; not a Production wire response. */
  requestId:
    "req-after-secure-input",

  status:
    "COMPLETED",

  action:
    "NONE",

  targetElementId:
    null,

  inputValue:
    null,

  message:
    "보안 입력이 완료되었습니다.",

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
    "친구에게 10만원을 보내고 싶어요.",

  intent:
    "TRANSFER",

  amount:
    100000,

  recipient:
    "친구",
};

/*
 * 1단계
 * SECURE_INPUT_REQUIRED에서
 * Agent Loop가 중단되는지 확인
 */
let executeBeforeSecureInput = 0;

let nextSnapshotBeforeSecureInput = 0;

const pausedResult =
  await runAgentLoop(
    userGoal,

    secureInputSnapshot,

    {
      decide:
        async () =>
          secureInputResponse,

      execute:
        async () => {
          executeBeforeSecureInput++;
        },

      getNextSnapshot:
        async () => {
          nextSnapshotBeforeSecureInput++;

          return afterSecureInputSnapshot;
        },

      createRequestId:
        (
          stepNumber,
        ) =>
          `req-secure-pause-${stepNumber}`,
    },
  );

console.log();
console.log(
  "========================================",
);

console.log(
  "D22 SECURE_INPUT Pause Test",
);

console.log(
  "========================================",
);

console.log(
  `[상태] ${pausedResult.status}`,
);

console.log(
  `[Action 실행 횟수] ${executeBeforeSecureInput}`,
);

console.log(
  `[새 DOM 요청 횟수] ${nextSnapshotBeforeSecureInput}`,
);

console.log(
  `[보안 입력 유형] ${pausedResult.finalResponse?.secureInputType}`,
);

if (
  pausedResult.status !==
  "WAITING_FOR_SECURE_INPUT"
) {
  throw new Error(
    `예상 WAITING_FOR_SECURE_INPUT, 실제 ${pausedResult.status}`,
  );
}

if (
  executeBeforeSecureInput !== 0
) {
  throw new Error(
    "보안 입력 대기 중 Browser Action이 실행되었습니다.",
  );
}

if (
  nextSnapshotBeforeSecureInput !== 0
) {
  throw new Error(
    "보안 입력 완료 전에 새 DOM을 요청했습니다.",
  );
}

if (
  pausedResult.finalResponse?.inputValue !== null
) {
  throw new Error(
    "SECURE_INPUT 응답에 민감 입력값이 포함되었습니다.",
  );
}

console.log();
console.log(
  "SECURE_INPUT pause SUCCESS",
);

/*
 * 2단계
 * 사용자가 OTP 입력을 완료한 뒤
 * 새 Snapshot으로 Agent Loop 재개
 */
const resumedResult =
  await resumeAgentLoopAfterSecureInput(
    userGoal,

    pausedResult,

    afterSecureInputSnapshot,

    {
      decide:
        async () =>
          completedResponse,

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
          `req-secure-resume-${stepNumber}`,
    },
  );

console.log();
console.log(
  "========================================",
);

console.log(
  "D22 SECURE_INPUT Resume Test",
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
  "snap-after-secure-input"
) {
  throw new Error(
    "보안 입력 완료 후 새 Snapshot으로 재개되지 않았습니다.",
  );
}

console.log();
console.log(
  "SECURE_INPUT resume SUCCESS",
);

console.log();
console.log(
  "D22 SECURE_INPUT Test SUCCESS",
);
