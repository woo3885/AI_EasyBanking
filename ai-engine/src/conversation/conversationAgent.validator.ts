import Ajv2020Module from "ajv/dist/2020.js";
import type { ErrorObject, ValidateFunction } from "ajv";

import {
  agentDecisionSchema,
  conversationAgentRequestSchema,
  conversationUserGoalSchema,
  userGoalPatchSchema,
} from "./conversationAgent.schemas.js";
import type {
  AgentDecision,
  ConversationAgentRequest,
  ConversationUserGoal,
  UserGoalPatch,
} from "./conversationAgent.types.js";

const Ajv2020 = Ajv2020Module.default ?? Ajv2020Module;
const ajv = new Ajv2020({ allErrors: true, strict: false });

const validators = {
  goal: ajv.compile(conversationUserGoalSchema),
  patch: ajv.compile(userGoalPatchSchema),
  decision: ajv.compile(agentDecisionSchema),
  request: ajv.compile(conversationAgentRequestSchema),
};

export interface ConversationValidationResult {
  valid: boolean;
  errors: string[];
}

function errorsOf(errors: ErrorObject[] | null | undefined): string[] {
  return (errors ?? []).map((error) =>
    `${error.instancePath || "/"} ${error.message ?? "validation error"}`,
  );
}

function validateSchema(
  validator: ValidateFunction,
  value: unknown,
): ConversationValidationResult {
  return validator(value)
    ? { valid: true, errors: [] }
    : { valid: false, errors: errorsOf(validator.errors) };
}

export function validateConversationUserGoal(
  value: unknown,
): ConversationValidationResult {
  return validateSchema(validators.goal, value);
}

export function validateUserGoalPatch(
  value: unknown,
): ConversationValidationResult {
  return validateSchema(validators.patch, value);
}

export function validateConversationAgentRequest(
  value: unknown,
): ConversationValidationResult {
  return validateSchema(validators.request, value);
}

export function validateAgentDecision(
  value: unknown,
): ConversationValidationResult {
  const schemaResult = validateSchema(validators.decision, value);
  if (!schemaResult.valid) return schemaResult;

  const decision = value as AgentDecision;
  const errors: string[] = [];

  if (decision.goalPatch !== null
      && decision.goalPatch.basedOnRevision !== decision.baseGoalRevision) {
    errors.push("/goalPatch/basedOnRevision must equal /baseGoalRevision");
  }

  if (decision.mode === "GOAL_PATCH_PROPOSED") {
    if (decision.goalPatch === null) {
      errors.push("/goalPatch is required for GOAL_PATCH_PROPOSED");
    } else if (Object.keys(decision.goalPatch).every(
      (key) => key === "basedOnRevision",
    )) {
      errors.push("/goalPatch must propose at least one change");
    }
    if (decision.question !== null) {
      errors.push("/question must be null for GOAL_PATCH_PROPOSED");
    }
    if (decision.actionCandidate !== null) {
      errors.push("/actionCandidate must be null for GOAL_PATCH_PROPOSED");
    }
    if (decision.nextCondition !== "LATEST_DOM_DECISION") {
      errors.push("/nextCondition must be LATEST_DOM_DECISION for GOAL_PATCH_PROPOSED");
    }
    if (decision.message !== null) {
      errors.push("/message must be null for GOAL_PATCH_PROPOSED");
    }
  } else if (decision.message === null) {
    errors.push("/message must be non-null unless mode is GOAL_PATCH_PROPOSED");
  }

  if (decision.mode === "GOAL_PATCH_PROPOSED") {
    // Mode-specific null checks are handled above.
  } else if (decision.mode === "ASK_USER") {
    if (decision.question === null) errors.push("/question is required for ASK_USER");
    if (decision.actionCandidate !== null) {
      errors.push("/actionCandidate must be null for ASK_USER");
    }
  } else if (decision.question !== null) {
    errors.push("/question must be null unless mode is ASK_USER");
  }

  if (decision.mode === "GOAL_PATCH_PROPOSED") {
    // Mode-specific null checks are handled above.
  } else if (decision.mode === "AUTO_EXECUTE" || decision.mode === "GUIDE_USER") {
    if (decision.actionCandidate === null) {
      errors.push(`/actionCandidate is required for ${decision.mode}`);
    }
  } else if (decision.actionCandidate !== null) {
    errors.push(`/actionCandidate must be null for ${decision.mode}`);
  }

  return { valid: errors.length === 0, errors };
}

export function assertConversationUserGoal(
  value: unknown,
): asserts value is ConversationUserGoal {
  assertValid("ConversationUserGoal", validateConversationUserGoal(value));
}

export function assertUserGoalPatch(
  value: unknown,
): asserts value is UserGoalPatch {
  assertValid("UserGoalPatch", validateUserGoalPatch(value));
}

export function assertAgentDecision(
  value: unknown,
): asserts value is AgentDecision {
  assertValid("AgentDecision", validateAgentDecision(value));
}

export function assertConversationAgentRequest(
  value: unknown,
): asserts value is ConversationAgentRequest {
  assertValid("ConversationAgentRequest", validateConversationAgentRequest(value));
}

function assertValid(name: string, result: ConversationValidationResult): void {
  if (!result.valid) throw new Error(`${name}: ${result.errors.join(", ")}`);
}
