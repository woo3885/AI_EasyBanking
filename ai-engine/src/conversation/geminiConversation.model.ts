import { createConversationPrompt } from "./conversationPrompt.builder.js";
import type {
  AgentDecision,
  ConversationAgentRequest,
} from "./conversationAgent.types.js";
import { validateConversationInteractionDecision } from "./conversationInteraction.policy.js";
import type { ConversationModelPort } from "./conversationModel.port.js";

export interface GeminiConversationTransportInput {
  prompt: string;
}

/** Injectable so contract tests and local development never require a Gemini key. */
export type GeminiConversationTransport = (
  input: GeminiConversationTransportInput,
) => Promise<string>;

export class GeminiConversationContractError extends Error {
  constructor(
    public readonly code: "INVALID_JSON" | "INVALID_DECISION",
    message: string,
  ) {
    super(message);
    this.name = "GeminiConversationContractError";
  }
}

/**
 * C-08 contract boundary for a future Gemini-backed ConversationModelPort.
 * Production routing stays scripted until an explicitly configured transport is wired.
 */
export class GeminiConversationModel implements ConversationModelPort {
  constructor(private readonly transport: GeminiConversationTransport) {}

  async decide(input: ConversationAgentRequest): Promise<AgentDecision> {
    const raw = await this.transport({
      prompt: createConversationPrompt(input),
    });

    let candidate: unknown;
    try {
      candidate = JSON.parse(raw);
    } catch {
      throw new GeminiConversationContractError(
        "INVALID_JSON",
        "Gemini conversation output was not valid JSON.",
      );
    }

    const validation = validateConversationInteractionDecision(input, candidate);
    if (!validation.valid) {
      throw new GeminiConversationContractError(
        "INVALID_DECISION",
        `Gemini conversation output violated the contract: ${validation.errors.join("; ")}`,
      );
    }

    return candidate as AgentDecision;
  }
}
