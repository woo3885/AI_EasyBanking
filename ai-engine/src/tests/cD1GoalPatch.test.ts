import assert from "node:assert/strict";
import test from "node:test";

import type { ConversationUserGoal } from "../conversation/conversationAgent.types.js";
import {
  extractInitialGoalPatch,
  mergeGoalAnswer,
  normalizeKrwAmount,
} from "../conversation/userGoalPatch.extractor.js";

function goal(overrides: Partial<ConversationUserGoal> = {}): ConversationUserGoal {
  return {
    goalId: "goal-1", revision: 0, status: "ACTIVE", intent: "UNKNOWN",
    normalizedRequest: "", amount: null, duration: null, missingFields: [],
    pendingQuestion: null, stage: "COLLECTING_REQUIREMENTS",
    safety: { secureInputActive: false, riskState: "NONE", confirmationState: "NONE" },
    lastAppliedMessageId: null, ...overrides,
  };
}

test("C-D1-02 initial request extraction", () => {
  const first = extractInitialGoalPatch(goal(), "100만원으로 예금 가입해줘");
  assert.deepEqual(first, { kind: "PATCH", patch: {
    basedOnRevision: 0, intent: "DEPOSIT",
    amount: { value: "1000000", currency: "KRW" },
    missingFields: ["duration"], pendingQuestionFieldKey: "duration",
  } });

  const complete = extractInitialGoalPatch(goal(), "12개월 정기예금에 500만원");
  assert.equal(complete.kind, "PATCH");
  if (complete.kind === "PATCH") {
    assert.deepEqual(complete.patch.amount, { value: "5000000", currency: "KRW" });
    assert.deepEqual(complete.patch.duration, { value: 12, unit: "MONTH" });
  }

  const missing = extractInitialGoalPatch(goal(), "예금 가입하고 싶어");
  assert.equal(missing.kind, "PATCH");
  if (missing.kind === "PATCH") assert.deepEqual(missing.patch.missingFields, ["amount", "duration"]);

  assert.equal(normalizeKrwAmount("1천만원")?.value, "10000000");
  assert.equal(normalizeKrwAmount("1000000원")?.value, "1000000");
  assert.equal(normalizeKrwAmount("0원"), null);
  for (const [message, intent] of [
    ["계좌로 이체해줘", "TRANSFER"],
    ["예금 상품 알아보기", "INQUIRY"],
    ["기간을 변경해줘", "CHANGE"],
    ["도와줘", "UNKNOWN"],
  ] as const) {
    const result = extractInitialGoalPatch(goal(), message);
    assert.equal(result.kind === "PATCH" ? result.patch.intent : null, intent);
  }
});

test("C-D1-02 pending answer, ambiguity, conflict and cancel", () => {
  const pending = goal({
    intent: "DEPOSIT", amount: { value: "1000000", currency: "KRW" },
    missingFields: ["duration"],
    pendingQuestion: { questionId: "backend-question-id", fieldKey: "duration" },
  });
  const answered = mergeGoalAnswer(pending, "12개월");
  assert.equal(answered.kind, "PATCH");
  if (answered.kind === "PATCH") assert.deepEqual(answered.patch, {
    basedOnRevision: 0, duration: { value: 12, unit: "MONTH" },
    missingFields: [], pendingQuestionFieldKey: null,
  });
  assert.equal(mergeGoalAnswer(pending, "아무거나").kind, "AMBIGUOUS");

  const conflict = mergeGoalAnswer(goal({ duration: { value: 12, unit: "MONTH" } }), "6개월로 바꿀래");
  assert.equal(conflict.kind, "CONFLICT");
  assert.equal(extractInitialGoalPatch(goal(), "취소할게").kind, "CANCEL");
});

test("C-D1-02 credential input never enters a patch", () => {
  const result = extractInitialGoalPatch(goal(), "OTP 123456으로 처리해줘");
  assert.deepEqual(result, {
    kind: "SECURE_INPUT",
    message: "민감정보는 금융 화면에 직접 입력해 주세요.",
  });
  assert.equal(JSON.stringify(result).includes("123456"), false);
});
