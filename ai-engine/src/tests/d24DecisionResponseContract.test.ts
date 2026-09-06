import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";

import express from "express";

import {
  createAiActionRouter,
} from "../api/aiAction.route.js";
import {
  adaptStructuredResponseToBackend,
} from "../api/aiDecisionResponse.adapter.js";
import type {
  AiActionRequest,
  BackendSanitizedDomElement,
  BackendSanitizedDomSnapshot,
} from "../api/aiRequest.types.js";
import type {
  StructuredAIResponse,
} from "../output/aiResponse.types.js";
import {
  validateStructuredAIResponse,
} from "../output/aiResponse.validator.js";
import {
  enforceUserDecisionPolicy,
} from "../policy/userDecision.policy.js";
import type {
  ProductionDecisionResponseType,
} from "../workflow/userDecision.types.js";

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
];

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
    securityPolicy: "USER_DECISION",
    ...overrides,
  };
}

function snapshot(
  snapshotId: string,
  elements: BackendSanitizedDomElement[],
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

function request(
  domSnapshot: BackendSanitizedDomSnapshot,
): AiActionRequest {
  return {
    requestId: "req-d24-rich",
    userGoal: {
      rawMessage: "사용자가 직접 선택합니다.",
      intent: "USER_DECISION",
      conditions: [],
    },
    domSnapshot,
  };
}

function response(
  overrides: Partial<StructuredAIResponse> = {},
): StructuredAIResponse {
  return {
    requestId: "req-d24-rich",
    status: "USER_DECISION_REQUIRED",
    action: "WAIT_FOR_USER",
    targetElementId: null,
    inputValue: null,
    message: "사용자가 항목을 선택해야 합니다.",
    confidence: 1,
    requiresUserAction: true,
    decisionType: "PRODUCT_SELECTION",
    secureInputType: null,
    riskType: null,
    options: [
      {
        id: "el-choice-1",
        label: "untrusted model label",
      },
    ],
    confirmationId: null,
    summary: null,
    ...overrides,
  };
}

test("all supported Backend response DecisionTypes map to exact options or terms", () => {
  const cases: Array<{
    decisionType: ProductionDecisionResponseType;
    expectedField: "options" | "terms";
  }> = [
    {
      decisionType: "PRODUCT_SELECTION",
      expectedField: "options",
    },
    {
      decisionType: "SOURCE_ACCOUNT_SELECTION",
      expectedField: "options",
    },
    {
      decisionType: "RECIPIENT_SELECTION",
      expectedField: "options",
    },
    {
      decisionType: "TERMS_AGREEMENT",
      expectedField: "terms",
    },
  ];

  for (const { decisionType, expectedField } of cases) {
    const choice = element(
      "el-choice-1",
      decisionType === "TERMS_AGREEMENT"
        ? "[필수] 개인정보 이용약관"
        : "Snapshot authoritative label",
      decisionType === "TERMS_AGREEMENT"
        ? {
            inputType: "checkbox",
            checked: false,
          }
        : {},
    );
    const canonical = enforceUserDecisionPolicy(
      response({ decisionType }),
      request(snapshot("snap-rich", [choice])),
    );
    const wire = adaptStructuredResponseToBackend(
      canonical,
      "snap-rich",
    );
    const expectedItems = wire[expectedField];
    const otherItems =
      expectedField === "options"
        ? wire.terms
        : wire.options;

    assert.deepEqual(Object.keys(wire), RESPONSE_FIELDS);
    assert.equal(wire.actionType, "WAIT_FOR_USER");
    assert.equal(wire.elementId, null);
    assert.equal(wire.value, null);
    assert.equal(wire.scrollX, null);
    assert.equal(wire.scrollY, null);
    assert.equal(wire.waitMillis, null);
    assert.equal(wire.status, "USER_DECISION_REQUIRED");
    assert.equal(wire.requiresUserAction, true);
    assert.equal(wire.executionBlocked, true);
    assert.equal(wire.decisionType, decisionType);
    assert.equal(wire.sourceSnapshotId, "snap-rich");
    assert.equal(expectedItems.length, 1);
    assert.deepEqual(otherItems, []);
    assert.deepEqual(
      Object.keys(expectedItems[0] ?? {}),
      ["id", "label", "required", "checked"],
    );
    assert.equal(expectedItems[0]?.id, "el-choice-1");
    assert.notEqual(
      expectedItems[0]?.label,
      "untrusted model label",
    );
    assert.equal(
      expectedItems[0]?.required,
      decisionType === "TERMS_AGREEMENT",
    );
    assert.equal(
      expectedItems[0]?.checked,
      decisionType === "TERMS_AGREEMENT"
        ? false
        : null,
    );
    assert.equal("decisionId" in wire, false);
    assert.equal("description" in (expectedItems[0] ?? {}), false);
    assert.equal("disabled" in (expectedItems[0] ?? {}), false);
  }
});

test("ADDITIONAL_INFORMATION and ACCOUNT_SELECTION are rejected for C-to-B decisions", () => {
  for (const decisionType of [
    "ADDITIONAL_INFORMATION",
    "ACCOUNT_SELECTION",
  ]) {
    const candidate = response({
      decisionType: decisionType as never,
    });

    assert.equal(
      validateStructuredAIResponse(candidate).valid,
      false,
    );
    assert.throws(() =>
      enforceUserDecisionPolicy(
        candidate,
        request(snapshot("snap-rejected", [
          element("el-choice-1", "선택"),
        ])),
      ),
    );
  }
});

test("TERMS_AGREEMENT checked is copied from the current snapshot and is never guessed", () => {
  const currentSnapshot = snapshot("snap-checked", [
    element("el-term", "[필수] 약관", {
      inputType: "checkbox",
      checked: true,
    }),
  ]);
  const canonical = enforceUserDecisionPolicy(
    response({
      decisionType: "TERMS_AGREEMENT",
      options: [
        {
          id: "el-term",
          label: "untrusted",
          required: false,
          checked: false,
        },
      ],
    }),
    request(currentSnapshot),
  );
  const wire = adaptStructuredResponseToBackend(
    canonical,
    currentSnapshot.snapshotId,
  );

  assert.equal(wire.terms[0]?.required, true);
  assert.equal(wire.terms[0]?.checked, true);

  assert.throws(
    () => enforceUserDecisionPolicy(
      response({
        decisionType: "TERMS_AGREEMENT",
        options: [
          {
            id: "el-term",
            label: "untrusted",
            required: false,
          },
        ],
      }),
      request(snapshot("snap-no-checked", [
        element("el-term", "[필수] 약관", {
          inputType: "checkbox",
          checked: null,
        }),
      ])),
    ),
    /checked state is unavailable/,
  );
});

test("decision option IDs preserve order and require safe current snapshot membership", () => {
  const first = element(
    "el-choice-a",
    "첫 번째 선택",
  );
  const second = element(
    "el-choice-b",
    "두 번째 선택",
  );
  const currentRequest = request(
    snapshot("snap-membership", [first, second]),
  );
  const ordered = enforceUserDecisionPolicy(
    response({
      options: [
        { id: second.elementId, label: "model B" },
        { id: first.elementId, label: "model A" },
      ],
    }),
    currentRequest,
  );

  assert.deepEqual(
    ordered.options?.map((option) => option.id),
    [second.elementId, first.elementId],
  );
  assert.deepEqual(
    ordered.options?.map((option) => option.label),
    [second.text, first.text],
  );

  const invalidElements = [
    element("el-normal", "일반", {
      securityPolicy: "NORMAL",
    }),
    element("el-hidden", "숨김", {
      visible: false,
    }),
    element("el-disabled", "비활성", {
      enabled: false,
    }),
  ];

  for (const invalid of invalidElements) {
    assert.throws(() =>
      enforceUserDecisionPolicy(
        response({
          options: [
            {
              id: invalid.elementId,
              label: "model label",
            },
          ],
        }),
        request(snapshot("snap-invalid", [invalid])),
      ),
    );
  }

  assert.throws(
    () => enforceUserDecisionPolicy(
      response({
        options: [
          {
            id: "el-not-in-snapshot",
            label: "missing",
          },
        ],
      }),
      currentRequest,
    ),
    /current snapshot/,
  );

  assert.throws(
    () => enforceUserDecisionPolicy(
      response({
        options: [
          {
            id: "el-duplicate",
            label: "duplicate",
          },
        ],
      }),
      request(snapshot("snap-duplicate", [
        element("el-duplicate", "하나"),
        element("el-duplicate", "둘"),
      ])),
    ),
    /duplicate element ID/,
  );

  for (const invalidId of ["", " ", "el-choice-a "]) {
    assert.throws(
      () => enforceUserDecisionPolicy(
        response({
          options: [
            {
              id: invalidId,
              label: "invalid ID",
            },
          ],
        }),
        currentRequest,
      ),
      /non-blank exact ID/,
    );
  }
});

test("decision labels come from the sanitized snapshot and never expose sensitive content", () => {
  const canonical = enforceUserDecisionPolicy(
    response({
      options: [
        {
          id: "el-sensitive",
          label: "model says password=secret OTP 123456",
          description: "raw reasoning",
          disabled: true,
        },
      ],
    }),
    request(snapshot("snap-label", [
      element(
        "el-sensitive",
        "<b>계좌 123-456-789012</b>",
      ),
    ])),
  );
  const wire = adaptStructuredResponseToBackend(
    canonical,
    "snap-label",
  );
  const option = wire.options[0];

  assert.ok(option);
  assert.doesNotMatch(
    option.label,
    /secret|123456|123-456-789012|<b>|raw reasoning/i,
  );
  assert.deepEqual(
    Object.keys(option),
    ["id", "label", "required", "checked"],
  );
});

test("a resolved selection cannot be emitted as a new decision option", () => {
  const currentRequest = request(
    snapshot("snap-after-decision", [
      element("el-resolved", "이미 선택됨"),
    ]),
  );
  currentRequest.userDecisionContext = {
    decisionId: "dec-previous",
    decisionType: "PRODUCT_SELECTION",
    selectedOptionIds: ["el-resolved"],
    sourceSnapshotId: "snap-before-decision",
  };

  assert.throws(
    () => enforceUserDecisionPolicy(
      response({
        decisionType: "PRODUCT_SELECTION",
        options: [
          {
            id: "el-resolved",
            label: "model repeats selection",
          },
        ],
      }),
      currentRequest,
    ),
    /cannot be requested again/,
  );
});

test("Production schema requires complete WAIT_FOR_USER decision metadata", () => {
  assert.equal(
    validateStructuredAIResponse(
      response({
        decisionType: null,
        options: null,
      }),
    ).valid,
    false,
  );
  assert.equal(
    validateStructuredAIResponse(
      response({
        decisionType: "ADDITIONAL_INFORMATION",
      }),
    ).valid,
    false,
  );
  assert.equal(
    validateStructuredAIResponse(
      response({
        decisionType: "TERMS_AGREEMENT",
        options: [
          {
            id: "el-term",
            label: "필수 약관",
          } as never,
        ],
      }),
    ).valid,
    false,
  );
  assert.equal(
    validateStructuredAIResponse(
      response({
        decisionType: "PRODUCT_SELECTION",
        options: Array.from(
          { length: 21 },
          (_, index) => ({
            id: `el-${index}`,
            label: `선택 ${index}`,
          }),
        ),
      }),
    ).valid,
    false,
  );

  const executableDecision = response({
    action: "CLICK",
    targetElementId: "el-choice-1",
    decisionType: null,
    options: null,
  });
  assert.equal(
    validateStructuredAIResponse(
      executableDecision,
    ).valid,
    false,
  );
  assert.throws(() =>
    adaptStructuredResponseToBackend(
      executableDecision,
    ),
  );
});

test("POST /api/ai/action returns exact rich JSON and keeps resume request-scoped", async () => {
  let observedResume: AiActionRequest["userDecisionContext"];
  const app = express();
  app.use(express.json());
  app.use(
    "/api/ai",
    createAiActionRouter(async (input) => {
      if (input.userDecisionContext) {
        observedResume = input.userDecisionContext;
        return response({
          requestId: input.requestId,
          status: "AI_EXECUTING",
          action: "CLICK",
          targetElementId: "el-next",
          requiresUserAction: false,
          decisionType: null,
          options: null,
        });
      }

      const decisionType =
        input.userGoal.rawMessage.includes("약관")
          ? "TERMS_AGREEMENT"
          : input.userGoal.rawMessage.includes("출금")
            ? "SOURCE_ACCOUNT_SELECTION"
            : input.userGoal.rawMessage.includes("수취인")
              ? "RECIPIENT_SELECTION"
              : "PRODUCT_SELECTION";
      const candidate = input.domSnapshot.elements[0];
      assert.ok(candidate);

      return enforceUserDecisionPolicy(
        response({
          requestId: input.requestId,
          decisionType,
          options: [
            {
              id: candidate.elementId,
              label: "untrusted HTTP model label",
              ...(decisionType === "TERMS_AGREEMENT"
                ? { required: false }
                : {}),
            },
          ],
        }),
        input,
      );
    }),
  );

  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const address = server.address() as AddressInfo;
    const endpoint =
      `http://127.0.0.1:${address.port}/api/ai/action`;
    const post = async (body: unknown) => {
      const result = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
      assert.equal(result.status, 200);
      return result.json() as Promise<Record<string, unknown>>;
    };

    const product = await post({
      userRequest: "상품을 선택할게",
      snapshot: snapshot("snap-product", [
        element("el-product", "정기예금 12개월"),
      ]),
    });
    assert.deepEqual(Object.keys(product), RESPONSE_FIELDS);
    assert.equal(product.decisionType, "PRODUCT_SELECTION");
    assert.equal(product.sourceSnapshotId, "snap-product");
    assert.deepEqual(product.terms, []);
    assert.deepEqual(product.options, [
      {
        id: "el-product",
        label: "정기예금 12개월",
        required: false,
        checked: null,
      },
    ]);

    const sourceAccount = await post({
      userRequest: "출금 계좌를 선택할게",
      snapshot: snapshot("snap-source-account", [
        element("el-source-account", "생활비 계좌"),
      ]),
    });
    assert.equal(
      sourceAccount.decisionType,
      "SOURCE_ACCOUNT_SELECTION",
    );
    assert.equal(
      sourceAccount.sourceSnapshotId,
      "snap-source-account",
    );
    assert.deepEqual(sourceAccount.terms, []);

    const recipient = await post({
      userRequest: "수취인을 선택할게",
      snapshot: snapshot("snap-recipient", [
        element("el-recipient", "홍길동"),
      ]),
    });
    assert.equal(
      recipient.decisionType,
      "RECIPIENT_SELECTION",
    );
    assert.equal(
      recipient.sourceSnapshotId,
      "snap-recipient",
    );
    assert.deepEqual(recipient.terms, []);

    const terms = await post({
      userRequest: "약관을 선택할게",
      snapshot: snapshot("snap-terms", [
        element("el-required-term", "[필수] 서비스 이용약관", {
          inputType: "checkbox",
          checked: false,
        }),
      ]),
    });
    assert.equal(terms.decisionType, "TERMS_AGREEMENT");
    assert.equal(terms.sourceSnapshotId, "snap-terms");
    assert.deepEqual(terms.options, []);
    assert.deepEqual(terms.terms, [
      {
        id: "el-required-term",
        label: "[필수] 서비스 이용약관",
        required: true,
        checked: false,
      },
    ]);

    const resumed = await post({
      userRequest: "선택 결과로 계속 진행해줘",
      snapshot: snapshot("snap-after-selection", [
        element("el-next", "다음", {
          securityPolicy: "NORMAL",
        }),
      ]),
      userDecision: {
        decisionId: "dec-backend",
        decisionType: "PRODUCT_SELECTION",
        selectedOptionIds: ["el-product"],
        sourceSnapshotId: "snap-product",
      },
    });
    assert.equal(resumed.actionType, "CLICK");
    assert.equal(resumed.elementId, "el-next");
    assert.deepEqual(observedResume, {
      decisionId: "dec-backend",
      decisionType: "PRODUCT_SELECTION",
      selectedOptionIds: ["el-product"],
      sourceSnapshotId: "snap-product",
    });
  } finally {
    server.close();
    await once(server, "close");
  }
});
