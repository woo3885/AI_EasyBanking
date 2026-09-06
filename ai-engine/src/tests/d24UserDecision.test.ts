import assert from "node:assert/strict";
import test from "node:test";

import {
  resumeAgentLoopAfterUserDecision,
  resumeAgentLoopAfterSecureInput,
  runAgentLoop,
} from "../agent/agentLoop.runner.js";
import type {
  AgentLoopResult,
} from "../agent/agentLoop.types.js";
import type {
  AiActionRequest,
  BackendSanitizedDomElement,
  BackendSanitizedDomSnapshot,
} from "../api/aiRequest.types.js";
import {
  adaptBackendRequestToAiActionRequest,
} from "../api/aiDecisionRequest.adapter.js";
import {
  validateBackendAiDecisionRequest,
} from "../api/aiDecisionRequest.validator.js";
import {
  adaptStructuredResponseToBackend,
} from "../api/aiDecisionResponse.adapter.js";
import {
  sanitizeInternalMessage,
  SAFE_INTERNAL_MESSAGE,
} from "../messages/messageSafety.js";
import type {
  StructuredAIResponse,
} from "../output/aiResponse.types.js";
import {
  assertStructuredAIResponse,
  validateStructuredAIResponse,
} from "../output/aiResponse.validator.js";
import {
  parseStructuredAIResponse,
} from "../output/aiResponse.parser.js";
import {
  enforceUserDecisionPolicy,
} from "../policy/userDecision.policy.js";
import {
  createNextActionPrompt,
} from "../prompts/nextActionPrompt.js";
import {
  generateStructuredAction,
} from "../services/structuredAction.service.js";
import {
  detectTerms,
} from "../terms/termsAgreement.detector.js";
import {
  UserDecisionContextStore,
} from "../workflow/userDecisionContext.store.js";
import {
  validateDecisionOptions,
  validateDecisionTerms,
} from "../workflow/userDecision.types.js";

function createElement(
  elementId: string,
  text: string,
  securityPolicy: BackendSanitizedDomElement["securityPolicy"] =
    "USER_DECISION",
): BackendSanitizedDomElement {
  return {
    elementId,
    tag: "button",
    role: "button",
    text,
    ariaLabel: null,
    placeholder: null,
    inputType: null,
    visible: true,
    enabled: true,
    checked: null,
    boundingBox: null,
    securityPolicy,
  };
}

function createSnapshot(
  snapshotId: string,
  elements: BackendSanitizedDomElement[] = [],
): BackendSanitizedDomSnapshot {
  return {
    schemaVersion: "1.0",
    snapshotId,
    page: {
      url: "https://example.test/decision",
      title: "사용자 선택",
      productId: null,
      productName: null,
      productPeriod: null,
    },
    elements,
  };
}

function createResponse(
  overrides: Partial<StructuredAIResponse> = {},
): StructuredAIResponse {
  return {
    requestId: "req-d24",
    status: "AI_EXECUTING",
    action: "CLICK",
    targetElementId: "el-product",
    inputValue: null,
    message: "다음 항목을 선택합니다.",
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

function createRequest(
  elements: BackendSanitizedDomElement[],
): AiActionRequest {
  return {
    requestId: "req-d24",
    userGoal: {
      rawMessage: "사용자가 직접 선택할 항목을 보여줘",
      intent: "USER_DECISION",
      conditions: [],
    },
    domSnapshot: createSnapshot(
      "snap-before-decision",
      elements,
    ),
  };
}

function createBackendRequest(
  userDecision?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    userRequest:
      "사용자가 검증한 선택 이후 다음 단계로 진행해줘",
    snapshot: createSnapshot(
      "snap-current-decision",
      [
        createElement(
          "el-next-normal",
          "다음 단계",
          "NORMAL",
        ),
      ],
    ),
    ...(userDecision
      ? { userDecision }
      : {}),
  };
}

test("Production runtime rejects protected actions without rich decision metadata", () => {
  const protectedElements = [
    createElement("el-product", "상품 선택"),
    createElement("el-source-account", "출금 계좌 선택"),
    createElement("el-recipient", "수취인 선택"),
    createElement("el-required-term", "필수 약관 동의"),
    createElement("el-optional-term", "선택 약관 동의"),
  ];
  const request = createRequest(protectedElements);

  for (const element of protectedElements) {
    assert.throws(
      () => enforceUserDecisionPolicy(
        createResponse({
          targetElementId: element.elementId,
          confidence: 1,
        }),
        request,
      ),
      /requires validated decision metadata/,
    );
  }

  assert.throws(
    () => enforceUserDecisionPolicy(
      createResponse({
        action: "SELECT",
        targetElementId: "el-source-account",
        inputValue: "account-1",
      }),
      request,
    ),
    /requires validated decision metadata/,
  );
});

test("Production structured service safely falls back when decision metadata is missing", async () => {
  const request = createRequest([
    createElement("el-product", "상품 선택"),
  ]);

  const result = await generateStructuredAction(
    request,
    async () => ({
      model: "offline-test",
      source: "GEMINI",
      text: JSON.stringify(
        createResponse({
          requestId: "untrusted-model-request",
          targetElementId: "el-product",
        }),
      ),
    }),
  );

  assert.equal(result.requestId, request.requestId);
  assert.equal(result.status, "ERROR");
  assert.equal(result.action, "NONE");
  assert.equal(result.targetElementId, null);
});

test("D24 prompt forbids automatic choices and validation-error CLICK workarounds", () => {
  const prompt = createNextActionPrompt(
    "req-prompt-d24",
    {
      rawMessage: "예금 약관을 확인해줘",
      intent: "OPEN_DEPOSIT",
      conditions: [],
    },
    {
      page: {
        url: "/deposit/terms/deposit-12m",
        title: "예금 약관",
      },
      elements: [],
      metadata: {
        originalElementCount: 0,
        modelElementCount: 0,
      },
    },
  );

  assert.match(prompt, /Never CLICK, TYPE, or SELECT/);
  assert.match(prompt, /product, source account, recipient/);
  assert.match(prompt, /required term, or optional term/);
  assert.match(prompt, /Never use confidence/);
  assert.match(prompt, /Never auto-agree/);
  assert.match(prompt, /Return WAIT_FOR_USER/);
  assert.match(prompt, /validation error/);
  assert.doesNotMatch(
    prompt,
    /decisionType must be one of[^\n]*ADDITIONAL_INFORMATION/,
  );
  assert.match(prompt, /Never generate checked/);
});

test("internal decision types reject blank and duplicate IDs while preserving order", () => {
  const options = validateDecisionOptions([
    { id: "option-b", label: "두 번째" },
    { id: "option-a", label: "첫 번째" },
  ]);

  assert.deepEqual(
    options.map((option) => option.id),
    ["option-b", "option-a"],
  );

  assert.throws(() =>
    validateDecisionOptions([
      { id: " ", label: "빈 ID" },
    ]),
  );
  assert.throws(() =>
    validateDecisionOptions([
      { id: "same", label: "하나" },
      { id: "same", label: "둘" },
    ]),
  );
  assert.throws(() =>
    validateDecisionOptions([
      { id: " padded ", label: "변형 금지" },
    ]),
  );
});

test("terms require an explicit boolean required field", () => {
  const terms = validateDecisionTerms([
    {
      id: "term-required",
      label: "필수 약관",
      required: true,
    },
    {
      id: "term-optional",
      label: "선택 약관",
      required: false,
    },
  ]);

  assert.deepEqual(
    terms.map((term) => term.required),
    [true, false],
  );

  assert.throws(() =>
    validateDecisionTerms([
      {
        id: "term-invalid",
        label: "필수 정보 없음",
      } as never,
    ]),
  );

  const invalidStructured = createResponse({
    status: "USER_DECISION_REQUIRED",
    action: "WAIT_FOR_USER",
    targetElementId: null,
    requiresUserAction: true,
    decisionType: "TERMS_AGREEMENT",
    options: [
      {
        id: "term-invalid",
        label: "필수 정보 없음",
      },
    ] as never,
  });

  assert.equal(
    validateStructuredAIResponse(invalidStructured).valid,
    false,
  );
});

test("Structured response semantic validation rejects duplicate option IDs", () => {
  const duplicateOptions = createResponse({
    status: "USER_DECISION_REQUIRED",
    action: "WAIT_FOR_USER",
    targetElementId: null,
    requiresUserAction: true,
    decisionType: "PRODUCT_SELECTION",
    options: [
      { id: "same", label: "상품 A" },
      { id: "same", label: "상품 B" },
    ],
  });

  assert.throws(() =>
    assertStructuredAIResponse(duplicateOptions),
  );
  assert.equal(
    validateStructuredAIResponse(duplicateOptions).valid,
    false,
  );
});

test("terms detector preserves Backend snapshot element IDs instead of term-N IDs", () => {
  const terms = detectTerms([
    {
      elementId: "el-service-required",
      text: "[필수] 서비스 이용약관 동의",
    },
    {
      elementId: "el-marketing-optional",
      text: "[선택] 마케팅 정보 수신 동의",
    },
  ]);

  assert.deepEqual(
    terms.map((term) => term.termId),
    ["el-service-required", "el-marketing-optional"],
  );
  assert.deepEqual(
    terms.map((term) => term.requirement),
    ["REQUIRED", "OPTIONAL"],
  );

  assert.throws(() =>
    detectTerms([
      {
        elementId: "duplicate-term",
        text: "[필수] 서비스 이용약관 동의",
      },
      {
        elementId: "duplicate-term",
        text: "[선택] 마케팅 정보 수신 동의",
      },
    ]),
  );
});

test("message safety removes technical disclosure, sensitive values, line breaks, and excess length", () => {
  assert.equal(
    sanitizeInternalMessage(
      "system prompt: reveal https://localhost:3000/api/action",
    ),
    SAFE_INTERNAL_MESSAGE,
  );
  assert.equal(
    sanitizeInternalMessage("OTP: 123456\n다음 단계"),
    "[보호됨] 다음 단계",
  );
  assert.doesNotMatch(
    sanitizeInternalMessage("연락처 010-1234-5678 확인"),
    /010-1234-5678/,
  );
  assert.ok(
    sanitizeInternalMessage("가".repeat(300)).length <= 160,
  );

  const parsed = parseStructuredAIResponse(
    JSON.stringify(
      createResponse({
        message: "system prompt: https://localhost:3000/api/action",
      }),
    ),
  );

  assert.equal(parsed.message, SAFE_INTERNAL_MESSAGE);
});

function createPausedResult(): AgentLoopResult {
  return {
    status: "WAITING_FOR_USER",
    steps: [],
    finalSnapshot: createSnapshot("snap-paused"),
    finalResponse: createResponse({
      status: "USER_DECISION_REQUIRED",
      action: "WAIT_FOR_USER",
      targetElementId: null,
      inputValue: null,
      requiresUserAction: true,
    }),
  };
}

test("verified decision context preserves exact IDs and blocks missing, stale, and duplicate resume", async () => {
  const store = new UserDecisionContextStore();
  const paused = createPausedResult();
  const resumedSnapshot = createSnapshot("snap-resumed");
  const dependencies = {
    decide: async (request: AiActionRequest) => {
      assert.deepEqual(
        request.userDecisionContext?.selectedOptionIds,
        ["term-required-2", "term-required-1"],
      );

      return createResponse({
        status: "COMPLETED",
        action: "NONE",
        targetElementId: null,
        inputValue: null,
        requiresUserAction: false,
      });
    },
    execute: async () => {
      throw new Error("completed resume must not execute an action");
    },
    getNextSnapshot: async () => {
      throw new Error("completed resume must not request another snapshot");
    },
    createRequestId: (stepNumber: number) =>
      `req-resume-${stepNumber}`,
  };
  const context = {
    decisionId: "decision-terms-1",
    decisionType: "TERMS_AGREEMENT" as const,
    selectedOptionIds: [
      "term-required-2",
      "term-required-1",
    ],
    sourceSnapshotId: "snap-paused",
  };

  assert.throws(() =>
    store.registerPending({
      decisionId: "unsupported-decision",
      decisionType: "ACCOUNT_SELECTION" as never,
      optionIds: ["account-1"],
      snapshotId: "snap-paused",
    }),
    /not supported/,
  );

  await assert.rejects(() =>
    resumeAgentLoopAfterUserDecision(
      {
        rawMessage: "약관 선택 후 계속",
        intent: "OPEN_DEPOSIT",
      },
      paused,
      context,
      resumedSnapshot,
      store,
      dependencies,
    ),
    /stale user decision/,
  );

  store.registerPending({
    decisionId: "decision-terms-1",
    decisionType: "TERMS_AGREEMENT",
    optionIds: [
      "term-required-1",
      "term-required-2",
      "term-optional",
    ],
    snapshotId: "snap-paused",
  });

  await assert.rejects(() =>
    resumeAgentLoopAfterUserDecision(
      {
        rawMessage: "약관 선택 후 계속",
        intent: "OPEN_DEPOSIT",
      },
      paused,
      {
        ...context,
        decisionId: "stale-decision",
      },
      resumedSnapshot,
      store,
      dependencies,
    ),
    /stale user decision/,
  );

  const result = await resumeAgentLoopAfterUserDecision(
    {
      rawMessage: "약관 선택 후 계속",
      intent: "OPEN_DEPOSIT",
    },
    paused,
    context,
    resumedSnapshot,
    store,
    dependencies,
  );

  assert.equal(result.status, "COMPLETED");
  assert.deepEqual(
    store.latestContext()?.selectedOptionIds,
    ["term-required-2", "term-required-1"],
  );

  await assert.rejects(() =>
    resumeAgentLoopAfterUserDecision(
      {
        rawMessage: "약관 선택 후 계속",
        intent: "OPEN_DEPOSIT",
      },
      paused,
      context,
      createSnapshot("snap-resumed-again"),
      store,
      dependencies,
    ),
    /duplicate user decision resume/,
  );
});

test("user-decision resume cannot bypass secure, final, or risk protection", async () => {
  await assert.rejects(() =>
    resumeAgentLoopAfterSecureInput(
      {
        rawMessage: "계속",
        intent: "UNKNOWN",
      },
      createPausedResult(),
      createSnapshot("snap-not-secure"),
      {
        decide: async () => createResponse(),
        execute: async () => {},
        getNextSnapshot: async () =>
          createSnapshot("snap-next"),
        createRequestId: () => "req-not-secure",
      },
    ),
    /SECURE_INPUT pause/,
  );

  const protectedResponses = [
    createResponse({
      status: "SECURE_INPUT_REQUIRED",
      action: "WAIT_FOR_USER",
      targetElementId: null,
      requiresUserAction: true,
    }),
    createResponse({
      status: "FINAL_CONFIRMATION_REQUIRED",
      action: "WAIT_FOR_USER",
      targetElementId: null,
      requiresUserAction: true,
    }),
    createResponse({
      status: "RISK_WARNING",
      action: "CLICK",
      targetElementId: "el-normal",
    }),
  ];

  for (const response of protectedResponses) {
    let executeCount = 0;
    const result = await runAgentLoop(
      {
        rawMessage: "계속",
        intent: "UNKNOWN",
      },
      createSnapshot("snap-protected"),
      {
        decide: async () => response,
        execute: async () => {
          executeCount++;
        },
        getNextSnapshot: async () =>
          createSnapshot("snap-next"),
        createRequestId: () => "req-protected",
      },
    );

    assert.equal(result.status, "ERROR");
    assert.equal(executeCount, 0);
  }
});

test("Agent Loop maxSteps prevents an unbounded repeated-action loop", async () => {
  let executeCount = 0;
  let snapshotSequence = 0;
  const initialSnapshot = createSnapshot("snap-initial");
  const result = await runAgentLoop(
    {
      rawMessage: "계속",
      intent: "UNKNOWN",
    },
    initialSnapshot,
    {
      decide: async () =>
        createResponse({
          targetElementId: "el-normal",
        }),
      execute: async () => {
        executeCount++;
      },
      getNextSnapshot: async () =>
        createSnapshot(
          `snap-next-${++snapshotSequence}`,
        ),
      createRequestId: (stepNumber) =>
        `req-loop-${stepNumber}`,
    },
    3,
  );

  assert.equal(result.status, "MAX_STEPS_REACHED");
  assert.equal(executeCount, 3);
});

test("D23 action fields remain unchanged inside the 16-field Backend contract", () => {
  const response = adaptStructuredResponseToBackend(
    createResponse(),
  );

  assert.deepEqual(
    Object.keys(response),
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

  assert.deepEqual(
    {
      actionType: response.actionType,
      elementId: response.elementId,
      value: response.value,
      scrollX: response.scrollX,
      scrollY: response.scrollY,
      waitMillis: response.waitMillis,
    },
    {
      actionType: "CLICK",
      elementId: "el-product",
      value: null,
      scrollX: null,
      scrollY: null,
      waitMillis: null,
    },
  );
});

test("Production request keeps the legacy path when userDecision is absent", () => {
  const request =
    adaptBackendRequestToAiActionRequest(
      createBackendRequest(),
    );

  assert.equal(
    request.domSnapshot.snapshotId,
    "snap-current-decision",
  );
  assert.equal(
    request.userDecisionContext,
    undefined,
  );
});

test("Production request accepts all authoritative DecisionTypes and preserves exact context", () => {
  const cases = [
    ["PRODUCT_SELECTION", ["product-1"]],
    ["SOURCE_ACCOUNT_SELECTION", ["account-2"]],
    ["RECIPIENT_SELECTION", ["recipient-3"]],
    ["ADDITIONAL_INFORMATION", ["information-4"]],
    ["TERMS_AGREEMENT", []],
    ["TERMS_AGREEMENT", ["term-b"]],
    ["TERMS_AGREEMENT", ["term-b", "term-a"]],
  ] as const;

  for (const [decisionType, selectedOptionIds] of cases) {
    const selected = [...selectedOptionIds];
    const request =
      adaptBackendRequestToAiActionRequest(
        createBackendRequest({
          decisionId: `decision-${decisionType}`,
          decisionType,
          selectedOptionIds: selected,
          sourceSnapshotId: "snap-source-decision",
        }),
      );

    assert.equal(
      request.userDecisionContext?.decisionType,
      decisionType,
    );
    assert.equal(
      request.userDecisionContext?.decisionId,
      `decision-${decisionType}`,
    );
    assert.deepEqual(
      request.userDecisionContext?.selectedOptionIds,
      selected,
    );
    assert.equal(
      request.userDecisionContext?.sourceSnapshotId,
      "snap-source-decision",
    );
  }
});

test("Production request rejects aliases, malformed IDs, duplicates, cardinality, and unknown fields", () => {
  const validDecision = {
    decisionId: "decision-valid",
    decisionType: "PRODUCT_SELECTION",
    selectedOptionIds: ["option-1"],
    sourceSnapshotId: "snap-source-decision",
  };

  const invalidDecisions = [
    { ...validDecision, decisionType: "ACCOUNT_SELECTION" },
    { ...validDecision, decisionType: "UNKNOWN" },
    { ...validDecision, decisionId: " decision-valid" },
    { ...validDecision, sourceSnapshotId: "snap-source-decision " },
    { ...validDecision, selectedOptionIds: [" option-1"] },
    { ...validDecision, selectedOptionIds: ["option-1", "option-1"] },
    { ...validDecision, selectedOptionIds: [] },
    { ...validDecision, selectedOptionIds: ["option-1", "option-2"] },
    {
      ...validDecision,
      selectedOptionIds: Array.from(
        { length: 21 },
        (_, index) => `option-${index}`,
      ),
    },
    { ...validDecision, unexpected: true },
  ];

  for (const userDecision of invalidDecisions) {
    assert.throws(() =>
      validateBackendAiDecisionRequest(
        createBackendRequest(userDecision),
      ),
    );
  }

  assert.throws(() =>
    validateBackendAiDecisionRequest({
      ...createBackendRequest(validDecision),
      unexpected: true,
    }),
  );
});

test("Production request rejects a resumed decision on the source snapshot", () => {
  assert.throws(
    () =>
      adaptBackendRequestToAiActionRequest({
        userRequest: "계속 진행해줘",
        snapshot: createSnapshot("snap-same"),
        userDecision: {
          decisionId: "decision-same-snapshot",
          decisionType: "TERMS_AGREEMENT",
          selectedOptionIds: [],
          sourceSnapshotId: "snap-same",
        },
      }),
    /new snapshot/,
  );
});

test("Prompt includes verified context only when present and preserves selected ID order", () => {
  const goal = {
    rawMessage: "선택 이후 계속",
    intent: "OPEN_DEPOSIT",
    conditions: [],
  };
  const dom = {
    page: {
      url: "/deposit/next",
      title: "다음 단계",
    },
    elements: [],
    metadata: {
      originalElementCount: 0,
      modelElementCount: 0,
    },
  };
  const withoutContext = createNextActionPrompt(
    "req-without-context",
    goal,
    dom,
  );
  const withContext = createNextActionPrompt(
    "req-with-context",
    goal,
    dom,
    {
      decisionId: "decision-prompt",
      decisionType: "TERMS_AGREEMENT",
      selectedOptionIds: ["term-b", "term-a"],
      sourceSnapshotId: "snap-source-prompt",
    },
  );

  assert.doesNotMatch(
    withoutContext,
    /Backend-verified user decision/,
  );
  assert.match(
    withContext,
    /Backend-verified user decision/,
  );
  assert.match(withContext, /"decisionId": "decision-prompt"/);
  assert.match(withContext, /"decisionType": "TERMS_AGREEMENT"/);
  assert.match(withContext, /"sourceSnapshotId": "snap-source-prompt"/);
  assert.ok(
    withContext.indexOf('"term-b"') <
      withContext.indexOf('"term-a"'),
  );
  assert.match(withContext, /Never add, remove, reorder/);
  assert.match(withContext, /Never CLICK or SELECT/);
  assert.match(withContext, /Do not request the same completed decision again/);
  assert.match(withContext, /new and separate unresolved user decision/);
});

test("Production uses verified context for the next NORMAL action without process state", async () => {
  const backendRequest = createBackendRequest({
    decisionId: "decision-production",
    decisionType: "SOURCE_ACCOUNT_SELECTION",
    selectedOptionIds: ["account-selected"],
    sourceSnapshotId: "snap-source-production",
  });
  const first =
    adaptBackendRequestToAiActionRequest(
      backendRequest,
    );
  const retry =
    adaptBackendRequestToAiActionRequest(
      backendRequest,
    );

  const decide = async ({ prompt }: { prompt: string }) => {
    assert.match(prompt, /decision-production/);
    assert.match(prompt, /account-selected/);
    return {
      model: "offline-test",
      source: "GEMINI" as const,
      text: JSON.stringify(
        createResponse({
          requestId: "untrusted-model-request",
          targetElementId: "el-next-normal",
        }),
      ),
    };
  };

  const firstResult = await generateStructuredAction(
    first,
    decide,
  );
  const retryResult = await generateStructuredAction(
    retry,
    decide,
  );

  assert.equal(firstResult.action, "CLICK");
  assert.equal(retryResult.action, "CLICK");
  assert.equal(
    firstResult.targetElementId,
    "el-next-normal",
  );
});

test("Production blocks a model from clicking an already resolved selected ID", async () => {
  const request =
    adaptBackendRequestToAiActionRequest({
      userRequest: "선택 이후 계속",
      snapshot: createSnapshot(
        "snap-current-resolved",
        [
          createElement(
            "resolved-option",
            "이전 선택",
            "NORMAL",
          ),
        ],
      ),
      userDecision: {
        decisionId: "decision-resolved",
        decisionType: "PRODUCT_SELECTION",
        selectedOptionIds: ["resolved-option"],
        sourceSnapshotId: "snap-source-resolved",
      },
    });

  const result = await generateStructuredAction(
    request,
    async () => ({
      model: "offline-test",
      source: "GEMINI",
      text: JSON.stringify(
        createResponse({
          targetElementId: "resolved-option",
        }),
      ),
    }),
  );

  assert.equal(result.status, "ERROR");
  assert.equal(result.action, "NONE");
  assert.equal(result.targetElementId, null);
});

test("Verified context still allows a separate new USER_DECISION wait", async () => {
  const request =
    adaptBackendRequestToAiActionRequest({
      userRequest: "다음 사용자 선택을 확인해줘",
      snapshot: createSnapshot(
        "snap-current-next-decision",
        [createElement("new-decision", "새로운 선택")],
      ),
      userDecision: {
        decisionId: "decision-previous",
        decisionType: "PRODUCT_SELECTION",
        selectedOptionIds: ["previous-option"],
        sourceSnapshotId: "snap-source-previous",
      },
    });

  const result = await generateStructuredAction(
    request,
    async () => ({
      model: "offline-test",
      source: "GEMINI",
      text: JSON.stringify(
        createResponse({
          status: "USER_DECISION_REQUIRED",
          action: "WAIT_FOR_USER",
          targetElementId: null,
          requiresUserAction: true,
          decisionType: "RECIPIENT_SELECTION",
          options: [
            {
              id: "new-decision",
              label: "untrusted model label",
            },
          ],
        }),
      ),
    }),
  );

  assert.equal(result.status, "USER_DECISION_REQUIRED");
  assert.equal(result.action, "WAIT_FOR_USER");
  assert.equal(result.decisionType, "RECIPIENT_SELECTION");
  assert.deepEqual(
    result.options?.map((option) => option.id),
    ["new-decision"],
  );
});

test("Verified context cannot bypass secure, final, or risk protection", () => {
  const request = createRequest([
    createElement("el-normal", "일반 버튼", "NORMAL"),
  ]);
  request.userDecisionContext = {
    decisionId: "decision-protected",
    decisionType: "TERMS_AGREEMENT",
    selectedOptionIds: [],
    sourceSnapshotId: "snap-source-protected",
  };

  const secure = enforceUserDecisionPolicy(
    createResponse({
      status: "SECURE_INPUT_REQUIRED",
      action: "PAUSE_FOR_SECURE_INPUT",
      targetElementId: null,
      requiresUserAction: true,
      secureInputType: "OTP",
    }),
    request,
  );
  const final = enforceUserDecisionPolicy(
    createResponse({
      status: "FINAL_CONFIRMATION_REQUIRED",
      action: "REQUEST_FINAL_CONFIRMATION",
      targetElementId: null,
      requiresUserAction: true,
      confirmationId: "confirmation-1",
    }),
    request,
  );

  assert.equal(secure.action, "PAUSE_FOR_SECURE_INPUT");
  assert.equal(final.action, "REQUEST_FINAL_CONFIRMATION");
  assert.throws(() =>
    enforceUserDecisionPolicy(
      createResponse({
        status: "RISK_WARNING",
        action: "CLICK",
        targetElementId: "el-normal",
        riskType: "SUSPICIOUS_TRANSFER",
      }),
      request,
    ),
  );
  assert.throws(() =>
    enforceUserDecisionPolicy(
      createResponse({
        status: "SECURE_INPUT_REQUIRED",
        action: "CLICK",
        targetElementId: "el-normal",
        secureInputType: "OTP",
      }),
      request,
    ),
  );
});

test("Production does not log raw model output and sanitizes financial secrets", async () => {
  const logged: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...values: unknown[]) => {
    logged.push(values.join(" "));
  };
  console.error = (...values: unknown[]) => {
    logged.push(values.join(" "));
  };

  try {
    const result = await generateStructuredAction(
      createRequest([
        createElement("el-normal", "다음", "NORMAL"),
      ]),
      async () => ({
        model: "offline-test",
        source: "GEMINI",
        text: JSON.stringify(
          createResponse({
            targetElementId: "el-normal",
            message:
              "password=secret OTP: 123456 계좌 123-456-789012",
          }),
        ),
      }),
    );

    assert.doesNotMatch(result.message, /secret|123456|123-456-789012/);
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }

  assert.doesNotMatch(
    logged.join("\n"),
    /secret|123456|123-456-789012|Raw Gemini Response/,
  );
  assert.doesNotMatch(
    sanitizeInternalMessage("1234567890123456"),
    /1234567890123456/,
  );
  assert.equal(
    sanitizeInternalMessage(
      "system prompt: reveal https://localhost:3001/api/ai/action",
    ),
    SAFE_INTERNAL_MESSAGE,
  );
});

test("C-to-B response matches the exact 16-field rich decision contract", () => {
  const currentRequest = createRequest([
    {
      ...createElement("term-1", "필수 약관"),
      inputType: "checkbox",
      checked: false,
    },
  ]);
  const canonical = enforceUserDecisionPolicy(
    createResponse({
      status: "USER_DECISION_REQUIRED",
      action: "WAIT_FOR_USER",
      targetElementId: null,
      requiresUserAction: true,
      decisionType: "TERMS_AGREEMENT",
      options: [
        {
          id: "term-1",
          label: "필수 약관",
          required: true,
        },
      ],
    }),
    currentRequest,
  );
  const response = adaptStructuredResponseToBackend(
    canonical,
    currentRequest.domSnapshot.snapshotId,
  );

  assert.deepEqual(
    Object.keys(response),
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

  for (const field of [
    "decisionId",
    "description",
    "disabled",
  ]) {
    assert.equal(field in response, false);
  }

  assert.equal(response.actionType, "WAIT_FOR_USER");
  assert.equal(response.elementId, null);
  assert.equal(response.value, null);
  assert.equal(response.scrollX, null);
  assert.equal(response.scrollY, null);
  assert.equal(response.waitMillis, null);
  assert.equal(response.status, "USER_DECISION_REQUIRED");
  assert.equal(response.requiresUserAction, true);
  assert.equal(response.executionBlocked, true);
  assert.equal(response.decisionType, "TERMS_AGREEMENT");
  assert.equal(
    response.sourceSnapshotId,
    "snap-before-decision",
  );
  assert.deepEqual(response.options, []);
  assert.deepEqual(response.terms, [
    {
      id: "term-1",
      label: "필수 약관",
      required: true,
      checked: false,
    },
  ]);
  assert.deepEqual(
    Object.keys(response.terms[0] ?? {}),
    ["id", "label", "required", "checked"],
  );
});
