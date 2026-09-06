import assert from "node:assert/strict";
import test from "node:test";

import {
  adaptStructuredResponseToBackend,
} from "../api/aiDecisionResponse.adapter.js";
import {
  runAgentLoop,
} from "../agent/agentLoop.runner.js";
import type {
  BackendSanitizedDomSnapshot,
} from "../api/aiRequest.types.js";
import {
  bindTrustedRequestId,
} from "../output/aiResponse.parser.js";
import type {
  BrowserActionType,
  StructuredAIResponse,
  WorkflowStatus,
} from "../output/aiResponse.types.js";
import {
  PRODUCTION_STRUCTURED_ACTIONS,
} from "../output/aiResponse.types.js";
import {
  validateStructuredAIResponse,
} from "../output/aiResponse.validator.js";
import {
  createNextActionPrompt,
} from "../prompts/nextActionPrompt.js";

function createResponse(
  action: BrowserActionType,
  overrides: Partial<StructuredAIResponse> = {},
): StructuredAIResponse {
  const status: WorkflowStatus =
    action === "STOP"
      ? "TERMINATED"
      : "AI_EXECUTING";

  return {
    requestId: "req-model-echo",
    status,
    action,
    targetElementId: null,
    inputValue: null,
    message: "next action",
    confidence: 1,
    requiresUserAction: false,
    decisionType: null,
    secureInputType: null,
    riskType: null,
    options: null,
    confirmationId: null,
    summary: null,
    ...overrides,
  };
}

const snapshot: BackendSanitizedDomSnapshot = {
  schemaVersion: "1.0",
  snapshotId: "snap-test",
  page: {
    url: "https://example.test",
    title: "test",
    productId: null,
    productName: null,
    productPeriod: null,
  },
  elements: [],
};

test("Production action allowlist excludes SCROLL and WAIT", () => {
  assert.deepEqual(
    PRODUCTION_STRUCTURED_ACTIONS,
    [
      "CLICK",
      "TYPE",
      "NONE",
      "WAIT_FOR_USER",
      "PAUSE_FOR_SECURE_INPUT",
      "REQUEST_FINAL_CONFIRMATION",
      "STOP",
    ],
  );

  for (const action of ["SCROLL", "WAIT"] as const) {
    const result = validateStructuredAIResponse(
      createResponse(action),
    );

    assert.equal(result.valid, false, action);
    assert.throws(
      () => adaptStructuredResponseToBackend(createResponse(action)),
      /Production/,
    );
  }
});

test("Production prompt exposes the same safe action set", () => {
  const prompt = createNextActionPrompt(
    "req-trusted",
    {
      rawMessage: "open a product",
      intent: "OPEN_DEPOSIT",
    },
    {
      page: {
        url: "https://example.test",
        title: "test",
      },
      elements: [],
      metadata: {
        originalElementCount: 0,
        modelElementCount: 0,
      },
    },
  );

  assert.doesNotMatch(prompt, /\bSCROLL\b/);
  assert.doesNotMatch(prompt, /"WAIT"/);
  assert.match(
    prompt,
    /CLICK \| TYPE \| NONE \| WAIT_FOR_USER \| PAUSE_FOR_SECURE_INPUT \| REQUEST_FINAL_CONFIRMATION \| STOP/,
  );
  assert.match(
    prompt,
    /status "COMPLETED"를 반환하지 마십시오/,
  );
});

test("Production validator rejects COMPLETED with NONE", () => {
  const result = validateStructuredAIResponse(
    createResponse("NONE", {
      status: "COMPLETED",
    }),
  );

  assert.equal(result.valid, false);
});

test("trusted C requestId replaces the model echo", () => {
  const response = bindTrustedRequestId(
    createResponse("NONE", {
      requestId: "req-untrusted-model",
    }),
    "req-generated-by-c",
  );

  assert.equal(response.requestId, "req-generated-by-c");
});

test("CLICK, TYPE, and NONE preserve D23 action fields in the Backend response", () => {
  const cases: Array<{
    response: StructuredAIResponse;
    expected: ReturnType<typeof adaptStructuredResponseToBackend>;
  }> = [
    {
      response: createResponse("CLICK", {
        targetElementId: "el-click",
      }),
      expected: {
        actionType: "CLICK",
        elementId: "el-click",
        value: null,
        scrollX: null,
        scrollY: null,
        waitMillis: null,
        status: "AI_EXECUTING",
        message: "next action",
        requiresUserAction: false,
        executionBlocked: false,
        decisionType: null,
        sourceSnapshotId: null,
        options: [],
        terms: [],
        confirmationType: null,
        confirmationTargetElementId: null,
      },
    },
    {
      response: createResponse("TYPE", {
        targetElementId: "el-type",
        inputValue: "value",
      }),
      expected: {
        actionType: "TYPE",
        elementId: "el-type",
        value: "value",
        scrollX: null,
        scrollY: null,
        waitMillis: null,
        status: "AI_EXECUTING",
        message: "next action",
        requiresUserAction: false,
        executionBlocked: false,
        decisionType: null,
        sourceSnapshotId: null,
        options: [],
        terms: [],
        confirmationType: null,
        confirmationTargetElementId: null,
      },
    },
    {
      response: createResponse("NONE"),
      expected: {
        actionType: "NONE",
        elementId: null,
        value: null,
        scrollX: null,
        scrollY: null,
        waitMillis: null,
        status: "AI_EXECUTING",
        message: "next action",
        requiresUserAction: false,
        executionBlocked: false,
        decisionType: null,
        sourceSnapshotId: null,
        options: [],
        terms: [],
        confirmationType: null,
        confirmationTargetElementId: null,
      },
    },
  ];

  for (const { response, expected } of cases) {
    const wire = adaptStructuredResponseToBackend(response);
    assert.deepEqual(wire, expected);
    assert.deepEqual(
      Object.keys(wire),
      [
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
      ],
    );
  }
});

test("STOP is STOPPED even when a model labels it COMPLETED", async () => {
  let executeCount = 0;

  const result = await runAgentLoop(
    {
      rawMessage: "stop",
      intent: "CANCEL_WORKFLOW",
    },
    snapshot,
    {
      decide: async () => createResponse("STOP", {
        status: "COMPLETED",
      }),
      execute: async () => {
        executeCount++;
      },
      getNextSnapshot: async () => snapshot,
      createRequestId: () => "req-stop",
    },
  );

  assert.equal(result.status, "STOPPED");
  assert.equal(executeCount, 0);
});
