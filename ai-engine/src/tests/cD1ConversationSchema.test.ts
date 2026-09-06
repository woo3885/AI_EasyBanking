import assert from "node:assert/strict";
import test from "node:test";

import {
  validateAgentDecision,
  validateConversationAgentRequest,
  validateConversationUserGoal,
  validateUserGoalPatch,
} from "../conversation/conversationAgent.validator.js";

const goal = {
  goalId: "goal-1",
  revision: 0,
  status: "ACTIVE",
  intent: "DEPOSIT",
  normalizedRequest: "100만원을 12개월 예금",
  amount: { value: "1000000", currency: "KRW" },
  duration: { value: 12, unit: "MONTH" },
  missingFields: [],
  pendingQuestion: null,
  stage: "COLLECTING_REQUIREMENTS",
  safety: {
    secureInputActive: false,
    riskState: "NONE",
    confirmationState: "NONE",
  },
  lastAppliedMessageId: "user-message-1",
};

const askUserDecision = {
  requestId: "request-1",
  requestMessageId: "user-message-1",
  goalId: "goal-1",
  baseGoalRevision: 0,
  mode: "ASK_USER",
  message: "예금 기간을 알려주세요.",
  confidence: 0.9,
  reasonCode: "MISSING_DURATION",
  nextCondition: null,
  sourceSnapshotId: null,
  goalPatch: null,
  question: { fieldKey: "duration" },
  actionCandidate: null,
};

const request = {
  sessionId: "session-1",
  requestId: "request-1",
  requestMessageId: "user-message-1",
  conversationSequence: 1,
  goal,
  userMessage: {
    content: "100만원을 예금하고 싶어요",
    answerToQuestionId: null,
  },
  snapshot: null,
};

const valid = (result: { valid: boolean }) => assert.equal(result.valid, true);
const invalid = (result: { valid: boolean }) => assert.equal(result.valid, false);

test("C-D1 UserGoal strict schema", () => {
  valid(validateConversationUserGoal(goal));
  invalid(validateConversationUserGoal({ ...goal, revision: -1 }));
  invalid(validateConversationUserGoal({ ...goal, amount: { value: "1M", currency: "KRW" } }));
  invalid(validateConversationUserGoal({ ...goal, duration: { value: 0, unit: "MONTH" } }));
  invalid(validateConversationUserGoal({ ...goal, missingFields: ["duration", "duration"] }));
});

test("C-D1 UserGoalPatch rejects authority fields", () => {
  valid(validateUserGoalPatch({ basedOnRevision: 0, intent: "DEPOSIT" }));
  invalid(validateUserGoalPatch({ basedOnRevision: -1 }));
  invalid(validateUserGoalPatch({ basedOnRevision: 0, goalId: "replacement" }));
  invalid(validateUserGoalPatch({ basedOnRevision: 0, safety: goal.safety }));
});

test("C-D1 AgentDecision strict and semantic validation", () => {
  valid(validateAgentDecision(askUserDecision));
  invalid(validateAgentDecision({ ...askUserDecision, question: null }));
  invalid(validateAgentDecision({ ...askUserDecision, requestMessageId: "" }));
  invalid(validateAgentDecision({ ...askUserDecision, baseGoalRevision: -1 }));
  invalid(validateAgentDecision({ ...askUserDecision, confidence: -0.1 }));
  invalid(validateAgentDecision({ ...askUserDecision, confidence: 1.1 }));
  invalid(validateAgentDecision({
    ...askUserDecision,
    question: { fieldKey: "duration", questionId: "forbidden" },
  }));
  invalid(validateAgentDecision({ ...askUserDecision, assistantMessageId: "forbidden" }));
  invalid(validateAgentDecision({ ...askUserDecision, confirmationId: "forbidden" }));
  valid(validateAgentDecision({
    ...askUserDecision,
    mode: "STOP",
    question: null,
    sourceSnapshotId: null,
  }));
  const internalAction = {
    ...askUserDecision,
    mode: "AUTO_EXECUTE",
    question: null,
    sourceSnapshotId: "snapshot-1",
    actionCandidate: {
      actionType: "CLICK",
      targetElementId: "el-snapshot-1-001",
      role: "button",
      accessibleLabel: "예금 메뉴",
      guide: "다음 화면으로 이동합니다.",
    },
  };
  valid(validateAgentDecision(internalAction));
  invalid(validateAgentDecision({
    ...internalAction,
    actionCandidate: { actionType: "CLICK" },
  }));
  invalid(validateAgentDecision({
    ...internalAction,
    actionCandidate: { ...internalAction.actionCandidate, targetId: "public-target" },
  }));
  invalid(validateAgentDecision({
    ...askUserDecision,
    mode: "FINAL_CONFIRMATION_REQUIRED",
    question: null,
    sourceSnapshotId: "snapshot-1",
    actionCandidate: { actionType: "CLICK" },
  }));
});

test("C-D1 GOAL_PATCH_PROPOSED strict semantic validation", () => {
  const proposed = {
    ...askUserDecision,
    mode: "GOAL_PATCH_PROPOSED",
    message: null,
    nextCondition: "LATEST_DOM_DECISION",
    goalPatch: { basedOnRevision: 0, duration: { value: 12, unit: "MONTH" } },
    question: null,
    actionCandidate: null,
  };
  valid(validateAgentDecision(proposed));
  invalid(validateAgentDecision({ ...proposed, goalPatch: null }));
  invalid(validateAgentDecision({ ...proposed, goalPatch: { basedOnRevision: 0 } }));
  invalid(validateAgentDecision({ ...proposed, question: { fieldKey: "duration" } }));
  invalid(validateAgentDecision({ ...proposed, actionCandidate: { actionType: "CLICK" } }));
  invalid(validateAgentDecision({ ...proposed, nextCondition: "SOMETHING_ELSE" }));
  invalid(validateAgentDecision({ ...proposed, message: "updated" }));
  invalid(validateAgentDecision({
    ...proposed,
    goalPatch: { basedOnRevision: 1, duration: { value: 12, unit: "MONTH" } },
  }));
});

test("C-D1 B to C request rejects target identity fields", () => {
  valid(validateConversationAgentRequest(request));
  invalid(validateConversationAgentRequest({ ...request, selector: "#transfer" }));
  invalid(validateConversationAgentRequest({ ...request, XPath: "//button" }));
  valid(validateConversationAgentRequest({ ...request, snapshot: null }));
});
