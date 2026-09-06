import {
  AGENT_MODES,
  BROWSER_NAVIGATION_MODES,
  CONVERSATION_ACTION_TYPES,
  GOAL_INTENTS,
  GOAL_STATUSES,
  SEMANTIC_NAVIGATION_ROUTES,
} from "./conversationAgent.types.js";

const nonEmptyString = { type: "string", minLength: 1 } as const;
const nonNegativeInteger = { type: "integer", minimum: 0 } as const;
const uniqueStrings = {
  type: "array",
  uniqueItems: true,
  items: nonEmptyString,
} as const;

const amountSchema = {
  type: "object",
  additionalProperties: false,
  required: ["value", "currency"],
  properties: {
    value: { type: "string", pattern: "^[0-9]+$" },
    currency: { const: "KRW" },
  },
} as const;

const durationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["value", "unit"],
  properties: {
    value: { type: "integer", minimum: 1 },
    unit: { const: "MONTH" },
  },
} as const;

export const conversationUserGoalSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: [
    "goalId", "revision", "status", "intent", "normalizedRequest",
    "amount", "duration", "missingFields", "pendingQuestion", "stage",
    "safety", "lastAppliedMessageId",
  ],
  properties: {
    goalId: nonEmptyString,
    revision: nonNegativeInteger,
    status: { enum: GOAL_STATUSES },
    intent: { enum: GOAL_INTENTS },
    normalizedRequest: nonEmptyString,
    amount: { anyOf: [{ type: "null" }, amountSchema] },
    duration: { anyOf: [{ type: "null" }, durationSchema] },
    missingFields: uniqueStrings,
    pendingQuestion: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["questionId", "fieldKey"],
          properties: {
            questionId: nonEmptyString,
            fieldKey: nonEmptyString,
          },
        },
      ],
    },
    stage: nonEmptyString,
    safety: {
      type: "object",
      additionalProperties: false,
      required: ["secureInputActive", "riskState", "confirmationState"],
      properties: {
        secureInputActive: { type: "boolean" },
        riskState: { enum: ["NONE", "WARNING", "BLOCKED"] },
        confirmationState: {
          enum: ["NONE", "REQUIRED", "APPROVED", "REJECTED"],
        },
      },
    },
    lastAppliedMessageId: {
      anyOf: [{ type: "null" }, nonEmptyString],
    },
  },
} as const;

export const userGoalPatchSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: ["basedOnRevision"],
  properties: {
    basedOnRevision: nonNegativeInteger,
    intent: { enum: GOAL_INTENTS },
    amount: { anyOf: [{ type: "null" }, amountSchema] },
    duration: { anyOf: [{ type: "null" }, durationSchema] },
    missingFields: uniqueStrings,
    pendingQuestionFieldKey: {
      anyOf: [{ type: "null" }, nonEmptyString],
    },
    status: { enum: ["ACTIVE", "CANCELLED", "SUPERSEDED"] },
  },
} as const;

export const agentDecisionSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: [
    "requestId", "requestMessageId", "goalId", "baseGoalRevision", "mode",
    "message", "confidence", "reasonCode", "nextCondition",
    "sourceSnapshotId", "goalPatch", "question", "actionCandidate",
    "navigationCandidate",
  ],
  properties: {
    requestId: nonEmptyString,
    requestMessageId: nonEmptyString,
    goalId: nonEmptyString,
    baseGoalRevision: nonNegativeInteger,
    mode: { enum: AGENT_MODES },
    message: {
      anyOf: [
        { type: "null" },
        { type: "string", minLength: 1, pattern: "^[^\\r\\n]+$" },
      ],
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    reasonCode: nonEmptyString,
    nextCondition: { anyOf: [{ type: "null" }, nonEmptyString] },
    sourceSnapshotId: { anyOf: [{ type: "null" }, nonEmptyString] },
    goalPatch: { anyOf: [{ type: "null" }, userGoalPatchSchema] },
    question: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["fieldKey"],
          properties: { fieldKey: nonEmptyString },
        },
      ],
    },
    actionCandidate: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["actionType", "targetElementId", "role", "accessibleLabel", "guide"],
          properties: {
            actionType: { enum: CONVERSATION_ACTION_TYPES },
            targetElementId: { type: "string", minLength: 1, maxLength: 128 },
            role: { type: "string", minLength: 1, maxLength: 32 },
            accessibleLabel: { type: "string", minLength: 1, maxLength: 120, pattern: "^[^\\r\\n]+$" },
            guide: { type: "string", minLength: 1, maxLength: 200, pattern: "^[^\\r\\n]+$" },
          },
        },
      ],
    },
    navigationCandidate: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["decisionId", "semanticRoute", "navigationMode"],
          properties: {
            decisionId: { type: "string", pattern: "^navdec_[a-f0-9]{64}$" },
            semanticRoute: { enum: SEMANTIC_NAVIGATION_ROUTES },
            navigationMode: { enum: BROWSER_NAVIGATION_MODES },
          },
        },
      ],
    },
  },
} as const;

export const conversationAgentRequestSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: [
    "sessionId", "requestId", "requestMessageId", "conversationSequence",
    "goal", "userMessage", "snapshot",
  ],
  properties: {
    sessionId: nonEmptyString,
    requestId: nonEmptyString,
    requestMessageId: nonEmptyString,
    conversationSequence: nonNegativeInteger,
    goal: conversationUserGoalSchema,
    userMessage: {
      type: "object",
      additionalProperties: false,
      required: ["content", "answerToQuestionId"],
      properties: {
        content: nonEmptyString,
        answerToQuestionId: { anyOf: [{ type: "null" }, nonEmptyString] },
      },
    },
    snapshot: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: [
            "sourceSnapshotId", "pageIdentity", "sanitizedDomSnapshot",
          ],
          properties: {
            sourceSnapshotId: nonEmptyString,
            pageIdentity: nonEmptyString,
            // Existing BackendSanitizedDomSnapshot owns the nested contract.
            sanitizedDomSnapshot: { type: "object" },
          },
        },
      ],
    },
  },
} as const;
