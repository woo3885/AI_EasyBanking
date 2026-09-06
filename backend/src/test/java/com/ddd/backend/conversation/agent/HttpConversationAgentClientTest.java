package com.ddd.backend.conversation.agent;

import com.ddd.backend.ai.engine.AiEngineHttpTransport;
import com.ddd.backend.ai.engine.AiEngineProperties;
import com.ddd.backend.conversation.ConversationMessagePolicy;
import com.ddd.backend.conversation.goal.UserGoalAuthority;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;
import java.net.URI;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import static org.assertj.core.api.Assertions.assertThat;

class HttpConversationAgentClientTest {
    @Test
    void productionClientUsesConversationEndpointAndExactJsonContract() {
        var calls = new AtomicInteger();
        var body = new AtomicReference<String>();
        AiEngineHttpTransport transport = new AiEngineHttpTransport() {
            public String post(String ignored) { throw new AssertionError("legacy action endpoint used"); }
            public String post(URI endpoint, String requestBody) {
                calls.incrementAndGet(); body.set(requestBody);
                assertThat(endpoint.getPath()).isEqualTo("/api/ai/conversation/decision");
                return """
                        {"requestId":"request-1","requestMessageId":"message-1","goalId":"%s",
                         "baseGoalRevision":0,"mode":"ASK_USER","message":"가입 기간은 얼마로 할까요?",
                         "confidence":1.0,"reasonCode":"MISSING_DURATION","nextCondition":null,
                         "sourceSnapshotId":null,
                         "goalPatch":{"basedOnRevision":0,"intent":"DEPOSIT",
                           "amount":{"value":"1000000","currency":"KRW"},"duration":null,
                           "missingFields":["duration"],"pendingQuestionFieldKey":"duration","status":null},
                         "question":{"fieldKey":"duration"},"actionCandidate":null}
                        """.formatted(goal.snapshot().goalId());
            }
            final UserGoalAuthority goal = new UserGoalAuthority();
        };
        var properties = new AiEngineProperties();
        var goal = new UserGoalAuthority().snapshot();
        var request = new ConversationAgentRequest("session-1", "request-1", "message-1", 1, goal,
                new ConversationAgentRequest.UserMessage("100만원으로 예금 가입해줘", null), null);
        // The response goal ID must match this request goal.
        AiEngineHttpTransport matching = new AiEngineHttpTransport() {
            public String post(String ignored) { throw new AssertionError(); }
            public String post(URI endpoint, String requestBody) {
                calls.incrementAndGet(); body.set(requestBody);
                return """
                        {"requestId":"request-1","requestMessageId":"message-1","goalId":"%s",
                         "baseGoalRevision":0,"mode":"ASK_USER","message":"가입 기간은 얼마로 할까요?",
                         "confidence":1.0,"reasonCode":"MISSING_DURATION","nextCondition":null,
                         "sourceSnapshotId":null,"goalPatch":{"basedOnRevision":0,"intent":"DEPOSIT",
                         "amount":{"value":"1000000","currency":"KRW"},"duration":null,
                         "missingFields":["duration"],"pendingQuestionFieldKey":"duration","status":null},
                         "question":{"fieldKey":"duration"},"actionCandidate":null}
                        """.formatted(goal.goalId());
            }
        };
        var client = new HttpConversationAgentClient(matching, properties, JsonMapper.builder().build(),
                new ConversationAgentContractValidator(new ConversationMessagePolicy()));
        ConversationAgentDecision decision = client.decide(request);
        assertThat(calls).hasValue(1);
        assertThat(body.get()).contains("\"amount\":null", "\"safety\"", "\"snapshot\":null");
        assertThat(decision.mode()).isEqualTo(ConversationInteractionMode.ASK_USER);
        assertThat(decision.goalPatch().amount().value()).isEqualTo("1000000");
    }
}
