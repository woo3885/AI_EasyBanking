import assert from "node:assert/strict";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import test from "node:test";

import express from "express";

import {
  runAgentLoop,
  resumeAgentLoopAfterUserDecision,
} from "../agent/agentLoop.runner.js";
import {
  createAiActionRouter,
} from "../api/aiAction.route.js";
import {
  adaptStructuredResponseToBackend,
} from "../api/aiDecisionResponse.adapter.js";
import {
  adaptBackendDomToModelInput,
} from "../api/domRequest.adapter.js";
import type {
  AiActionRequest,
  BackendSanitizedDomElement,
  BackendSanitizedDomSnapshot,
} from "../api/aiRequest.types.js";
import {
  createDepositFinalBoundaryResponse,
  DEPOSIT_CONFIRMATION_TYPE,
  DEPOSIT_FINAL_MESSAGES,
  enforceDepositFinalConfirmationPolicy,
} from "../deposit/depositFinalConfirmation.policy.js";
import type {
  StructuredAIResponse,
} from "../output/aiResponse.types.js";
import {
  validateStructuredAIResponse,
} from "../output/aiResponse.validator.js";
import {
  createNextActionPrompt,
} from "../prompts/nextActionPrompt.js";
import {
  generateStructuredAction,
} from "../services/structuredAction.service.js";
import {
  UserDecisionContextStore,
} from "../workflow/userDecisionContext.store.js";

const RESPONSE_FIELDS = [
  "actionType",
  "elementId",
  "value",
  "scrollX",
  "scrollY",
  "waitMillis",
  "status",
  "message",
  "requiresUserAction",
  "executionBlocked",
  "decisionType",
  "sourceSnapshotId",
  "options",
  "terms",
  "confirmationType",
  "confirmationTargetElementId",
] as const;

function element(
  elementId: string,
  label: string,
  overrides: Partial<BackendSanitizedDomElement> = {},
): BackendSanitizedDomElement {
  return {
    elementId,
    tag: "button",
    role: "button",
    text: label,
    ariaLabel: null,
    placeholder: null,
    inputType: null,
    visible: true,
    enabled: true,
    checked: null,
    boundingBox: {
      x: 100,
      y: 200,
      width: 240,
      height: 48,
    },
    securityPolicy: "NORMAL",
    ...overrides,
  };
}

function snapshot(
  snapshotId: string,
  url: string,
  elements: BackendSanitizedDomElement[],
): BackendSanitizedDomSnapshot {
  return {
    schemaVersion: "1.0",
    snapshotId,
    page: {
      url,
      title: "정기예금 가입 Demo",
      productId: null,
      productName: null,
      productPeriod: null,
      depositAmount: null,
    },
    elements,
  };
}

function finalTarget(
  elementId = "el-final-approve",
  overrides: Partial<BackendSanitizedDomElement> = {},
): BackendSanitizedDomElement {
  return element(
    elementId,
    "Demo 예금 최종 승인",
    {
      securityPolicy: "FINAL_CONFIRMATION",
      ...overrides,
    },
  );
}

function finalSnapshot(
  productId: "deposit-12m" | "deposit-preferred" =
    "deposit-12m",
  overrides: BackendSanitizedDomElement[] = [
    element("el-checkbox", "최종 승인 확인", {
      tag: "input",
      role: "checkbox",
      inputType: "checkbox",
      checked: true,
    }),
    element("el-final-cancel", "최종 승인 거절"),
    finalTarget(),
  ],
): BackendSanitizedDomSnapshot {
  const current = snapshot(
    `snap-final-${productId}`,
    `https://demo.test/deposit/confirmation/${productId}`,
    overrides,
  );

  return {
    ...current,
    page: {
      ...current.page,
      productId,
      productName: productId === "deposit-12m"
        ? "12개월 정기예금"
        : "우대금리 정기예금",
      productPeriod: "12개월",
      depositAmount: "1,000,000원",
    },
  };
}

function request(
  domSnapshot: BackendSanitizedDomSnapshot,
): AiActionRequest {
  return {
    requestId: "req-d27",
    userGoal: {
      rawMessage:
        "12개월 정기예금에 100만원 가입하고 싶어요.",
      intent: "DEPOSIT",
      amount: 1_000_000,
      duration: {
        value: 12,
        unit: "MONTH",
      },
      conditions: [],
    },
    domSnapshot,
  };
}

function candidate(
  overrides: Partial<StructuredAIResponse> = {},
): StructuredAIResponse {
  return {
    requestId: "req-d27",
    status: "AI_EXECUTING",
    action: "NONE",
    targetElementId: null,
    inputValue: null,
    message: "모델 후보",
    confidence: 0.9,
    requiresUserAction: false,
    decisionType: null,
    secureInputType: null,
    riskType: null,
    options: null,
    confirmationId: null,
    summary: null,
    confirmationType: null,
    confirmationTargetElementId: null,
    ...overrides,
  };
}

function finalCandidate(
  overrides: Partial<StructuredAIResponse> = {},
): StructuredAIResponse {
  return candidate({
    status: "FINAL_CONFIRMATION_REQUIRED",
    action: "REQUEST_FINAL_CONFIRMATION",
    requiresUserAction: true,
    ...overrides,
  });
}

async function decideWithoutModel(
  currentRequest: AiActionRequest,
): Promise<StructuredAIResponse> {
  return generateStructuredAction(
    currentRequest,
    async () => {
      throw new Error("model must not be called");
    },
  );
}

for (const productId of [
  "deposit-12m",
  "deposit-preferred",
] as const) {
  test(`D27 ${productId} final screen emits the canonical final response`, async () => {
    const response = await decideWithoutModel(
      request(finalSnapshot(productId)),
    );

    assert.equal(response.action, "REQUEST_FINAL_CONFIRMATION");
    assert.equal(response.status, "FINAL_CONFIRMATION_REQUIRED");
    assert.equal(response.requiresUserAction, true);
    assert.equal(response.confirmationType, DEPOSIT_CONFIRMATION_TYPE);
    assert.equal(
      response.confirmationTargetElementId,
      "el-final-approve",
    );
  });

  test(`D27 ${productId} final wire binds the current snapshot`, async () => {
    const current = finalSnapshot(productId);
    const response = await decideWithoutModel(request(current));
    const wire = adaptStructuredResponseToBackend(
      response,
      current.snapshotId,
    );

    assert.equal(wire.sourceSnapshotId, current.snapshotId);
    assert.equal(wire.confirmationType, "DEPOSIT_SUBSCRIPTION");
    assert.equal(
      wire.confirmationTargetElementId,
      "el-final-approve",
    );
  });
}

test("D27 final response has no automatic Browser Action payload", async () => {
  const current = finalSnapshot();
  const wire = adaptStructuredResponseToBackend(
    await decideWithoutModel(request(current)),
    current.snapshotId,
  );

  assert.equal(wire.elementId, null);
  assert.equal(wire.value, null);
  assert.equal(wire.scrollX, null);
  assert.equal(wire.scrollY, null);
  assert.equal(wire.waitMillis, null);
  assert.equal(wire.executionBlocked, true);
});

const invalidTargetCases: Array<{
  name: string;
  elements: BackendSanitizedDomElement[];
  expectedMessage: string;
}> = [
  {
    name: "missing target",
    elements: [],
    expectedMessage: DEPOSIT_FINAL_MESSAGES.blocked,
  },
  {
    name: "duplicate target",
    elements: [finalTarget("el-final-a"), finalTarget("el-final-b")],
    expectedMessage: DEPOSIT_FINAL_MESSAGES.blocked,
  },
  {
    name: "hidden target",
    elements: [finalTarget("el-final-hidden", { visible: false })],
    expectedMessage: DEPOSIT_FINAL_MESSAGES.blocked,
  },
  {
    name: "disabled target",
    elements: [finalTarget("el-final-disabled", { enabled: false })],
    expectedMessage: DEPOSIT_FINAL_MESSAGES.waiting,
  },
  {
    name: "checkbox target",
    elements: [finalTarget("el-checkbox", {
      tag: "input",
      role: "checkbox",
      inputType: "checkbox",
    })],
    expectedMessage: DEPOSIT_FINAL_MESSAGES.blocked,
  },
  {
    name: "cancel target",
    elements: [finalTarget("el-cancel", { text: "최종 승인 거절" })],
    expectedMessage: DEPOSIT_FINAL_MESSAGES.blocked,
  },
  {
    name: "unknown approval label",
    elements: [finalTarget("el-unknown", { text: "계속" })],
    expectedMessage: DEPOSIT_FINAL_MESSAGES.blocked,
  },
];

for (const invalid of invalidTargetCases) {
  test(`D27 fail-closes ${invalid.name}`, () => {
    const response = createDepositFinalBoundaryResponse(
      request(finalSnapshot("deposit-12m", invalid.elements)),
    );

    assert.ok(response);
    assert.equal(response.action, "NONE");
    assert.equal(response.status, "AI_EXECUTING");
    assert.equal(response.requiresUserAction, true);
    assert.equal(response.message, invalid.expectedMessage);
    assert.equal(response.confirmationType, null);
    assert.equal(response.confirmationTargetElementId, null);
  });
}

test("D27 rejects a stale model confirmation target", () => {
  const result = enforceDepositFinalConfirmationPolicy(
    finalCandidate({
      confirmationType: "DEPOSIT_SUBSCRIPTION",
      confirmationTargetElementId: "el-stale-target",
    }),
    request(finalSnapshot()),
  );

  assert.equal(result.action, "NONE");
  assert.equal(result.confirmationTargetElementId, null);
});

test("D27 rejects an unknown model confirmation type", () => {
  const result = enforceDepositFinalConfirmationPolicy(
    finalCandidate({
      confirmationType: "TRANSFER" as never,
      confirmationTargetElementId: "el-final-approve",
    }),
    request(finalSnapshot()),
  );

  assert.equal(result.action, "NONE");
  assert.equal(result.confirmationType, null);
});

test("D27 rejects a model-created confirmationId", () => {
  const result = enforceDepositFinalConfirmationPolicy(
    finalCandidate({
      confirmationId: "confirm-model",
    }),
    request(finalSnapshot()),
  );

  assert.equal(result.action, "NONE");
  assert.equal(result.confirmationId, null);
});

test("D27 rejects a model-created authoritative summary", () => {
  const result = enforceDepositFinalConfirmationPolicy(
    finalCandidate({
      summary: { productName: "model" },
    }),
    request(finalSnapshot()),
  );

  assert.equal(result.action, "NONE");
  assert.equal(result.summary, null);
});

for (const invalidUrl of [
  "https://demo.test/deposit/confirmation/deposit-unknown",
  "https://demo.test/deposit/confirmation/deposit-12m?next=true",
  "https://demo.test/deposit/confirmation/deposit-12m#final",
  "https://user@demo.test/deposit/confirmation/deposit-12m",
  "not-a-url",
]) {
  test(`D27 does not expose final on unsupported URL: ${invalidUrl}`, () => {
    const current = snapshot(
      "snap-invalid-url",
      invalidUrl,
      [finalTarget()],
    );
    const result = enforceDepositFinalConfirmationPolicy(
      finalCandidate(),
      request(current),
    );

    assert.equal(result.action, "NONE");
    assert.notEqual(result.status, "FINAL_CONFIRMATION_REQUIRED");
  });
}

const prematurePages = [
  ["product list", "/deposit/products"],
  ["product detail", "/deposit/products/deposit-12m"],
  ["amount", "/deposit/conditions/deposit-12m"],
  ["terms", "/deposit/terms/deposit-12m"],
  ["normal", "/accounts"],
] as const;

for (const [name, path] of prematurePages) {
  test(`D27 blocks premature final on ${name}`, () => {
    const current = snapshot(
      `snap-${name}`,
      `https://demo.test${path}`,
      [finalTarget()],
    );
    const result = enforceDepositFinalConfirmationPolicy(
      finalCandidate(),
      request(current),
    );

    assert.equal(result.action, "NONE");
    assert.equal(result.message, DEPOSIT_FINAL_MESSAGES.premature);
  });
}

test("D27 secure input takes priority before prompt and final", async () => {
  const current = finalSnapshot("deposit-12m", [
    finalTarget(),
    element("el-password", "계좌 비밀번호", {
      tag: "input",
      role: "textbox",
      inputType: "password",
      securityPolicy: "SECURE_INPUT",
    }),
  ]);
  const response = await decideWithoutModel(request(current));

  assert.equal(response.status, "SECURE_INPUT_REQUIRED");
  assert.equal(response.action, "PAUSE_FOR_SECURE_INPUT");
  assert.equal(response.confirmationType ?? null, null);
});

test("D27 risk candidate is not replaced by final", () => {
  const risk = candidate({
    status: "RISK_WARNING",
    riskType: "SYNTHETIC_RISK",
    requiresUserAction: true,
  });
  const current = finalSnapshot("deposit-12m", [
    finalTarget(),
    element("el-blocked", "위험 경고", {
      securityPolicy: "BLOCKED",
    }),
  ]);

  assert.equal(
    enforceDepositFinalConfirmationPolicy(
      risk,
      request(current),
    ),
    risk,
  );
});

test("D27 final response stops the Agent Loop before execute", async () => {
  const current = finalSnapshot();
  let executeCount = 0;
  let nextSnapshotCount = 0;
  const result = await runAgentLoop(
    request(current).userGoal,
    current,
    {
      createRequestId: () => "req-loop-final",
      decide: decideWithoutModel,
      execute: async () => {
        executeCount += 1;
      },
      getNextSnapshot: async () => {
        nextSnapshotCount += 1;
        return current;
      },
    },
  );

  assert.equal(result.status, "WAITING_FOR_FINAL_CONFIRMATION");
  assert.equal(result.steps.length, 1);
  assert.equal(executeCount, 0);
  assert.equal(nextSnapshotCount, 0);
});

test("D27 malformed final pair is an Agent Loop error", async () => {
  const current = finalSnapshot();
  const result = await runAgentLoop(
    request(current).userGoal,
    current,
    {
      createRequestId: () => "req-malformed",
      decide: async () => finalCandidate(),
      execute: async () => undefined,
      getNextSnapshot: async () => current,
    },
  );

  assert.equal(result.status, "ERROR");
});

test("D27 final pause cannot use the user-decision resume path", async () => {
  const current = finalSnapshot();
  const paused = await runAgentLoop(
    request(current).userGoal,
    current,
    {
      createRequestId: () => "req-final-pause",
      decide: decideWithoutModel,
      execute: async () => undefined,
      getNextSnapshot: async () => current,
    },
  );

  await assert.rejects(() =>
    resumeAgentLoopAfterUserDecision(
      request(current).userGoal,
      paused,
      {
        decisionId: "dec-not-final",
        decisionType: "PRODUCT_SELECTION",
        selectedOptionIds: ["el-product"],
        sourceSnapshotId: "snap-old",
      },
      current,
      new UserDecisionContextStore(),
      {
        createRequestId: () => "req-no-resume",
        decide: decideWithoutModel,
        execute: async () => undefined,
        getNextSnapshot: async () => current,
      },
    ),
  );
});

test("D27 deterministic retries do not create process-global state", async () => {
  const currentRequest = request(finalSnapshot());
  const first = await decideWithoutModel(currentRequest);
  const second = await decideWithoutModel(currentRequest);

  assert.deepEqual(first, second);
  assert.equal(first.confirmationId, null);
  assert.equal(first.summary, null);
});

for (const productId of [
  "deposit-12m",
  "deposit-preferred",
] as const) {
  test(`D27 ${productId} completion emits no further action`, async () => {
    const current = snapshot(
      `snap-completed-${productId}`,
      `https://demo.test/deposit/completed/${productId}`,
      [element("el-home", "Demo 메인으로 돌아가기")],
    );
    const response = await decideWithoutModel(request(current));

    assert.equal(response.action, "NONE");
    assert.equal(response.status, "AI_EXECUTING");
    assert.equal(response.requiresUserAction, false);
    assert.equal(response.message, DEPOSIT_FINAL_MESSAGES.completed);
    assert.doesNotMatch(response.message, /금융기관|거래 성공|가입 성공/u);
  });
}

test("D27 completion bypasses the model", async () => {
  let calls = 0;
  const current = snapshot(
    "snap-completed",
    "https://demo.test/deposit/completed/deposit-12m",
    [element("el-home", "Demo 메인으로 돌아가기")],
  );
  const response = await generateStructuredAction(
    request(current),
    async () => {
      calls += 1;
      return {
        model: "synthetic-offline-model",
        text: JSON.stringify(finalCandidate()),
        source: "GEMINI",
      };
    },
  );

  assert.equal(calls, 0);
  assert.equal(response.action, "NONE");
});

test("D27 Backend adapter emits the exact 16 fields", async () => {
  const current = finalSnapshot();
  const wire = adaptStructuredResponseToBackend(
    await decideWithoutModel(request(current)),
    current.snapshotId,
  );

  assert.deepEqual(Object.keys(wire), RESPONSE_FIELDS);
  assert.equal("confirmationId" in wire, false);
  assert.equal("summary" in wire, false);
});

test("D27 accepts Backend authoritative amount without exposing it to the model", () => {
  const current = finalSnapshot();
  const modelInput = adaptBackendDomToModelInput(current);

  assert.equal(current.page.depositAmount, "1,000,000원");
  assert.equal("depositAmount" in modelInput.page, false);
});

test("D27 wire is compatible with the Backend canonical fixture", async () => {
  const fixtureUrl = new URL(
    "../../../backend/src/test/resources/contracts/d27-final-confirmation-response.json",
    import.meta.url,
  );
  const fixture = JSON.parse(
    await readFile(fixtureUrl, "utf8"),
  ) as Record<string, unknown>;
  const current = finalSnapshot();
  const wire = adaptStructuredResponseToBackend(
    await decideWithoutModel(request(current)),
    current.snapshotId,
  );

  assert.deepEqual(Object.keys(wire), Object.keys(fixture));
  assert.deepEqual(wire, {
    ...fixture,
    sourceSnapshotId: current.snapshotId,
    confirmationTargetElementId: "el-final-approve",
  });
});

test("D27 JSON preserves Backend null and empty-array rules", async () => {
  const current = finalSnapshot();
  const wire = adaptStructuredResponseToBackend(
    await decideWithoutModel(request(current)),
    current.snapshotId,
  );
  const parsed = JSON.parse(JSON.stringify(wire)) as Record<string, unknown>;

  assert.deepEqual(Object.keys(parsed), RESPONSE_FIELDS);
  assert.equal(parsed.elementId, null);
  assert.equal(parsed.value, null);
  assert.deepEqual(parsed.options, []);
  assert.deepEqual(parsed.terms, []);
});

test("D27 adapter rejects lowercase confirmation enum", () => {
  assert.throws(() =>
    adaptStructuredResponseToBackend(
      finalCandidate({
        confirmationType: "deposit_subscription" as never,
        confirmationTargetElementId: "el-final-approve",
      }),
      "snap-final",
    ),
  );
});

test("D27 adapter rejects CLICK with final status", () => {
  assert.throws(() =>
    adaptStructuredResponseToBackend(
      finalCandidate({
        action: "CLICK",
        targetElementId: "el-final-approve",
        confirmationType: "DEPOSIT_SUBSCRIPTION",
        confirmationTargetElementId: "el-final-approve",
      }),
      "snap-final",
    ),
  );
});

test("D27 adapter rejects final metadata with AI_EXECUTING", () => {
  assert.throws(() =>
    adaptStructuredResponseToBackend(
      candidate({
        confirmationType: "DEPOSIT_SUBSCRIPTION",
        confirmationTargetElementId: "el-final-approve",
      }),
      "snap-final",
    ),
  );
});

test("D27 runtime rejects model confirmationId and summary authority", () => {
  const currentRequest = request(finalSnapshot());
  for (const unsafe of [
    finalCandidate({ confirmationId: "confirm-model" }),
    finalCandidate({ summary: { model: true } }),
  ]) {
    const result = enforceDepositFinalConfirmationPolicy(
      unsafe,
      currentRequest,
    );
    assert.equal(result.action, "NONE");
    assert.equal(result.confirmationId, null);
    assert.equal(result.summary, null);
  }

  assert.equal(
    validateStructuredAIResponse(
      finalCandidate({
        action: "CLICK",
        targetElementId: "el-final-approve",
      }),
    ).valid,
    false,
  );
});

test("D27 prompt forbids premature final and C-owned authority", () => {
  const current = finalSnapshot();
  const prompt = createNextActionPrompt(
    "req-prompt",
    request(current).userGoal,
    {
      page: current.page,
      elements: [],
      metadata: {
        originalElementCount: 0,
        modelElementCount: 0,
      },
    },
  );

  assert.match(prompt, /confirmationId.*Backend/u);
  assert.match(prompt, /summary.*Backend/u);
  assert.match(prompt, /완료 화면.*NONE/u);
});

test("D27 POST /api/ai/action returns the exact canonical JSON", async () => {
  const app = express();
  app.use(express.json());
  app.use(
    "/api/ai",
    createAiActionRouter((input) =>
      generateStructuredAction(
        input,
        async () => {
          throw new Error("model must not be called");
        },
      ),
    ),
  );

  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const address = server.address() as AddressInfo;
    const current = finalSnapshot();
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/ai/action`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          userRequest:
            "12개월 정기예금에 100만원 가입하고 싶어요.",
          snapshot: current,
        }),
      },
    );
    const body = await response.json() as Record<string, unknown>;

    assert.equal(response.status, 200);
    assert.deepEqual(Object.keys(body), RESPONSE_FIELDS);
    assert.equal(body.actionType, "REQUEST_FINAL_CONFIRMATION");
    assert.equal(body.status, "FINAL_CONFIRMATION_REQUIRED");
    assert.equal(body.sourceSnapshotId, current.snapshotId);
    assert.equal(body.confirmationType, "DEPOSIT_SUBSCRIPTION");
    assert.equal(body.confirmationTargetElementId, "el-final-approve");
  } finally {
    server.close();
    await once(server, "close");
  }
});
