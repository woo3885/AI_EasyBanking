import type {
  AgentDecision,
  ConversationAgentRequest,
} from "./conversationAgent.types.js";

export interface ConversationModelPort {
  decide(input: ConversationAgentRequest): Promise<AgentDecision>;
}
