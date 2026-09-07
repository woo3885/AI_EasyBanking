import { executeWithRetry } from "../stability/retryPolicy.js";
import { agentDecisionSchema } from "./conversationAgent.schemas.js";
import type {
  AgentDecision,
  ConversationAgentRequest,
} from "./conversationAgent.types.js";
import {
  GeminiConversationModel,
  type GeminiConversationTransport,
} from "./geminiConversation.model.js";
import type { ConversationModelPort } from "./conversationModel.port.js";
import { ScriptedConversationModel } from "./scriptedConversation.model.js";

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

/** Gemini-backed production model with deterministic, fail-closed fallback. */
export class ProductionConversationModel implements ConversationModelPort {
  private readonly fallback = new ScriptedConversationModel();

  constructor(
    private readonly transport: GeminiConversationTransport =
      generateGeminiConversationText,
  ) {}

  async decide(input: ConversationAgentRequest): Promise<AgentDecision> {
    try {
      const model = new GeminiConversationModel(async ({ prompt }) =>
        this.transport({ prompt: prompt + trustedBindings(input) })
      );
      return await model.decide(input);
    } catch (error) {
      console.error(
        "[AI Engine] Gemini conversation failed contract validation. Scripted fallback is returned.",
        error instanceof Error ? error.name : "UnknownError",
      );
      return this.fallback.decide(input);
    }
  }
}

export function createProductionConversationModel(
  transport: GeminiConversationTransport = generateGeminiConversationText,
): ConversationModelPort {
  return new ProductionConversationModel(transport);
}
