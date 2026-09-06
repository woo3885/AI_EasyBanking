package com.ddd.backend.conversation.overlay;

import com.ddd.backend.automation.dom.ElementRegistry;
import com.ddd.backend.automation.dom.SanitizedDomSnapshot;
import com.ddd.backend.automation.session.BrowserSessionManager;
import com.ddd.backend.conversation.*;
import com.ddd.backend.conversation.bridge.DemoAgentBridgeBinding;
import com.ddd.backend.conversation.bridge.DemoAgentBridgeRegistry;
import com.ddd.backend.conversation.bridge.UserBrowserBridgeBinding;
import com.ddd.backend.conversation.bridge.UserBrowserBridgeRegistry;
import com.ddd.backend.conversation.event.ConversationEventPublisher;
import com.ddd.backend.conversation.event.ConversationEventStore;
import com.ddd.backend.conversation.goal.GoalRouteCompatibilityPolicy;
import com.ddd.backend.conversation.goal.UserGoal;
import com.ddd.backend.conversation.goal.UserGoalPatch;
import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.domain.session.WorkflowStatus;
import com.ddd.backend.infrastructure.session.InMemoryAutomationSessionRepository;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

class OverlayGoalRouteGateTest {
    @Test
    void 완성된_예금_goal이_transfer_page에_있으면_overlay를_생성하지_않는다() {
        String sessionId = "session-route-gate";
        var sessions = new InMemoryAutomationSessionRepository();
        sessions.save(AutomationSession.restore(sessionId, "100만 원으로 12개월 예금",
                WorkflowStatus.AI_EXECUTING, Instant.now(), Instant.now(),
                "http://localhost:3000/transfer/accounts", Instant.now()));
        var states = new ConversationStateStore(Duration.ofMinutes(30));
        var mailbox = new SessionMessageMailbox();
        var conversations = new ConversationService(sessions, states, mailbox,
                new ConversationMessagePolicy(), new ConversationEventStore());
        ConversationState state = states.getOrCreate(sessionId);
        state.appendUserMessage("request-1", "message-1", "100만 원으로 12개월 예금 가입을 도와줘",
                Instant.now(), MessageQueueStatus.ACTIVE);
        state.applyGoalPatch(state.goal().goalId(), 0, "message-1",
                new UserGoalPatch(0, "DEPOSIT", new UserGoal.Amount("1000000", "KRW"),
                        new UserGoal.Duration(12, "MONTH"), List.of(), null, null), null);
        var playwright = new DemoAgentBridgeRegistry();
        playwright.put(new DemoAgentBridgeBinding(sessionId, "token", "playwright-page",
                "https://bank.example", Instant.now().plusSeconds(300)));
        var user = new UserBrowserBridgeRegistry();
        user.put(new UserBrowserBridgeBinding(sessionId, "binding", "user-token", "user-page",
                "/transfer/accounts", "https://frontend.example", Instant.now().plusSeconds(300)));
        var eventStore = new ConversationEventStore();
        var events = new ConversationEventPublisher(
                eventStore, mock(SimpMessagingTemplate.class));
        var service = new OverlayTargetService(mock(BrowserSessionManager.class),
                mock(ElementRegistry.class), playwright,
                new OverlayTargetStore(Duration.ofMinutes(2)), events,
                new ConversationMessagePolicy());
        service.setUserBrowserBindings(user);
        service.setConversationGoalRouteGate(conversations, new GoalRouteCompatibilityPolicy());
        var snapshot = new SanitizedDomSnapshot("1.0", "snapshot-1",
                new SanitizedDomSnapshot.PageSnapshot(
                        "http://localhost:3000/transfer/accounts", "이체"), List.of());

        assertThatThrownBy(() -> service.create(
                sessionId, "playwright-page", snapshot, "element-1", "선택하세요."))
                .isInstanceOfSatisfying(OverlayTargetException.class,
                        error -> assertThat(error.error()).isEqualTo(OverlayTargetError.TARGET_NOT_INTERACTABLE));
        assertThat(eventStore.events(sessionId)).isEmpty();
    }
}
