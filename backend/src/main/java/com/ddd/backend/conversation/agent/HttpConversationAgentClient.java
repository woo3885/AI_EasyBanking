package com.ddd.backend.conversation.agent;

import com.ddd.backend.ai.AiDecisionClientException;
import com.ddd.backend.ai.engine.AiEngineHttpTransport;
import com.ddd.backend.ai.engine.AiEngineProperties;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

@Service
@ConditionalOnProperty(prefix = "ddd.ai.engine", name = "enabled", havingValue = "true", matchIfMissing = true)
public final class HttpConversationAgentClient implements ConversationAgentClient {
    private final AiEngineHttpTransport transport;
    private final AiEngineProperties properties;
    private final ObjectMapper mapper;
    private final ConversationAgentContractValidator validator;

    public HttpConversationAgentClient(AiEngineHttpTransport transport, AiEngineProperties properties,
            ObjectMapper mapper, ConversationAgentContractValidator validator) {
        this.transport = transport; this.properties = properties; this.mapper = mapper; this.validator = validator;
    }

    @Override
    public ConversationAgentDecision decide(ConversationAgentRequest request) {
        try {
            String response = transport.post(properties.conversationEndpointUri(), mapper.writeValueAsString(request));
            ConversationAgentDecision decision = mapper.readValue(response, ConversationAgentDecision.class);
            return validator.validate(request, decision);
        } catch (AiDecisionClientException error) {
            throw error;
        } catch (Exception error) {
            throw new AiDecisionClientException("Conversation AI response failed contract validation", error);
        }
    }
}
