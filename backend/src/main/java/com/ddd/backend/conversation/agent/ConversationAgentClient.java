package com.ddd.backend.conversation.agent;
@FunctionalInterface
public interface ConversationAgentClient {
    ConversationAgentDecision decide(ConversationAgentRequest request);
}
