import assert from "node:assert/strict";
import test from "node:test";

import type { AgentDecision, ConversationAgentRequest } from "../conversation/conversationAgent.types.js";
import {
  GeminiConversationContractError,
  GeminiConversationModel,
  type GeminiConversationTransport,
} from "../conversation/geminiConversation.model.js";
import { ScriptedConversationModel } from "../conversation/scriptedConversation.model.js";
import { ProductionConversationModel } from "../conversation/productionConversation.model.js";
import { C_D2_DEPOSIT_FIXTURES } from "./fixtures/cD2Deposit.fixtures.js";

function request(id: string): ConversationAgentRequest {
  const fixture = C_D2_DEPOSIT_FIXTURES.find((candidate) => candidate.id === id);
  if (!fixture) throw new Error(`Missing Day2 fixture ${id}`);
  return structuredClone(fixture.request);
}

function unknownInitial(content: string): ConversationAgentRequest {
  const input = request("03");
  input.snapshot = null;
  input.goal = {
    ...input.goal,
    intent: "UNKNOWN",
    normalizedRequest: content,
    amount: null,
    duration: null,
    missingFields: [],
    pendingQuestion: null,
    stage: "INFORMATION_COLLECTION",
    lastAppliedMessageId: null,
  };
  input.userMessage = { content, answerToQuestionId: null };
  return input;
}

async function scriptedDecision(id: string): Promise<{ request: ConversationAgentRequest; decision: AgentDecision }> {
  const input = request(id);
  return { request: input, decision: await new ScriptedConversationModel().decide(input) };
}

function adapter(output: unknown, observedPrompts: string[] = []): GeminiConversationModel {
  const transport: GeminiConversationTransport = async ({ prompt }) => {
    observedPrompts.push(prompt);
    return typeof output === "string" ? output : JSON.stringify(output);
  };
  return new GeminiConversationModel(transport);
}

async function rejectsContract(
  input: ConversationAgentRequest,
  output: unknown,
  code: GeminiConversationContractError["code"] = "INVALID_DECISION",
): Promise<void> {
  await assert.rejects(
    adapter(output).decide(input),
    (error: unknown) => error instanceof GeminiConversationContractError && error.code === code,
  );
}

test("C-D3-GEMINI-01 accepts a valid ConversationAgentRequest -> AgentDecision result without a key", async () => {
  const { request: input, decision } = await scriptedDecision("03");
  const prompts: string[] = [];
  const actual = await adapter(decision, prompts).decide(input);
  assert.deepEqual(actual, decision);
  assert.match(prompts[0] ?? "", /BEGIN_UNTRUSTED_DATA_JSON/u);
});

test("production binding replaces model-authored Backend authority fields", async () => {
  const { request: input, decision } = await scriptedDecision("03");
  const model = new GeminiConversationModel(async () => JSON.stringify({
    ...decision,
    requestId: "model-request",
    requestMessageId: "model-message",
    goalId: "model-goal",
    baseGoalRevision: 999,
  }), true);

  const actual = await model.decide(input);

  assert.equal(actual.requestId, input.requestId);
  assert.equal(actual.requestMessageId, input.requestMessageId);
  assert.equal(actual.goalId, input.goal.goalId);
  assert.equal(actual.baseGoalRevision, input.goal.revision);
});

test("production conversation uses the Gemini decision for flexible wording", async () => {
  const input = unknownInitial("목돈을 한동안 안전하게 굴리고 싶어요");
  const canonical = structuredClone(input);
  canonical.goal.normalizedRequest = "100만원으로 예금 가입해줘";
  canonical.userMessage.content = "100만원으로 예금 가입해줘";
  const expected = {
    ...await new ScriptedConversationModel().decide(canonical),
    message: "가입 기간을 개월 단위로 알려 주세요.",
  };
  const prompts: string[] = [];
  const model = new ProductionConversationModel(async ({ prompt }) => {
    prompts.push(prompt);
    return JSON.stringify({
      ...expected,
      mode: "NAVIGATION_REQUIRED",
      message: "예금 화면으로 이동합니다.",
      question: null,
      navigationCandidate: {
        decisionId: "model-invented-navigation",
        semanticRoute: "DEPOSIT_PRODUCTS",
        navigationMode: "SPA_PUSH",
      },
    });
  });

  assert.deepEqual(await model.decide(input), expected);
  assert.match(prompts[0] ?? "", /TRUSTED_RESPONSE_BINDINGS_JSON/u);
});

test("production conversation fails closed to the scripted model", async () => {
  const input = unknownInitial("알아들을 수 없는 자유 입력");
  const expected = await new ScriptedConversationModel().decide(input);
  const model = new ProductionConversationModel(async () => "not-json");

  assert.deepEqual(await model.decide(input), expected);
});

test("production conversation calls Gemini and canonicalizes a one-year follow-up", async () => {
  const input = request("03");
  input.snapshot = null;
  input.goal.intent = "DEPOSIT";
  input.goal.amount = { value: "1000000", currency: "KRW" };
  input.goal.duration = null;
  input.goal.missingFields = ["duration"];
  input.goal.pendingQuestion = { questionId: "question-year", fieldKey: "duration" };
  input.userMessage = { content: "1년", answerToQuestionId: "question-year" };
  const unsafeMonthDecision: AgentDecision = {
    requestId: input.requestId,
    requestMessageId: input.requestMessageId,
    goalId: input.goal.goalId,
    baseGoalRevision: input.goal.revision,
    mode: "GOAL_PATCH_PROPOSED",
    message: null,
    confidence: 1,
    reasonCode: "GOAL_UPDATED",
    nextCondition: "LATEST_DOM_DECISION",
    sourceSnapshotId: null,
    goalPatch: {
      basedOnRevision: input.goal.revision,
      duration: { value: 1, unit: "MONTH" },
      missingFields: [],
      pendingQuestionFieldKey: null,
    },
    question: null,
    actionCandidate: null,
    navigationCandidate: null,
  };
  let calls = 0;
  const model = new ProductionConversationModel(async () => {
    calls += 1;
    return JSON.stringify(unsafeMonthDecision);
  });

  const actual = await model.decide(input);

  assert.equal(calls, 1);
  assert.deepEqual(actual.goalPatch?.duration, { value: 12, unit: "MONTH" });
});

test("C-D3-GEMINI-02 rejects an unknown mode", async () => {
  const { request: input, decision } = await scriptedDecision("03");
  await rejectsContract(input, { ...decision, mode: "ROOT_OVERRIDE" });
});

test("C-D3-GEMINI-03 rejects an invalid action candidate shape", async () => {
  const { request: input, decision } = await scriptedDecision("03");
  await rejectsContract(input, {
    ...decision,
    actionCandidate: { ...decision.actionCandidate!, selector: "#password" },
  });
});

test("C-D3-GEMINI-04 rejects secure-screen AUTO_EXECUTE", async () => {
  const { request: input, decision } = await scriptedDecision("08");
  await rejectsContract(input, {
    ...decision,
    mode: "AUTO_EXECUTE",
    message: "다음 단계를 진행합니다.",
    reasonCode: "MODEL_AUTO",
    actionCandidate: {
      actionType: "TYPE",
      targetElementId: "el-password",
      role: "textbox",
      accessibleLabel: "계좌 비밀번호",
      guide: "다음 단계를 진행합니다.",
    },
  });
});

test("C-D3-GEMINI-05 rejects final-confirmation CLICK", async () => {
  const { request: input, decision } = await scriptedDecision("10");
  await rejectsContract(input, {
    ...decision,
    mode: "AUTO_EXECUTE",
    message: "다음 단계를 진행합니다.",
    reasonCode: "MODEL_AUTO",
    actionCandidate: {
      actionType: "CLICK",
      targetElementId: "el-final-approve",
      role: "button",
      accessibleLabel: "Demo 예금 최종 승인",
      guide: "다음 단계를 진행합니다.",
    },
  });
});

test("C-D3-GEMINI-06 rejects a stale sourceSnapshotId", async () => {
  const { request: input, decision } = await scriptedDecision("03");
  await rejectsContract(input, { ...decision, sourceSnapshotId: "snap-old" });
});

test("C-D3-GEMINI-07 rejects raw credential echo", async () => {
  const { request: input, decision } = await scriptedDecision("03");
  await rejectsContract(input, { ...decision, message: "OTP 123456" });
});

test("C-D3-GEMINI-08 rejects invalid JSON", async () => {
  await rejectsContract(request("03"), "```json not-json ```", "INVALID_JSON");
});

test("C-GUIDE-GEMINI-09 rejects GUIDE_USER without an internal target reference", async () => {
  const { request: input, decision } = await scriptedDecision("04");
  await rejectsContract(input, {
    ...decision,
    actionCandidate: { actionType: "WAIT_FOR_USER" },
  });
});

test("C-GUIDE-GEMINI-10 rejects GUIDE_USER with a raw selector", async () => {
  const { request: input, decision } = await scriptedDecision("04");
  await rejectsContract(input, {
    ...decision,
    actionCandidate: { ...decision.actionCandidate!, XPath: "//button" },
  });
});

test("C-GUIDE-GEMINI-11 rejects GUIDE_USER on a secure target", async () => {
  const { request: input, decision } = await scriptedDecision("08");
  await rejectsContract(input, {
    ...decision,
    mode: "GUIDE_USER",
    message: "필요한 항목을 직접 선택해 주세요.",
    reasonCode: "MODEL_GUIDE",
    actionCandidate: {
      actionType: "WAIT_FOR_USER",
      targetElementId: "el-password",
      role: "textbox",
      accessibleLabel: "계좌 비밀번호",
      guide: "필요한 항목을 직접 선택해 주세요.",
    },
  });
});

test("C-GUIDE-GEMINI-12 rejects GUIDE_USER while risk policy is active", async () => {
  const { request: input, decision } = await scriptedDecision("09");
  const target = input.snapshot!.sanitizedDomSnapshot.elements[0]!;
  target.role = "button";
  target.enabled = true;
  target.securityPolicy = "USER_DECISION";
  await rejectsContract(input, {
    ...decision,
    mode: "GUIDE_USER",
    message: "필요한 항목을 직접 선택해 주세요.",
    reasonCode: "MODEL_GUIDE",
    actionCandidate: {
      actionType: "WAIT_FOR_USER",
      targetElementId: target.elementId,
      role: "button",
      accessibleLabel: "보이스피싱 의심 거래 안내",
      guide: "필요한 항목을 직접 선택해 주세요.",
    },
  });
});

test("C-GUIDE-GEMINI-13 rejects GUIDE_USER on a final target", async () => {
  const { request: input, decision } = await scriptedDecision("10");
  await rejectsContract(input, {
    ...decision,
    mode: "GUIDE_USER",
    message: "필요한 항목을 직접 선택해 주세요.",
    reasonCode: "MODEL_GUIDE",
    actionCandidate: {
      actionType: "WAIT_FOR_USER",
      targetElementId: "el-final-approve",
      role: "button",
      accessibleLabel: "Demo 예금 최종 승인",
      guide: "필요한 항목을 직접 선택해 주세요.",
    },
  });
});

test("C-GUIDE-GEMINI-14 rejects AUTO_EXECUTE without sourceSnapshotId", async () => {
  const { request: input, decision } = await scriptedDecision("03");
  await rejectsContract(input, { ...decision, sourceSnapshotId: null });
});

test("C-GUIDE-GEMINI-15 rejects nonexistent and duplicate internal references", async () => {
  const { request: input, decision } = await scriptedDecision("04");
  await rejectsContract(input, {
    ...decision,
    actionCandidate: { ...decision.actionCandidate!, targetElementId: "el-missing" },
  });

  const duplicateInput = structuredClone(input);
  duplicateInput.snapshot!.sanitizedDomSnapshot.elements.push({
    ...duplicateInput.snapshot!.sanitizedDomSnapshot.elements[0]!,
  });
  await rejectsContract(duplicateInput, decision);
});
