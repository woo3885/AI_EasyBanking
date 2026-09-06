import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";

import express from "express";

import {
  runAgentLoop,
} from "../agent/agentLoop.runner.js";
import {
  createAiActionRouter,
} from "../api/aiAction.route.js";
import {
  adaptBackendRequestToAiActionRequest,
} from "../api/aiDecisionRequest.adapter.js";
import {
  validateBackendAiDecisionRequest,
} from "../api/aiDecisionRequest.validator.js";
import {
  adaptStructuredResponseToBackend,
} from "../api/aiDecisionResponse.adapter.js";
import type {
  AiActionRequest,
  BackendAiUserDecisionContext,
  BackendSanitizedDomElement,
  BackendSanitizedDomSnapshot,
} from "../api/aiRequest.types.js";
import {
  classifyDepositScenarioStage,
  DEPOSIT_DEMO_BUTTON_LABELS,
  DEPOSIT_GUIDANCE,
  enforceDepositScenarioPolicy,
  finalizeDepositScenarioGuidance,
  readSelectedDepositProductContext,
} from "../deposit/depositScenario.policy.js";
import {
  SAFE_INTERNAL_MESSAGE,
  sanitizeInternalMessage,
} from "../messages/messageSafety.js";
import type {
  StructuredAIResponse,
} from "../output/aiResponse.types.js";
import {
  enforceUserDecisionPolicy,
} from "../policy/userDecision.policy.js";
import {
  generateStructuredAction,
} from "../services/structuredAction.service.js";

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
    boundingBox: null,
    securityPolicy: "NORMAL",
    ...overrides,
  };
}

function snapshot(
  snapshotId: string,
  elements: BackendSanitizedDomElement[],
  url = "https://demo.test/deposit/flow",
  pageOverrides: Partial<
    BackendSanitizedDomSnapshot["page"]
  > = {},
): BackendSanitizedDomSnapshot {
  return {
    schemaVersion: "1.0",
    snapshotId,
    page: {
      url,
      title: "정기예금 가입",
      productId: null,
      productName: null,
      productPeriod: null,
      ...pageOverrides,
    },
    elements,
  };
}

function request(
  domSnapshot: BackendSanitizedDomSnapshot,
  overrides: Partial<AiActionRequest> = {},
): AiActionRequest {
  return {
    requestId: "req-d25",
    userGoal: {
      rawMessage:
        "12개월 정기예금에 500만원 가입하고 싶어요.",
      intent: "DEPOSIT",
      amount: 5_000_000,
      duration: {
        value: 12,
        unit: "MONTH",
      },
      conditions: [],
    },
    domSnapshot,
    ...overrides,
  };
}

function response(
  overrides: Partial<StructuredAIResponse> = {},
): StructuredAIResponse {
  return {
    requestId: "req-model",
    status: "AI_EXECUTING",
    action: "NONE",
    targetElementId: null,
    inputValue: null,
    message: "모델의 임시 안내",
    confidence: 0.9,
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

function productChoice(
  id: string,
  productName: string,
  ariaLabel = `${productName} 선택`,
): BackendSanitizedDomElement {
  return element(id, productName, {
    ariaLabel,
    securityPolicy: "USER_DECISION",
  });
}

function termChoice(
  id: string,
  label: string,
  checked: boolean,
): BackendSanitizedDomElement {
  return element(id, label, {
    tag: "input",
    role: "checkbox",
    inputType: "checkbox",
    securityPolicy: "USER_DECISION",
    checked,
  });
}

function amountInput(): BackendSanitizedDomElement {
  return element("el-amount", "가입 금액", {
    tag: "input",
    role: "textbox",
    inputType: "text",
  });
}

function secureInput(): BackendSanitizedDomElement {
  return element("el-password", "계좌 비밀번호", {
    tag: "input",
    role: "textbox",
    inputType: "password",
    securityPolicy: "SECURE_INPUT",
  });
}

function applyPolicies(
  candidate: StructuredAIResponse,
  currentRequest: AiActionRequest,
): StructuredAIResponse {
  const stage = classifyDepositScenarioStage(
    currentRequest,
  );
  const depositChecked =
    enforceDepositScenarioPolicy(
      candidate,
      currentRequest,
    );
  return finalizeDepositScenarioGuidance(
    enforceUserDecisionPolicy(
      depositChecked,
      currentRequest,
    ),
    depositChecked,
    stage,
  );
}

async function generateFromCandidate(
  currentRequest: AiActionRequest,
  candidate: StructuredAIResponse,
): Promise<StructuredAIResponse> {
  return generateStructuredAction(
    currentRequest,
    async () => ({
      model: "offline-test",
      source: "GEMINI",
      text: JSON.stringify(candidate),
    }),
  );
}

test("existing UserGoal parser preserves the requested 12 months and 5,000,000 won", () => {
  const adapted = adaptBackendRequestToAiActionRequest({
    userRequest:
      "12개월 정기예금에 500만원 가입하고 싶어요.",
    snapshot: snapshot("snap-goal", []),
  });

  assert.equal(adapted.userGoal.intent, "DEPOSIT");
  assert.equal(adapted.userGoal.amount, 5_000_000);
  assert.deepEqual(adapted.userGoal.duration, {
    value: 12,
    unit: "MONTH",
  });
});

test("Backend detail metadata is authoritative and deposit period is optional", () => {
  const products = [
    {
      productId: "deposit-12m",
      productName: "12개월 정기예금",
      productPeriod: "12개월",
    },
    {
      productId: "deposit-preferred",
      productName: "우대금리 정기예금",
      productPeriod: "12개월",
    },
  ] as const;

  for (const product of products) {
    const detailSnapshot = snapshot(
      `snap-${product.productId}`,
      [element(
        `el-${product.productId}-next`,
        DEPOSIT_DEMO_BUTTON_LABELS.amountStart,
      )],
      `https://demo.test/deposit/products/${product.productId}`,
      product,
    );
    const adapted = adaptBackendRequestToAiActionRequest({
      userRequest:
        "100만 원으로 정기예금 가입 절차를 시작해 주세요.",
      snapshot: detailSnapshot,
    });

    assert.equal(adapted.userGoal.amount, 1_000_000);
    assert.equal(adapted.userGoal.duration, undefined);
    assert.deepEqual(
      readSelectedDepositProductContext(adapted),
      {
        productId: product.productId,
        productLabel: product.productName,
        periodMonths: 12,
        sourceSnapshotId: detailSnapshot.snapshotId,
      },
    );
  }

  const missingNewFields = snapshot("snap-old-page", []);
  const oldPage = {
    url: missingNewFields.page.url,
    title: missingNewFields.page.title,
  };
  assert.throws(() =>
    validateBackendAiDecisionRequest({
      userRequest: "100만 원 정기예금",
      snapshot: {
        ...missingNewFields,
        page: oldPage,
      },
    }),
  );
});

test("amount-only detail proceeds for both Demo products and matching period stays separate", () => {
  const products = [
    ["deposit-12m", "12개월 정기예금"],
    ["deposit-preferred", "우대금리 정기예금"],
  ] as const;

  for (const [productId, productName] of products) {
    const detailSnapshot = snapshot(
      `snap-${productId}-detail`,
      [element(
        `el-${productId}-amount-start`,
        DEPOSIT_DEMO_BUTTON_LABELS.amountStart,
      )],
      `https://demo.test/deposit/products/${productId}`,
      {
        productId,
        productName,
        productPeriod: "12개월",
      },
    );
    const amountOnly = request(detailSnapshot, {
      userGoal: {
        rawMessage:
          "100만 원으로 정기예금 가입 절차를 시작해 주세요.",
        intent: "DEPOSIT",
        amount: 1_000_000,
        conditions: [],
      },
    });
    const safe = applyPolicies(response(), amountOnly);

    assert.equal(safe.action, "CLICK");
    assert.equal(
      safe.targetElementId,
      `el-${productId}-amount-start`,
    );
    assert.equal(amountOnly.userGoal.duration, undefined);
  }

  const matching = request(snapshot(
    "snap-period-match",
    [element(
      "el-period-match-next",
      DEPOSIT_DEMO_BUTTON_LABELS.amountStart,
    )],
    "https://demo.test/deposit/products/deposit-12m",
    {
      productId: "deposit-12m",
      productName: "12개월 정기예금",
      productPeriod: "12개월",
    },
  ));
  const matched = applyPolicies(response(), matching);
  assert.equal(matched.action, "CLICK");
  assert.deepEqual(matching.userGoal.duration, {
    value: 12,
    unit: "MONTH",
  });
});

test("Production prompt separates an unspecified request period from Backend product metadata", async () => {
  const currentRequest = request(snapshot(
    "snap-period-prompt",
    [element(
      "el-period-prompt-next",
      DEPOSIT_DEMO_BUTTON_LABELS.amountStart,
    )],
    "https://demo.test/deposit/products/deposit-preferred",
    {
      productId: "deposit-preferred",
      productName: "우대금리 정기예금",
      productPeriod: "12개월",
    },
  ), {
    userGoal: {
      rawMessage:
        "100만 원으로 정기예금 가입 절차를 시작해 주세요.",
      intent: "DEPOSIT",
      amount: 1_000_000,
      conditions: [],
    },
  });
  let prompt = "";

  const safe = await generateStructuredAction(
    currentRequest,
    async (input) => {
      prompt = input.prompt;
      return {
        model: "offline-test",
        source: "GEMINI",
        text: JSON.stringify(response({
          action: "CLICK",
          targetElementId: "el-period-prompt-next",
        })),
      };
    },
  );

  assert.equal(safe.action, "CLICK");
  assert.match(prompt, /요청 기간: 없음/);
  assert.match(prompt, /선택 상품 ID: deposit-preferred/);
  assert.match(prompt, /선택 상품명: 우대금리 정기예금/);
  assert.match(prompt, /선택 상품 실제 기간: 12개월/);
  assert.match(prompt, /기간 기본값을 만들지 마십시오/);
  assert.match(prompt, /다른 상품을 자동 선택하지 마십시오/);
});

test("period mismatch and invalid product context fail closed without financial action", () => {
  const detail = snapshot(
    "snap-period-conflict",
    [element(
      "el-conflict-next",
      DEPOSIT_DEMO_BUTTON_LABELS.amountStart,
    )],
    "https://demo.test/deposit/products/deposit-12m",
    {
      productId: "deposit-12m",
      productName: "12개월 정기예금",
      productPeriod: "12개월",
    },
  );
  const mismatchRequest = request(detail, {
    userGoal: {
      rawMessage:
        "6개월 정기예금에 100만 원 가입하고 싶어요.",
      intent: "DEPOSIT",
      amount: 1_000_000,
      duration: { value: 6, unit: "MONTH" },
      conditions: [],
    },
  });
  const mismatch = applyPolicies(
    response({
      action: "CLICK",
      targetElementId: "el-conflict-next",
    }),
    mismatchRequest,
  );
  const mismatchWire = adaptStructuredResponseToBackend(
    mismatch,
    detail.snapshotId,
  );

  assert.deepEqual(mismatchWire, {
    actionType: "NONE",
    elementId: null,
    value: null,
    scrollX: null,
    scrollY: null,
    waitMillis: null,
    status: "AI_EXECUTING",
    message: DEPOSIT_GUIDANCE.periodMismatch,
    requiresUserAction: true,
    executionBlocked: true,
    decisionType: null,
    sourceSnapshotId: null,
    options: [],
    terms: [],
    confirmationType: null,
    confirmationTargetElementId: null,
  });
  assert.deepEqual(mismatchRequest.userGoal.duration, {
    value: 6,
    unit: "MONTH",
  });

  const invalidContexts = [
    { productId: null, productName: null, productPeriod: null },
    {
      productId: "deposit-12m",
      productName: "12개월 정기예금",
      productPeriod: "12개월 또는 6개월",
    },
    {
      productId: "deposit-12m",
      productName: "12개월 정기예금",
      productPeriod: "0개월",
    },
    {
      productId: "deposit-12m",
      productName: "12개월 정기예금",
      productPeriod: "1000개월",
    },
    {
      productId: "deposit-preferred",
      productName: "우대금리 정기예금",
      productPeriod: "12개월",
    },
  ] as const;

  for (const [index, context] of invalidContexts.entries()) {
    const invalid = request(snapshot(
      `snap-invalid-product-${index}`,
      [element(
        `el-invalid-product-${index}`,
        DEPOSIT_DEMO_BUTTON_LABELS.amountStart,
      )],
      "https://demo.test/deposit/products/deposit-12m",
      context,
    ));
    const blocked = applyPolicies(response(), invalid);
    assert.equal(blocked.action, "NONE");
    assert.equal(blocked.targetElementId, null);
    assert.equal(
      blocked.message,
      DEPOSIT_GUIDANCE.productVerification,
    );
  }

  const conflictingRequest = request(detail, {
    userGoal: {
      rawMessage:
        "6개월 또는 12개월 정기예금에 100만 원 가입하고 싶어요.",
      intent: "DEPOSIT",
      amount: 1_000_000,
      duration: { value: 6, unit: "MONTH" },
      conditions: [],
    },
  });
  assert.equal(
    applyPolicies(response(), conflictingRequest).action,
    "NONE",
  );
});

test("stage classifier uses semantic DOM and never classifies from URL alone", () => {
  assert.equal(
    classifyDepositScenarioStage(
      request(snapshot(
        "snap-url-only",
        [],
        "https://demo.test/deposit/terms/product-12m",
      )),
    ),
    "UNKNOWN",
  );

  assert.equal(
    classifyDepositScenarioStage(
      request(snapshot(
        "snap-semantic-terms",
        [termChoice("el-term", "[필수] 서비스 약관", false)],
        "https://demo.test/unrelated",
      )),
    ),
    "TERMS",
  );

  assert.equal(
    classifyDepositScenarioStage(
      request(snapshot("snap-secure-priority", [
        termChoice("el-term", "[필수] 서비스 약관", false),
        secureInput(),
      ])),
    ),
    "SECURE_INPUT",
  );
});

test("product list creates PRODUCT_SELECTION without automatic product selection", () => {
  const currentRequest = request(snapshot("snap-products", [
    productChoice("el-product-12m", "12개월 정기예금"),
    productChoice("el-product-preferred", "우대금리 정기예금"),
  ]));
  const safe = applyPolicies(
    response({
      action: "CLICK",
      targetElementId: "el-product-preferred",
      message: "가장 좋은 추천 상품을 자동 선택합니다.",
    }),
    currentRequest,
  );
  const wire = adaptStructuredResponseToBackend(
    safe,
    currentRequest.domSnapshot.snapshotId,
  );

  assert.equal(wire.actionType, "WAIT_FOR_USER");
  assert.equal(wire.status, "USER_DECISION_REQUIRED");
  assert.equal(wire.requiresUserAction, true);
  assert.equal(wire.executionBlocked, true);
  assert.equal(wire.decisionType, "PRODUCT_SELECTION");
  assert.equal(wire.message, DEPOSIT_GUIDANCE.productSelection);
  assert.deepEqual(
    wire.options.map((option) => option.id),
    ["el-product-12m", "el-product-preferred"],
  );
  assert.deepEqual(
    wire.options.map((option) => option.label),
    ["12개월 정기예금 선택", "우대금리 정기예금 선택"],
  );
  assert.equal(wire.elementId, null);
  assert.equal(wire.value, null);
});

test("product labels use snapshot ariaLabel and fail closed when duplicate or blank", async () => {
  const duplicate = await generateFromCandidate(
    request(snapshot("snap-products-duplicate", [
      productChoice(
        "el-product-12m",
        "12개월 정기예금",
        "예금 상품 선택",
      ),
      productChoice(
        "el-product-preferred",
        "우대금리 정기예금",
        "예금 상품 선택",
      ),
    ])),
    response(),
  );
  assert.equal(duplicate.status, "ERROR");
  assert.equal(duplicate.action, "NONE");

  const blank = await generateFromCandidate(
    request(snapshot("snap-products-blank", [
      element("el-product-blank", "", {
        ariaLabel: null,
        securityPolicy: "USER_DECISION",
      }),
    ])),
    response({
      action: "CLICK",
      targetElementId: "el-product-blank",
    }),
  );
  assert.equal(blank.status, "ERROR");
  assert.equal(blank.action, "NONE");
});

test("verified product resume preserves context and clicks only a new NORMAL navigation target", () => {
  const currentRequest = request(snapshot("snap-products-resumed", [
    productChoice("el-product-12m-new", "12개월 정기예금"),
    productChoice("el-product-preferred-new", "우대금리 정기예금"),
    element(
      "el-product-next",
      DEPOSIT_DEMO_BUTTON_LABELS.productNext,
    ),
  ]), {
    userDecisionContext: {
      decisionId: "dec-product",
      decisionType: "PRODUCT_SELECTION",
      selectedOptionIds: ["el-old-product"],
      sourceSnapshotId: "snap-products",
    },
  });
  const safe = applyPolicies(
    response({
      action: "CLICK",
      targetElementId: "el-old-product",
    }),
    currentRequest,
  );

  assert.equal(safe.action, "CLICK");
  assert.equal(safe.targetElementId, "el-product-next");
  assert.notEqual(
    safe.targetElementId,
    currentRequest.userDecisionContext?.selectedOptionIds[0],
  );
  assert.equal(safe.decisionType, null);
  assert.equal(safe.message, DEPOSIT_GUIDANCE.productDetail);
  assert.deepEqual(
    currentRequest.userDecisionContext?.selectedOptionIds,
    ["el-old-product"],
  );
});

test("product detail uses Backend semantic period and only a NORMAL navigation action", () => {
  const currentRequest = request(snapshot("snap-detail", [
    element(
      "el-join",
      DEPOSIT_DEMO_BUTTON_LABELS.amountStart,
    ),
  ], "https://demo.test/deposit/products/deposit-12m", {
    productId: "deposit-12m",
    productName: "12개월 정기예금",
    productPeriod: "12개월",
  }), {
    userDecisionContext: {
      decisionId: "dec-product",
      decisionType: "PRODUCT_SELECTION",
      selectedOptionIds: ["el-product-12m"],
      sourceSnapshotId: "snap-products",
    },
  });
  const safe = applyPolicies(
    response({
      action: "CLICK",
      targetElementId: "el-join",
      message: "추천 상품 가입이 완료되었습니다.",
    }),
    currentRequest,
  );

  assert.equal(
    classifyDepositScenarioStage(currentRequest),
    "PRODUCT_DETAIL",
  );
  assert.equal(safe.action, "CLICK");
  assert.equal(safe.targetElementId, "el-join");
  assert.equal(safe.message, DEPOSIT_GUIDANCE.productDetail);
  assert.doesNotMatch(safe.message, /추천|완료|성공/);

  const disabledRequest = request(snapshot("snap-detail-disabled", [
    element(
      "el-join-disabled",
      DEPOSIT_DEMO_BUTTON_LABELS.amountStart,
      { enabled: false },
    ),
  ], "https://demo.test/deposit/products/deposit-12m", {
    productId: "deposit-12m",
    productName: "12개월 정기예금",
    productPeriod: "12개월",
  }));
  const disabled = applyPolicies(
    response({
      action: "CLICK",
      targetElementId: "el-join-disabled",
    }),
    disabledRequest,
  );
  assert.equal(disabled.action, "NONE");
  assert.equal(disabled.targetElementId, null);
});

test("amount entry uses only the amount from UserGoal and never a model recommendation", () => {
  const currentRequest = request(snapshot("snap-amount", [
    amountInput(),
  ]));
  const safe = applyPolicies(
    response({
      action: "TYPE",
      targetElementId: "el-amount",
      inputValue: "10000000",
      message: "추천 금액을 입력합니다.",
    }),
    currentRequest,
  );

  assert.equal(
    classifyDepositScenarioStage(currentRequest),
    "AMOUNT_ENTRY",
  );
  assert.equal(safe.action, "TYPE");
  assert.equal(safe.targetElementId, "el-amount");
  assert.equal(safe.inputValue, "5000000");
  assert.equal(safe.message, DEPOSIT_GUIDANCE.amount);
});

test("amount enabled buttons advance confirm and terms phases without repeated TYPE", () => {
  const confirmRequest = request(snapshot("snap-amount-confirm", [
    amountInput(),
    element(
      "el-amount-confirm",
      DEPOSIT_DEMO_BUTTON_LABELS.amountConfirm,
    ),
    element(
      "el-terms-start-disabled",
      DEPOSIT_DEMO_BUTTON_LABELS.termsStart,
      { enabled: false },
    ),
  ]));
  const confirm = applyPolicies(
    response({
      action: "TYPE",
      targetElementId: "el-amount",
      inputValue: "1",
    }),
    confirmRequest,
  );
  assert.equal(confirm.action, "CLICK");
  assert.equal(confirm.targetElementId, "el-amount-confirm");
  assert.equal(confirm.inputValue, null);
  assert.equal(confirm.message, DEPOSIT_GUIDANCE.amountConfirm);

  const termsRequest = request(snapshot("snap-amount-terms", [
    amountInput(),
    element(
      "el-amount-confirm",
      DEPOSIT_DEMO_BUTTON_LABELS.amountConfirm,
    ),
    element(
      "el-terms-start",
      DEPOSIT_DEMO_BUTTON_LABELS.termsStart,
    ),
  ]));
  const terms = applyPolicies(
    response({
      action: "TYPE",
      targetElementId: "el-amount",
      inputValue: "1",
    }),
    termsRequest,
  );
  assert.equal(terms.action, "CLICK");
  assert.equal(terms.targetElementId, "el-terms-start");
  assert.equal(terms.inputValue, null);
  assert.equal(terms.message, DEPOSIT_GUIDANCE.termsNavigation);
});

test("missing amount emits the exact non-financial 16-field NONE wire response", () => {
  const noAmountRequest = request(snapshot("snap-no-amount", [
    amountInput(),
  ]));
  noAmountRequest.userGoal.amount = undefined;
  const missing = applyPolicies(
    response({
      action: "TYPE",
      targetElementId: "el-amount",
      inputValue: "5000000",
    }),
    noAmountRequest,
  );

  const wire = adaptStructuredResponseToBackend(
    missing,
    noAmountRequest.domSnapshot.snapshotId,
  );

  assert.deepEqual(noAmountRequest.userGoal.duration, {
    value: 12,
    unit: "MONTH",
  });
  assert.deepEqual(Object.keys(wire), RESPONSE_FIELDS);
  assert.deepEqual(wire, {
    actionType: "NONE",
    elementId: null,
    value: null,
    scrollX: null,
    scrollY: null,
    waitMillis: null,
    status: "AI_EXECUTING",
    message: DEPOSIT_GUIDANCE.amountMissing,
    requiresUserAction: true,
    executionBlocked: true,
    decisionType: null,
    sourceSnapshotId: null,
    options: [],
    terms: [],
    confirmationType: null,
    confirmationTargetElementId: null,
  });
});

test("secure fields never receive an amount TYPE", () => {
  const secureRequest = request(snapshot("snap-password", [
    secureInput(),
  ]));
  const secure = applyPolicies(
    response({
      action: "TYPE",
      targetElementId: "el-password",
      inputValue: "5000000",
    }),
    secureRequest,
  );
  assert.equal(secure.action, "PAUSE_FOR_SECURE_INPUT");
  assert.equal(secure.inputValue, null);
});

test("D25 rejects model-authored final confirmation while preserving secure and risk boundaries", async () => {
  const finalCandidate = response({
    status: "FINAL_CONFIRMATION_REQUIRED",
    action: "REQUEST_FINAL_CONFIRMATION",
    requiresUserAction: true,
    confirmationId: "confirmation-d27",
    summary: {
      product: "synthetic-deposit",
    },
  });
  const stageRequests = [
    request(snapshot("snap-final-products", [
      productChoice("el-final-product", "12개월 정기예금"),
    ])),
    request(snapshot("snap-final-detail", [
      element("el-final-rate", "가입 기간과 금리", {
        tag: "div",
        role: null,
      }),
      element("el-final-next", "가입하기"),
    ])),
    request(snapshot("snap-final-amount", [
      amountInput(),
    ])),
    request(snapshot("snap-final-terms", [
      termChoice("el-final-term", "[필수] 예금 약관", false),
    ])),
    request(snapshot("snap-final-unknown", [])),
  ];

  for (const currentRequest of stageRequests) {
    const safe = await generateFromCandidate(
      currentRequest,
      finalCandidate,
    );
    assert.equal(safe.status, "AI_EXECUTING");
    assert.equal(safe.action, "NONE");
    assert.equal(safe.confirmationId, null);
    assert.equal(safe.summary, null);
    assert.notEqual(safe.status, "FINAL_CONFIRMATION_REQUIRED");
    assert.notEqual(safe.action, "REQUEST_FINAL_CONFIRMATION");
  }

  const secure = await generateFromCandidate(
    request(snapshot("snap-final-secure", [
      secureInput(),
    ])),
    finalCandidate,
  );
  assert.equal(secure.status, "SECURE_INPUT_REQUIRED");
  assert.equal(secure.action, "PAUSE_FOR_SECURE_INPUT");

  const risk = await generateFromCandidate(
    request(snapshot("snap-risk-amount", [
      amountInput(),
    ])),
    response({
      status: "RISK_WARNING",
      action: "NONE",
      requiresUserAction: true,
      riskType: "SUSPICIOUS_DEPOSIT",
    }),
  );
  assert.equal(risk.status, "ERROR");
  assert.equal(risk.action, "NONE");
  assert.equal(risk.targetElementId, null);
  assert.equal(risk.inputValue, null);
});

test("terms keep snapshot order, required markers, and authoritative checked values", () => {
  const currentRequest = request(snapshot("snap-terms", [
    termChoice("el-term-service", "[필수] 서비스 약관", true),
    termChoice("el-term-privacy", "[필수] 개인정보 약관", false),
    termChoice("el-term-marketing", "[선택] 마케팅 동의", false),
  ]));
  const safe = applyPolicies(
    response({
      action: "CLICK",
      targetElementId: "el-term-marketing",
    }),
    currentRequest,
  );
  const wire = adaptStructuredResponseToBackend(
    safe,
    currentRequest.domSnapshot.snapshotId,
  );

  assert.equal(wire.actionType, "WAIT_FOR_USER");
  assert.equal(wire.decisionType, "TERMS_AGREEMENT");
  assert.equal(wire.message, DEPOSIT_GUIDANCE.terms);
  assert.deepEqual(wire.options, []);
  assert.deepEqual(
    wire.terms.map((term) => ({
      id: term.id,
      required: term.required,
      checked: term.checked,
    })),
    [
      { id: "el-term-service", required: true, checked: true },
      { id: "el-term-privacy", required: true, checked: false },
      { id: "el-term-marketing", required: false, checked: false },
    ],
  );
});

test("verified terms resume never replays terms and uses only the new NORMAL next target", () => {
  const currentRequest = request(snapshot("snap-terms-resumed", [
    termChoice("el-new-service", "[필수] 서비스 약관", true),
    termChoice("el-new-marketing", "[선택] 마케팅 동의", false),
    element(
      "el-terms-confirm",
      DEPOSIT_DEMO_BUTTON_LABELS.termsConfirm,
    ),
    element(
      "el-terms-next",
      DEPOSIT_DEMO_BUTTON_LABELS.passwordStart,
      { enabled: false },
    ),
  ]), {
    userDecisionContext: {
      decisionId: "dec-terms",
      decisionType: "TERMS_AGREEMENT",
      selectedOptionIds: [
        "el-old-service",
        "el-old-privacy",
      ],
      sourceSnapshotId: "snap-terms",
    },
  });
  const safe = applyPolicies(
    response({
      action: "CLICK",
      targetElementId: "el-old-service",
    }),
    currentRequest,
  );

  assert.equal(safe.action, "CLICK");
  assert.equal(safe.targetElementId, "el-terms-confirm");
  assert.equal(safe.decisionType, null);
  assert.equal(safe.options, null);
  assert.equal(safe.message, DEPOSIT_GUIDANCE.termsResume);
  assert.deepEqual(
    currentRequest.userDecisionContext?.selectedOptionIds,
    ["el-old-service", "el-old-privacy"],
  );
});

test("secure input produces the exact 16-field blocked response and ends the Agent Loop", async () => {
  const currentSnapshot = snapshot("snap-secure", [
    secureInput(),
  ]);
  const currentRequest = request(currentSnapshot);
  const safe = applyPolicies(
    response({
      action: "TYPE",
      targetElementId: "el-password",
      inputValue: "synthetic-value",
      message: "인증 성공",
    }),
    currentRequest,
  );
  const wire = adaptStructuredResponseToBackend(
    safe,
    currentSnapshot.snapshotId,
  );

  assert.deepEqual(Object.keys(wire), RESPONSE_FIELDS);
  assert.deepEqual(wire, {
    actionType: "PAUSE_FOR_SECURE_INPUT",
    elementId: null,
    value: null,
    scrollX: null,
    scrollY: null,
    waitMillis: null,
    status: "SECURE_INPUT_REQUIRED",
    message: DEPOSIT_GUIDANCE.secureInput,
    requiresUserAction: true,
    executionBlocked: true,
    decisionType: null,
    sourceSnapshotId: null,
    options: [],
    terms: [],
    confirmationType: null,
    confirmationTargetElementId: null,
  });

  let executeCount = 0;
  let snapshotCount = 0;
  const result = await runAgentLoop(
    currentRequest.userGoal,
    currentSnapshot,
    {
      decide: async () => safe,
      execute: async () => {
        executeCount++;
      },
      getNextSnapshot: async () => {
        snapshotCount++;
        return currentSnapshot;
      },
      createRequestId: () => "req-secure-loop",
    },
  );

  assert.equal(result.status, "WAITING_FOR_SECURE_INPUT");
  assert.equal(executeCount, 0);
  assert.equal(snapshotCount, 0);
});

test("Agent Loop stops before repeating an action when no new snapshot arrives", async () => {
  const currentSnapshot = snapshot("snap-unchanged", [
    element("el-next", "다음"),
  ]);
  let decideCount = 0;
  let executeCount = 0;
  const result = await runAgentLoop(
    request(currentSnapshot).userGoal,
    currentSnapshot,
    {
      decide: async () => {
        decideCount++;
        return response({
          action: "CLICK",
          targetElementId: "el-next",
        });
      },
      execute: async () => {
        executeCount++;
      },
      getNextSnapshot: async () => currentSnapshot,
      createRequestId: () => "req-no-new-snapshot",
    },
  );

  assert.equal(result.status, "ERROR");
  assert.equal(decideCount, 1);
  assert.equal(executeCount, 1);
});

test("Gemini failure has no financial action while secure DOM still fails closed", async () => {
  const amountRequest = request(snapshot("snap-fallback-amount", [
    amountInput(),
  ]));
  const amountFallback = await generateStructuredAction(
    amountRequest,
    async () => ({
      model: "offline-test",
      source: "FALLBACK",
      text: "",
    }),
  );
  assert.equal(amountFallback.status, "ERROR");
  assert.equal(amountFallback.action, "NONE");

  const secureRequest = request(snapshot("snap-fallback-secure", [
    secureInput(),
  ]));
  const secureFallback = await generateStructuredAction(
    secureRequest,
    async () => ({
      model: "offline-test",
      source: "FALLBACK",
      text: "",
    }),
  );
  assert.equal(secureFallback.status, "SECURE_INPUT_REQUIRED");
  assert.equal(secureFallback.action, "PAUSE_FOR_SECURE_INPUT");
  assert.equal(secureFallback.inputValue, null);
});

test("guidance messages are TTS-safe and suppress completion, recommendation, and technical disclosure", () => {
  for (const message of Object.values(DEPOSIT_GUIDANCE)) {
    assert.equal(message.includes("\n"), false);
    assert.ok(message.length >= 15 && message.length <= 40);
    assert.equal(message.match(/[.!?]/g)?.length, 1);
    assert.match(message, /\.$/);
    assert.doesNotMatch(message, /하고|한 뒤|다음 단계/);
    assert.doesNotMatch(
      message,
      /elementId|selector|raw dom|추천 상품|자동 선택|가입 완료|인증 성공/i,
    );
  }

  for (const unsafe of [
    "가입이 완료되었습니다.",
    "인증 성공 결과입니다.",
    "추천 상품을 자동 선택합니다.",
    "elementId el-secret selector #password",
  ]) {
    assert.equal(
      sanitizeInternalMessage(unsafe),
      SAFE_INTERNAL_MESSAGE,
    );
  }
});

function demoElementId(
  token: string,
  sequence: number,
): string {
  return `el-${token}-${String(sequence).padStart(3, "0")}`;
}

function demoNavigation(
  token: string,
): BackendSanitizedDomElement[] {
  return [
    element(demoElementId(token, 1), "메인", {
      tag: "a",
      role: "link",
    }),
    element(demoElementId(token, 2), "예금 상품", {
      tag: "a",
      role: "link",
    }),
    element(demoElementId(token, 3), "출금 계좌", {
      tag: "a",
      role: "link",
    }),
  ];
}

function demoSnapshot(
  token: string,
  path: string,
  elements: BackendSanitizedDomElement[],
  pageOverrides: Partial<
    BackendSanitizedDomSnapshot["page"]
  > = {},
): BackendSanitizedDomSnapshot {
  return snapshot(
    `snap-${token}`,
    [...demoNavigation(token), ...elements],
    `http://127.0.0.1:5190${path}`,
    pageOverrides,
  );
}

function demoTerms(
  token: string,
  checked: readonly [boolean, boolean, boolean],
): BackendSanitizedDomElement[] {
  return [
    termChoice(
      demoElementId(token, 4),
      "필수 서비스 이용약관 데모 예금 서비스 이용 조건을 안내하는 Mock 약관입니다.",
      checked[0],
    ),
    termChoice(
      demoElementId(token, 5),
      "필수 개인정보 수집·이용 데모 흐름에 필요한 개인정보 처리 범위를 안내합니다.",
      checked[1],
    ),
    termChoice(
      demoElementId(token, 6),
      "선택 마케팅 정보 수신 데모 상품과 혜택 안내 수신 여부를 선택하는 항목입니다.",
      checked[2],
    ),
  ];
}

test("POST /api/ai/action follows the real Demo sanitized DOM through secure pause", async () => {
  const app = express();
  app.use(express.json());
  app.use(
    "/api/ai",
    createAiActionRouter((input) =>
      generateStructuredAction(
        input,
        async () => {
          const candidates: Record<
            string,
            StructuredAIResponse
          > = {
            "snap-prod0001": response({
              action: "CLICK",
              targetElementId: "el-prod0001-004",
            }),
            "snap-prod0002": response({
              action: "CLICK",
              targetElementId: "el-prod0001-004",
            }),
            "snap-detail01": response({
              action: "CLICK",
              targetElementId: "el-detail01-005",
            }),
            "snap-amount01": response({
              action: "TYPE",
              targetElementId: "el-amount01-004",
              inputValue: "1",
            }),
            "snap-amount02": response({
              action: "TYPE",
              targetElementId: "el-amount02-004",
              inputValue: "1",
            }),
            "snap-amount03": response({
              action: "TYPE",
              targetElementId: "el-amount03-004",
              inputValue: "1",
            }),
            "snap-terms001": response({
              action: "CLICK",
              targetElementId: "el-terms001-004",
            }),
            "snap-terms002": response({
              action: "CLICK",
              targetElementId: "el-terms001-004",
            }),
            "snap-terms003": response({
              action: "CLICK",
              targetElementId: "el-terms003-004",
            }),
            "snap-secure01": response({
              action: "TYPE",
              targetElementId: "el-secure01-004",
              inputValue: "synthetic-ignored",
            }),
          };
          const candidate = candidates[
            input.domSnapshot.snapshotId
          ];
          assert.ok(candidate);
          return {
            model: "offline-test",
            source: "GEMINI" as const,
            text: JSON.stringify({
              ...candidate,
              requestId: "untrusted-model-id",
            }),
          };
        },
      )),
  );

  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const address = server.address() as AddressInfo;
    const endpoint =
      `http://127.0.0.1:${address.port}/api/ai/action`;
    const post = async (
      currentSnapshot: BackendSanitizedDomSnapshot,
      userDecision?: BackendAiUserDecisionContext,
    ) => {
      const result = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          userRequest:
            "100만 원으로 정기예금 가입 절차를 시작해 주세요.",
          snapshot: currentSnapshot,
          ...(userDecision
            ? { userDecision }
            : {}),
        }),
      });
      assert.equal(result.status, 200);
      return result.json() as Promise<
        Record<string, unknown>
      >;
    };

    const products = await post(demoSnapshot(
      "prod0001",
      "/deposit/products",
      [
        productChoice(
          demoElementId("prod0001", 4),
          "12개월 정기예금",
        ),
        productChoice(
          demoElementId("prod0001", 5),
          "우대금리 정기예금",
        ),
        element(
          demoElementId("prod0001", 6),
          "상품 선택 후 다음",
          { enabled: false },
        ),
      ],
    ));
    assert.deepEqual(Object.keys(products), RESPONSE_FIELDS);
    assert.equal(products.actionType, "WAIT_FOR_USER");
    assert.equal(products.decisionType, "PRODUCT_SELECTION");
    assert.equal(products.sourceSnapshotId, "snap-prod0001");
    assert.deepEqual(products.options, [
      {
        id: "el-prod0001-004",
        label: "12개월 정기예금 선택",
        required: false,
        checked: null,
      },
      {
        id: "el-prod0001-005",
        label: "우대금리 정기예금 선택",
        required: false,
        checked: null,
      },
    ]);
    assert.equal(products.elementId, null);

    const selectedProductNext = await post(demoSnapshot(
      "prod0002",
      "/deposit/products",
      [
        productChoice(
          demoElementId("prod0002", 4),
          "12개월 정기예금",
        ),
        productChoice(
          demoElementId("prod0002", 5),
          "우대금리 정기예금",
        ),
        element(
          demoElementId("prod0002", 6),
          DEPOSIT_DEMO_BUTTON_LABELS.productNext,
        ),
      ],
    ), {
      decisionId: "dec-route-product",
      decisionType: "PRODUCT_SELECTION",
      selectedOptionIds: ["el-prod0001-004"],
      sourceSnapshotId: "snap-prod0001",
    });
    assert.equal(selectedProductNext.actionType, "CLICK");
    assert.equal(selectedProductNext.elementId, "el-prod0002-006");
    assert.notEqual(selectedProductNext.elementId, "el-prod0001-004");

    const detail = await post(demoSnapshot(
      "detail01",
      "/deposit/products/deposit-12m",
      [
        element(demoElementId("detail01", 4), "예금 상품 목록으로 돌아가기"),
        element(
          demoElementId("detail01", 5),
          DEPOSIT_DEMO_BUTTON_LABELS.amountStart,
        ),
      ],
      {
        productId: "deposit-12m",
        productName: "12개월 정기예금",
        productPeriod: "12개월",
      },
    ));
    assert.equal(detail.actionType, "CLICK");
    assert.equal(detail.elementId, "el-detail01-005");

    const amount = await post(demoSnapshot(
      "amount01",
      "/deposit/conditions/deposit-12m",
      [
        element(demoElementId("amount01", 4), "가입 금액", {
          tag: "input",
          role: "textbox",
          inputType: "text",
        }),
        element(demoElementId("amount01", 5), "상품 상세로 돌아가기"),
        element(
          demoElementId("amount01", 6),
          DEPOSIT_DEMO_BUTTON_LABELS.amountConfirm,
          { enabled: false },
        ),
        element(
          demoElementId("amount01", 7),
          DEPOSIT_DEMO_BUTTON_LABELS.termsStart,
          { enabled: false },
        ),
      ],
    ));
    assert.equal(amount.actionType, "TYPE");
    assert.equal(amount.value, "1000000");
    assert.equal(amount.elementId, "el-amount01-004");

    const amountConfirm = await post(demoSnapshot(
      "amount02",
      "/deposit/conditions/deposit-12m",
      [
        element(demoElementId("amount02", 4), "가입 금액", {
          tag: "input",
          role: "textbox",
          inputType: "text",
        }),
        element(demoElementId("amount02", 5), "상품 상세로 돌아가기"),
        element(
          demoElementId("amount02", 6),
          DEPOSIT_DEMO_BUTTON_LABELS.amountConfirm,
        ),
        element(
          demoElementId("amount02", 7),
          DEPOSIT_DEMO_BUTTON_LABELS.termsStart,
          { enabled: false },
        ),
      ],
    ));
    assert.equal(amountConfirm.actionType, "CLICK");
    assert.equal(amountConfirm.elementId, "el-amount02-006");
    assert.equal(amountConfirm.value, null);

    const termsStart = await post(demoSnapshot(
      "amount03",
      "/deposit/conditions/deposit-12m",
      [
        element(demoElementId("amount03", 4), "가입 금액", {
          tag: "input",
          role: "textbox",
          inputType: "text",
        }),
        element(demoElementId("amount03", 5), "상품 상세로 돌아가기"),
        element(
          demoElementId("amount03", 6),
          DEPOSIT_DEMO_BUTTON_LABELS.amountConfirm,
        ),
        element(
          demoElementId("amount03", 7),
          DEPOSIT_DEMO_BUTTON_LABELS.termsStart,
        ),
      ],
    ));
    assert.equal(termsStart.actionType, "CLICK");
    assert.equal(termsStart.elementId, "el-amount03-007");
    assert.equal(termsStart.value, null);

    const terms = await post(demoSnapshot(
      "terms001",
      "/deposit/terms/deposit-12m",
      [
        ...demoTerms("terms001", [false, false, false]),
        element(demoElementId("terms001", 7), "가입 금액 입력으로 돌아가기"),
        element(
          demoElementId("terms001", 8),
          DEPOSIT_DEMO_BUTTON_LABELS.termsConfirm,
          { enabled: false },
        ),
        element(
          demoElementId("terms001", 9),
          DEPOSIT_DEMO_BUTTON_LABELS.passwordStart,
          { enabled: false },
        ),
      ],
    ));
    assert.equal(terms.actionType, "WAIT_FOR_USER");
    assert.equal(terms.decisionType, "TERMS_AGREEMENT");
    assert.deepEqual(
      (terms.terms as Array<{ id: string; checked: boolean }>).map(
        (term) => ({ id: term.id, checked: term.checked }),
      ),
      [
        { id: "el-terms001-004", checked: false },
        { id: "el-terms001-005", checked: false },
        { id: "el-terms001-006", checked: false },
      ],
    );

    const termsConfirm = await post(demoSnapshot(
      "terms002",
      "/deposit/terms/deposit-12m",
      [
        ...demoTerms("terms002", [true, true, false]),
        element(demoElementId("terms002", 7), "가입 금액 입력으로 돌아가기"),
        element(
          demoElementId("terms002", 8),
          DEPOSIT_DEMO_BUTTON_LABELS.termsConfirm,
        ),
        element(
          demoElementId("terms002", 9),
          DEPOSIT_DEMO_BUTTON_LABELS.passwordStart,
          { enabled: false },
        ),
      ],
    ), {
      decisionId: "dec-route-terms",
      decisionType: "TERMS_AGREEMENT",
      selectedOptionIds: [
        "el-terms001-004",
        "el-terms001-005",
      ],
      sourceSnapshotId: "snap-terms001",
    });
    assert.equal(termsConfirm.actionType, "CLICK");
    assert.equal(termsConfirm.elementId, "el-terms002-008");
    assert.equal(termsConfirm.decisionType, null);

    const passwordStart = await post(demoSnapshot(
      "terms003",
      "/deposit/terms/deposit-12m",
      [
        ...demoTerms("terms003", [true, true, false]),
        element(demoElementId("terms003", 7), "가입 금액 입력으로 돌아가기"),
        element(
          demoElementId("terms003", 8),
          DEPOSIT_DEMO_BUTTON_LABELS.termsConfirm,
        ),
        element(
          demoElementId("terms003", 9),
          DEPOSIT_DEMO_BUTTON_LABELS.passwordStart,
        ),
      ],
    ));
    assert.equal(passwordStart.actionType, "CLICK");
    assert.equal(passwordStart.elementId, "el-terms003-009");
    assert.equal(passwordStart.decisionType, null);

    const secure = await post(demoSnapshot(
      "secure01",
      "/deposit/secure/password/deposit-12m",
      [
        element(demoElementId("secure01", 4), "계좌 비밀번호", {
          tag: "input",
          role: "textbox",
          inputType: "password",
          securityPolicy: "SECURE_INPUT",
        }),
        element(demoElementId("secure01", 5), "약관 화면으로 돌아가기"),
        element(demoElementId("secure01", 6), "입력 완료", {
          enabled: false,
        }),
        element(demoElementId("secure01", 7), "데모 흐름 나가기"),
      ],
    ));
    assert.deepEqual(Object.keys(secure), RESPONSE_FIELDS);
    assert.equal(secure.actionType, "PAUSE_FOR_SECURE_INPUT");
    assert.equal(secure.status, "SECURE_INPUT_REQUIRED");
    assert.equal(secure.executionBlocked, true);
    assert.equal(secure.elementId, null);
    assert.equal(secure.value, null);
    assert.deepEqual(secure.options, []);
    assert.deepEqual(secure.terms, []);
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("POST /api/ai/action applies the selected-product period contract for the preferred product", async () => {
  const app = express();
  app.use(express.json());
  app.use(
    "/api/ai",
    createAiActionRouter((input) =>
      generateStructuredAction(
        input,
        async () => {
          const targetBySnapshot: Record<string, string | null> = {
            "snap-prefprod1": null,
            "snap-prefprod2": "el-prefprod1-005",
            "snap-prefdetail": "el-prefdetail-005",
            "snap-prefamount1": "el-prefamount1-004",
            "snap-prefamount2": "el-prefamount2-004",
            "snap-prefamount3": "el-prefamount3-004",
            "snap-prefmatch": "el-prefmatch-005",
            "snap-prefconflict": "el-prefconflict-005",
          };
          assert.ok(
            input.domSnapshot.snapshotId in targetBySnapshot,
          );
          const target = targetBySnapshot[
            input.domSnapshot.snapshotId
          ];
          const candidate = target?.endsWith("-004")
            ? response({
                action: "TYPE",
                targetElementId: target,
                inputValue: "1",
              })
            : response({
                action: target ? "CLICK" : "NONE",
                targetElementId: target,
              });
          return {
            model: "offline-test",
            source: "GEMINI" as const,
            text: JSON.stringify(candidate),
          };
        },
      )),
  );

  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const address = server.address() as AddressInfo;
    const endpoint =
      `http://127.0.0.1:${address.port}/api/ai/action`;
    const post = async (
      userRequest: string,
      currentSnapshot: BackendSanitizedDomSnapshot,
      userDecision?: BackendAiUserDecisionContext,
    ) => {
      const result = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userRequest,
          snapshot: currentSnapshot,
          ...(userDecision ? { userDecision } : {}),
        }),
      });
      assert.equal(result.status, 200);
      return result.json() as Promise<Record<string, unknown>>;
    };
    const amountOnly =
      "100만 원으로 정기예금 가입 절차를 시작해 주세요.";

    const products = await post(amountOnly, demoSnapshot(
      "prefprod1",
      "/deposit/products",
      [
        productChoice(
          demoElementId("prefprod1", 4),
          "12개월 정기예금",
        ),
        productChoice(
          demoElementId("prefprod1", 5),
          "우대금리 정기예금",
        ),
        element(
          demoElementId("prefprod1", 6),
          "상품 선택 후 다음",
          { enabled: false },
        ),
      ],
    ));
    assert.equal(products.actionType, "WAIT_FOR_USER");
    assert.equal(products.decisionType, "PRODUCT_SELECTION");

    const productNext = await post(amountOnly, demoSnapshot(
      "prefprod2",
      "/deposit/products",
      [
        productChoice(
          demoElementId("prefprod2", 4),
          "12개월 정기예금",
        ),
        productChoice(
          demoElementId("prefprod2", 5),
          "우대금리 정기예금",
        ),
        element(
          demoElementId("prefprod2", 6),
          DEPOSIT_DEMO_BUTTON_LABELS.productNext,
        ),
      ],
    ), {
      decisionId: "dec-preferred-product",
      decisionType: "PRODUCT_SELECTION",
      selectedOptionIds: ["el-prefprod1-005"],
      sourceSnapshotId: "snap-prefprod1",
    });
    assert.equal(productNext.actionType, "CLICK");
    assert.equal(productNext.elementId, "el-prefprod2-006");
    assert.notEqual(productNext.elementId, "el-prefprod1-005");

    const detailElements = (token: string) => [
      element(demoElementId(token, 4), "예금 상품 목록으로 돌아가기"),
      element(
        demoElementId(token, 5),
        DEPOSIT_DEMO_BUTTON_LABELS.amountStart,
      ),
    ];
    const preferredPage = {
      productId: "deposit-preferred",
      productName: "우대금리 정기예금",
      productPeriod: "12개월",
    } as const;

    const detail = await post(amountOnly, demoSnapshot(
      "prefdetail",
      "/deposit/products/deposit-preferred",
      detailElements("prefdetail"),
      preferredPage,
    ));
    assert.equal(detail.actionType, "CLICK");
    assert.equal(detail.elementId, "el-prefdetail-005");

    const amountElements = (
      token: string,
      confirmEnabled: boolean,
      termsEnabled: boolean,
    ) => [
      element(demoElementId(token, 4), "가입 금액", {
        tag: "input",
        role: "textbox",
        inputType: "text",
      }),
      element(demoElementId(token, 5), "상품 상세로 돌아가기"),
      element(
        demoElementId(token, 6),
        DEPOSIT_DEMO_BUTTON_LABELS.amountConfirm,
        { enabled: confirmEnabled },
      ),
      element(
        demoElementId(token, 7),
        DEPOSIT_DEMO_BUTTON_LABELS.termsStart,
        { enabled: termsEnabled },
      ),
    ];

    const amount = await post(amountOnly, demoSnapshot(
      "prefamount1",
      "/deposit/conditions/deposit-preferred",
      amountElements("prefamount1", false, false),
    ));
    assert.equal(amount.actionType, "TYPE");
    assert.equal(amount.elementId, "el-prefamount1-004");
    assert.equal(amount.value, "1000000");

    const amountConfirm = await post(amountOnly, demoSnapshot(
      "prefamount2",
      "/deposit/conditions/deposit-preferred",
      amountElements("prefamount2", true, false),
    ));
    assert.equal(amountConfirm.actionType, "CLICK");
    assert.equal(amountConfirm.elementId, "el-prefamount2-006");
    assert.equal(amountConfirm.value, null);

    const termsStart = await post(amountOnly, demoSnapshot(
      "prefamount3",
      "/deposit/conditions/deposit-preferred",
      amountElements("prefamount3", true, true),
    ));
    assert.equal(termsStart.actionType, "CLICK");
    assert.equal(termsStart.elementId, "el-prefamount3-007");
    assert.equal(termsStart.value, null);

    const matched = await post(
      "12개월 정기예금에 100만 원 가입하고 싶어요.",
      demoSnapshot(
        "prefmatch",
        "/deposit/products/deposit-preferred",
        detailElements("prefmatch"),
        preferredPage,
      ),
    );
    assert.equal(matched.actionType, "CLICK");
    assert.equal(matched.elementId, "el-prefmatch-005");

    const conflict = await post(
      "6개월 정기예금에 100만 원 가입하고 싶어요.",
      demoSnapshot(
        "prefconflict",
        "/deposit/products/deposit-preferred",
        detailElements("prefconflict"),
        preferredPage,
      ),
    );
    assert.deepEqual(Object.keys(conflict), RESPONSE_FIELDS);
    assert.equal(conflict.actionType, "NONE");
    assert.equal(conflict.status, "AI_EXECUTING");
    assert.equal(conflict.message, DEPOSIT_GUIDANCE.periodMismatch);
    assert.equal(conflict.requiresUserAction, true);
    assert.equal(conflict.executionBlocked, true);
    assert.equal(conflict.elementId, null);
    assert.equal(conflict.value, null);
    assert.equal(conflict.decisionType, null);
    assert.deepEqual(conflict.options, []);
    assert.deepEqual(conflict.terms, []);
  } finally {
    server.close();
    await once(server, "close");
  }
});
