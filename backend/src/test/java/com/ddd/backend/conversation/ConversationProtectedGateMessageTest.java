package com.ddd.backend.conversation;

import com.ddd.backend.conversation.agent.ConversationAgentDecision;
import com.ddd.backend.conversation.agent.ConversationInteractionMode;
import com.ddd.backend.conversation.event.ConversationEventStore;
import com.ddd.backend.conversation.gate.ConversationProtectedGateRegistry;
import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.infrastructure.session.InMemoryAutomationSessionRepository;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ConversationProtectedGateMessageTest {

    @Test
    void 보호_gate중에는_새_AI_message를_접수하지_않는다() {
        var sessions = new InMemoryAutomationSessionRepository();
        AutomationSession session = sessions.save(AutomationSession.create("예금 가입"));
        var gates = new ConversationProtectedGateRegistry();
        var service = new ConversationService(
                sessions, new ConversationStateStore(Duration.ofMinutes(30)),
                new SessionMessageMailbox(), new ConversationMessagePolicy(),
                new ConversationEventStore());
        service.setProtectedGates(gates);
        gates.activate(session.getSessionId(), new ConversationAgentDecision(
                "request-1", "message-1", "goal-1", 0,
                ConversationInteractionMode.FINAL_CONFIRMATION_REQUIRED,
                "최종 확인이 필요합니다.", 1.0, "FINAL", null,
                "snap-1", null, null, null));

        assertThatThrownBy(() -> service.acceptInitial(
                session.getSessionId(), "request-2", "message-2", "계속", null))
                .isInstanceOf(ConversationException.class)
                .extracting(error -> ((ConversationException) error).error())
                .isEqualTo(ConversationError.PROTECTED_GATE_ACTIVE);
    }
}
