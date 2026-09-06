package com.ddd.backend.conversation.gate;

import com.ddd.backend.conversation.agent.ConversationAgentDecision;
import com.ddd.backend.conversation.agent.ConversationInteractionMode;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ConversationProtectedGateRegistryTest {

    @Test
    void 동일_AI_결정은_하나의_gate만_활성화한다() {
        ConversationProtectedGateRegistry registry = new ConversationProtectedGateRegistry();
        ConversationAgentDecision decision = decision(
                "message-1", ConversationInteractionMode.FINAL_CONFIRMATION_REQUIRED);

        ConversationProtectedGate first = registry.activate("session-1", decision);
        ConversationProtectedGate duplicate = registry.activate("session-1", decision);

        assertThat(duplicate).isEqualTo(first);
        assertThat(registry.blocksAutomation("session-1")).isTrue();
    }

    @Test
    void 보호_gate중에는_다른_AI_결정을_활성화하지_않는다() {
        ConversationProtectedGateRegistry registry = new ConversationProtectedGateRegistry();
        registry.activate("session-1", decision(
                "message-1", ConversationInteractionMode.SECURE_INPUT_REQUIRED));

        assertThatThrownBy(() -> registry.activate("session-1", decision(
                "message-2", ConversationInteractionMode.RISK_WARNING)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("이미 활성");
    }

    @Test
    void resolve는_requestId기준_exactly_once이고_세션정리시_latch를_제거한다() {
        ConversationProtectedGateRegistry registry = new ConversationProtectedGateRegistry();
        ConversationProtectedGate gate = registry.activate("session-1", decision(
                "message-1", ConversationInteractionMode.RISK_WARNING));

        assertThat(registry.resolve("session-1", gate.gateId(), "resolve-1"))
                .isEqualTo(gate);
        assertThat(registry.blocksAutomation("session-1")).isFalse();
        assertThatThrownBy(() -> registry.resolve(
                "session-1", gate.gateId(), "resolve-1"))
                .isInstanceOf(IllegalStateException.class);

        registry.activate("session-1", decision(
                "message-2", ConversationInteractionMode.FINAL_CONFIRMATION_REQUIRED));
        registry.removeSession("session-1");
        assertThat(registry.active("session-1")).isEmpty();
    }

    private ConversationAgentDecision decision(
            String messageId, ConversationInteractionMode mode
    ) {
        return new ConversationAgentDecision(
                "request-1", messageId, "goal-1", 1, mode,
                "사용자 확인이 필요합니다.", 1.0, "PROTECTED_GATE", null,
                "snap-1", null, null, null);
    }
}
