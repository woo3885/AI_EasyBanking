import assert from "node:assert/strict";
import test from "node:test";

import type { ConversationAgentRequest } from "../conversation/conversationAgent.types.js";
import { validateAgentDecision } from "../conversation/conversationAgent.validator.js";
import {
  ScriptedConversationModel,
} from "../conversation/scriptedConversation.model.js";

function request(content: string): ConversationAgentRequest {
  return {
    sessionId: "session-backend", requestId: "request-client",
    requestMessageId: "message-client", conversationSequence: 1,
    goal: {
      goalId: "goal-backend", revision: 0, status: "ACTIVE", intent: "UNKNOWN",
      normalizedRequest: content, amount: null, duration: null, missingFields: [],
      pendingQuestion: null, stage: "COLLECTING_REQUIREMENTS",
      safety: { secureInputActive: false, riskState: "NONE", confirmationState: "NONE" },
      lastAppliedMessageId: null,
    },
    userMessage: { content, answerToQuestionId: null }, snapshot: null,
  };
}

test("C-D1-03 scripted model is deterministic and asks one question", async () => {
  const model = new ScriptedConversationModel();
  const input = request("100만원으로 예금 가입해줘");
  const first = await model.decide(input);
  const second = await model.decide(input);
  assert.deepEqual(first, second);
  assert.equal(first.mode, "ASK_USER");
  assert.equal(first.message, "가입 기간은 얼마로 할까요?");
  assert.equal(first.actionCandidate, null);
  assert.deepEqual(first.question, { fieldKey: "duration" });
  assert.equal("questionId" in first.question!, false);
  assert.equal(validateAgentDecision(first).valid, true);
  for (const key of ["assistantMessageId", "confirmationId", "eventId", "questionId"]) {
    assert.equal(key in first, false);
  }
});

test("C-D1-03 unknown input safely stops without a DOM action", async () => {
  const decision = await new ScriptedConversationModel().decide(request("무슨 말인지 모르겠어"));
  assert.equal(decision.mode, "STOP");
  assert.equal(decision.actionCandidate, null);
  assert.equal(decision.sourceSnapshotId, null);
  assert.equal(validateAgentDecision(decision).valid, true);
});

test("C-D1-03 pending duration proposes a deterministic goal patch", async () => {
  const input = request("12개월");
  input.goal.intent = "DEPOSIT";
  input.goal.amount = { value: "1000000", currency: "KRW" };
  input.goal.missingFields = ["duration"];
  input.goal.pendingQuestion = {
    questionId: "backend-question-id",
    fieldKey: "duration",
  };
  input.userMessage.answerToQuestionId = "backend-question-id";

  const model = new ScriptedConversationModel();
  const first = await model.decide(input);
  const second = await model.decide(input);
  assert.deepEqual(first, second);
  assert.deepEqual(first, {
    requestId: "request-client",
    requestMessageId: "message-client",
    goalId: "goal-backend",
    baseGoalRevision: 0,
    mode: "GOAL_PATCH_PROPOSED",
    message: null,
    confidence: 1,
    reasonCode: "GOAL_UPDATED",
    nextCondition: "LATEST_DOM_DECISION",
    sourceSnapshotId: null,
    goalPatch: {
      basedOnRevision: 0,
      duration: { value: 12, unit: "MONTH" },
      missingFields: [],
      pendingQuestionFieldKey: null,
    },
    question: null,
    actionCandidate: null,
  });
  assert.equal(validateAgentDecision(first).valid, true);
});
