import assert from "node:assert/strict";
import test from "node:test";

import type {
  AiActionRequest,
} from "../api/aiRequest.types.js";
import {
  generateStructuredAction,
} from "../services/structuredAction.service.js";

const request: AiActionRequest = {
  requestId: "req-generated-by-c",
  userGoal: {
    rawMessage: "예금 상품을 찾아줘",
    intent: "OPEN_DEPOSIT",
    conditions: [],
  },
  domSnapshot: {
    schemaVersion: "1.0",
    snapshotId: "snap-service-test",
    page: {
      url: "https://example.test/deposit",
      title: "예금 상품",
      productId: null,
      productName: null,
      productPeriod: null,
    },
    elements: [
      {
        elementId: "el-service-test-001",
        tag: "button",
        role: "button",
        text: "상품 보기",
        ariaLabel: null,
        placeholder: null,
        inputType: null,
        visible: true,
        enabled: true,
        checked: null,
        boundingBox: {
          x: 10,
          y: 20,
          width: 100,
          height: 40,
        },
        securityPolicy: "NORMAL",
      },
    ],
  },
};

function modelResponse(
  overrides: Record<string, unknown> = {},
): string {
  return JSON.stringify({
    requestId: "req-untrusted-model-echo",
    status: "AI_EXECUTING",
    action: "CLICK",
    targetElementId: "el-service-test-001",
    inputValue: null,
    message: "상품 보기 버튼을 선택합니다.",
    confidence: 1,
    requiresUserAction: false,
    decisionType: null,
    secureInputType: null,
    riskType: null,
    options: null,
    confirmationId: null,
    summary: null,
    ...overrides,
  });
}

test("structured service keeps the C-generated requestId", async () => {
  let generatedPrompt = "";

  const result = await generateStructuredAction(
    request,
    async ({ prompt }) => {
      generatedPrompt = prompt;
      return {
        model: "offline-test",
        text: modelResponse(),
        source: "GEMINI",
      };
    },
  );

  assert.match(generatedPrompt, /req-generated-by-c/);
  assert.equal(result.requestId, "req-generated-by-c");
  assert.equal(result.action, "CLICK");
});

test("structured service falls back when Production returns COMPLETED", async () => {
  const result = await generateStructuredAction(
    request,
    async () => ({
      model: "offline-test",
      text: modelResponse({
        status: "COMPLETED",
        action: "NONE",
        targetElementId: null,
      }),
      source: "GEMINI",
    }),
  );

  assert.equal(result.requestId, "req-generated-by-c");
  assert.equal(result.status, "ERROR");
  assert.equal(result.action, "NONE");
});
