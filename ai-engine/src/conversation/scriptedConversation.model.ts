import type {
  AgentDecision,
  ConversationAgentRequest,
  UserGoalPatch,
} from "./conversationAgent.types.js";
import type { ConversationModelPort } from "./conversationModel.port.js";
import {
  extractInitialGoalPatch,
  mergeGoalAnswer,
  questionMessage,
  type GoalPatchExtractionResult,
} from "./userGoalPatch.extractor.js";
import {
  decideConversationInteraction,
} from "./conversationInteraction.policy.js";

export class ScriptedConversationModel implements ConversationModelPort {
  async decide(input: ConversationAgentRequest): Promise<AgentDecision> {
    if (
      input.snapshot !== null &&
      input.goal.missingFields.length === 0 &&
      input.goal.pendingQuestion === null &&
      (
        (
          input.goal.intent === "DEPOSIT" &&
          input.goal.amount !== null &&
          input.goal.duration !== null
        ) ||
        input.goal.stage === "TRANSFER_ENTRY"
      )
    ) {
      return decideConversationInteraction(input);
    }
    const result = input.goal.pendingQuestion === null
      ? extractInitialGoalPatch(input.goal, input.userMessage.content)
      : mergeGoalAnswer(input.goal, input.userMessage.content);
    return toDecision(input, result);
  }
}

function baseDecision(
  input: ConversationAgentRequest,
): Omit<AgentDecision, "mode" | "message" | "confidence" | "reasonCode">
  & Pick<AgentDecision, "mode" | "message" | "confidence" | "reasonCode"> {
  return {
    requestId: input.requestId,
    requestMessageId: input.requestMessageId,
    goalId: input.goal.goalId,
    baseGoalRevision: input.goal.revision,
    mode: "STOP",
    message: "요청을 안전하게 처리할 수 없습니다.",
    confidence: 1,
    reasonCode: "UNSUPPORTED_DAY1_INPUT",
    nextCondition: null,
    sourceSnapshotId: null,
    goalPatch: null,
    question: null,
    actionCandidate: null,
    navigationCandidate: null,
  };
}

function toDecision(
  input: ConversationAgentRequest,
  result: GoalPatchExtractionResult,
): AgentDecision {
  const base = baseDecision(input);
  if (result.kind === "SECURE_INPUT") {
    return { ...base, mode: "STOP", message: result.message, reasonCode: "SECURE_VALUE_REJECTED" };
  }
  if (result.kind === "CANCEL") {
    return { ...base, mode: "STOP", message: result.message, reasonCode: "USER_CANCELLED", goalPatch: result.patch };
  }
  if (result.kind === "CONFLICT") {
    return {
      ...base,
      mode: "STOP",
      message: result.message,
      reasonCode: "GOAL_VALUE_CONFLICT",
    };
  }
  if (result.kind === "AMBIGUOUS") {
    return {
      ...base,
      mode: "ASK_USER",
      message: result.message,
      reasonCode: "AMBIGUOUS_ANSWER",
      question: { fieldKey: result.fieldKey },
    };
  }

  if (result.patch.intent === "UNKNOWN") {
    return base;
  }

  const nextMissing = result.patch.missingFields?.[0];
  if (nextMissing) return askForMissing(base, result.patch, nextMissing);

  return {
    ...base,
    mode: "GOAL_PATCH_PROPOSED",
    message: null,
    reasonCode: "GOAL_UPDATED",
    nextCondition: "LATEST_DOM_DECISION",
    goalPatch: result.patch,
  };
}

function askForMissing(
  base: AgentDecision,
  patch: UserGoalPatch,
  fieldKey: string,
): AgentDecision {
  const message = fieldKey === "duration"
    ? "가입 기간은 얼마로 할까요?"
    : questionMessage(fieldKey);
  return {
    ...base,
    mode: "ASK_USER",
    message,
    confidence: 1,
    reasonCode: `MISSING_${fieldKey.toUpperCase()}`,
    goalPatch: patch,
    question: { fieldKey },
  };
}
