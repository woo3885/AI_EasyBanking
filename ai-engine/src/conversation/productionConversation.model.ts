import { executeWithRetry } from "../stability/retryPolicy.js";
import { agentDecisionSchema } from "./conversationAgent.schemas.js";
import type {
  AgentDecision,
  ConversationAgentRequest,
  UserGoalPatch,
} from "./conversationAgent.types.js";
import {
  GeminiConversationContractError,
  type GeminiConversationTransport,
} from "./geminiConversation.model.js";
import type { ConversationModelPort } from "./conversationModel.port.js";
import { createConversationPrompt } from "./conversationPrompt.builder.js";
import { ScriptedConversationModel } from "./scriptedConversation.model.js";
import { validateUserGoalPatch } from "./conversationAgent.validator.js";
import {
  extractInitialGoalPatch,
  questionMessage,
} from "./userGoalPatch.extractor.js";

async function generateGeminiConversationText(
  { prompt }: { prompt: string },
): Promise<string> {
  const [{ geminiClient }, { env }] = await Promise.all([
    import("../clients/gemini.client.js"),
    import("../config/env.js"),
  ]);
  const response = await executeWithRetry(
    () => geminiClient.models.generateContent({
      model: env.geminiModel,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: agentDecisionSchema,
        temperature: 0.1,
      },
    }),
    { maxAttempts: 2, timeoutMs: 5_000, baseDelayMs: 500 },
  );
  const text = response.text?.trim();
  if (!text) throw new Error("Gemini conversation response was empty");
  return text;
}

function trustedBindings(input: ConversationAgentRequest): string {
  return `\n\nTRUSTED_RESPONSE_BINDINGS_JSON\n${JSON.stringify({
    requestId: input.requestId,
    requestMessageId: input.requestMessageId,
    goalId: input.goal.goalId,
    baseGoalRevision: input.goal.revision,
  })}\nEND_TRUSTED_RESPONSE_BINDINGS_JSON\n` +
    "Return exactly one JSON object matching the response schema. Copy all trusted bindings exactly.";
}

function normalizeInitialDecision(
  input: ConversationAgentRequest,
  raw: string,
): AgentDecision {
  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch {
    throw new GeminiConversationContractError(
      "INVALID_JSON",
      "Gemini conversation output was not valid JSON.",
    );
  }
  if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new GeminiConversationContractError(
      "INVALID_DECISION",
      "Gemini conversation output did not contain a goal patch.",
    );
  }

  const proposed = (candidate as Record<string, unknown>).goalPatch;
  if (proposed === null || typeof proposed !== "object" || Array.isArray(proposed)) {
    throw new GeminiConversationContractError(
      "INVALID_DECISION",
      "Gemini conversation output did not contain a goal patch.",
    );
  }
  const lexical = extractInitialGoalPatch(input.goal, input.userMessage.content);
  const lexicalIntent = lexical.kind === "PATCH" && lexical.patch.intent !== "UNKNOWN"
    ? lexical.patch.intent
    : undefined;
  const proposedPatch = {
    ...(proposed as Record<string, unknown>),
    basedOnRevision: input.goal.revision,
    ...(lexicalIntent ? { intent: lexicalIntent } : {}),
  } as unknown as UserGoalPatch;
  const intent = proposedPatch.intent ?? input.goal.intent;
  const missingFields = intent === "DEPOSIT"
    ? [
        ...(proposedPatch.amount ?? input.goal.amount ? [] : ["amount"]),
        ...(proposedPatch.duration ?? input.goal.duration ? [] : ["duration"]),
      ]
    : proposedPatch.missingFields ?? [];
  const patch: UserGoalPatch = {
    ...proposedPatch,
    missingFields,
    pendingQuestionFieldKey: missingFields[0] ?? null,
  };
  const validation = validateUserGoalPatch(patch);
  if (!validation.valid || Object.keys(patch).length <= 1 || patch.intent === "UNKNOWN") {
    throw new GeminiConversationContractError(
      "INVALID_DECISION",
      `Gemini goal patch violated the contract: ${validation.errors.join("; ")}`,
    );
  }

  const fieldKey = missingFields[0] ?? null;
  const base = {
    requestId: input.requestId,
    requestMessageId: input.requestMessageId,
    goalId: input.goal.goalId,
    baseGoalRevision: input.goal.revision,
    confidence: 1,
    sourceSnapshotId: null,
    goalPatch: patch,
    actionCandidate: null,
    navigationCandidate: null,
  } as const;

  if (fieldKey) {
    return {
      ...base,
      mode: "ASK_USER",
      message: questionMessage(fieldKey),
      reasonCode: `MISSING_${fieldKey.toUpperCase()}`,
      nextCondition: null,
      question: { fieldKey },
    };
  }
  return {
    ...base,
    mode: "GOAL_PATCH_PROPOSED",
    message: null,
    reasonCode: "GOAL_UPDATED",
    nextCondition: "LATEST_DOM_DECISION",
    question: null,
  };
}

/** Gemini-backed production model with deterministic, fail-closed fallback. */
export class ProductionConversationModel implements ConversationModelPort {
  private readonly fallback = new ScriptedConversationModel();

  constructor(
    private readonly transport: GeminiConversationTransport =
      generateGeminiConversationText,
  ) {}

  async decide(input: ConversationAgentRequest): Promise<AgentDecision> {
    const deterministic = await this.fallback.decide(input);
    try {
      const prompt = createConversationPrompt(input) + trustedBindings(input);

      // Gemini observes every turn. Pending answers and DOM/protection turns
      // are interpreted by authoritative deterministic policy, so the model's
      // untrusted action proposal is deliberately not materialized.
      if (input.goal.pendingQuestion !== null || input.snapshot !== null) {
        await this.transport({ prompt });
        return deterministic;
      }

      return normalizeInitialDecision(input, await this.transport({ prompt }));
    } catch (error) {
      console.error(
        "[AI Engine] Gemini conversation failed contract validation. Scripted fallback is returned.",
        error instanceof GeminiConversationContractError
          ? `${error.name}:${error.code}:${error.message}`
          : error instanceof Error ? error.name : "UnknownError",
      );
      return deterministic;
    }
  }
}

export function createProductionConversationModel(
  transport: GeminiConversationTransport = generateGeminiConversationText,
): ConversationModelPort {
  return new ProductionConversationModel(transport);
}
