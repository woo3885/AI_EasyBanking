package com.ddd.backend.conversation.agent;

import com.ddd.backend.automation.dom.SanitizedDomSnapshot;
import com.ddd.backend.conversation.*;
import com.ddd.backend.conversation.bridge.UserBrowserBridgeBinding;
import com.ddd.backend.conversation.bridge.UserBrowserBridgeRegistry;
import com.ddd.backend.conversation.event.ConversationEvent;
import com.ddd.backend.conversation.event.ConversationEventPublisher;
import com.ddd.backend.conversation.event.ConversationEventStore;
import com.ddd.backend.conversation.navigation.*;
import com.ddd.backend.conversation.goal.GoalRouteCompatibilityPolicy;
import com.ddd.backend.conversation.goal.UserGoal;
import com.ddd.backend.conversation.goal.UserGoalPatch;
import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.domain.session.WorkflowStatus;
import com.ddd.backend.infrastructure.session.InMemoryAutomationSessionRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.Instant;
import java.time.Duration;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ConversationNavigationCoordinatorProductionTest {
    @Test
    void agent_navigation판단이_production_adapter를_거쳐_event를_한번만_발행한다() {
        String sessionId = "session-nav-coordinator";
        var sessions = new InMemoryAutomationSessionRepository();
        sessions.save(AutomationSession.restore(sessionId, "예금", WorkflowStatus.AI_EXECUTING,
                Instant.now(), Instant.now(), null, Instant.now()));
        var stateStore = new ConversationStateStore(Duration.ofMinutes(30));
        var mailbox = new SessionMessageMailbox();
        var eventStore = new ConversationEventStore();
        var conversations = new ConversationService(sessions, stateStore, mailbox,
                new ConversationMessagePolicy(), eventStore);
        ConversationState state = stateStore.getOrCreate(sessionId);
        state.appendUserMessage("request-1", "message-1", "100만 원으로 12개월 예금 가입을 도와줘",
                Instant.now(), MessageQueueStatus.ACTIVE);
        state.applyGoalPatch(state.goal().goalId(), 0, "message-1",
                new UserGoalPatch(0, "DEPOSIT", new UserGoal.Amount("1000000", "KRW"),
                        new UserGoal.Duration(12, "MONTH"), List.of(), null, null), null);
        var events = new ConversationEventPublisher(eventStore, mock(SimpMessagingTemplate.class));
        var userBindings = new UserBrowserBridgeRegistry();
        userBindings.put(new UserBrowserBridgeBinding(sessionId, "binding-1", "token-1", "page-1",
                "/transfer/accounts", "https://frontend.example", Instant.now().plusSeconds(600)));
        @SuppressWarnings("unchecked") ObjectProvider<BrowserPageReadyResumePort> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(mock(BrowserPageReadyResumePort.class));
        var navigationService = new BrowserNavigationService(sessions, userBindings,
                new PendingBrowserNavigationRegistry(), new BrowserNavigationRoutePolicy(), events, provider);
        var decisionRegistry = new NavigationDecisionRegistry();
        var adapter = new ConversationNavigationAdapter(navigationService,
                new BrowserSemanticRouteMapper(), decisionRegistry, userBindings,
                new GoalRouteCompatibilityPolicy());
        var validator = new ConversationAgentContractValidator(new ConversationMessagePolicy());
        var coordinator = new ConversationAgentCoordinator(conversations, mailbox, sessions,
                mock(ConversationAgentClient.class), validator, events);
        coordinator.setNavigationAdapter(adapter);
        var snapshot = new SanitizedDomSnapshot("1.0", "snapshot-1",
                new SanitizedDomSnapshot.PageSnapshot("https://demo.local/", "Demo"), List.of());
        var decision = new ConversationAgentDecision(
                "request-1", "message-1", state.goal().goalId(), state.goalRevision(),
                ConversationInteractionMode.NAVIGATION_REQUIRED,
                "예금 상품 화면으로 이동합니다.", 0.95, "ROUTE_REQUIRED", "PAGE_READY",
                "snapshot-1", null, null, null,
                new ConversationAgentDecision.NavigationCandidate("decision-1",
                        BrowserSemanticRoute.DEPOSIT_PRODUCTS, BrowserNavigationMode.SPA_PUSH));

        coordinator.applyObservedDomDecision(sessionId, validator.validate(
                new ConversationAgentRequest(sessionId, "request-1", "message-1", state.sequence(),
                        state.goal(), new ConversationAgentRequest.UserMessage(
                                "100만 원으로 12개월 예금 가입을 도와줘", null),
                        new ConversationAgentRequest.SnapshotContext("snapshot-1", "playwright-page", snapshot)),
                decision), snapshot);
        coordinator.applyObservedDomDecision(sessionId, decision, snapshot);

        assertThat(sessions.findById(sessionId).orElseThrow().getStatus())
                .isEqualTo(WorkflowStatus.PAGE_LOADING);
        assertThat(eventStore.events(sessionId).stream()
                .filter(event -> event.eventType().equals("NAVIGATION_REQUIRED")))
                .hasSize(1);
        assertThat(eventStore.events(sessionId)).extracting(ConversationEvent::eventType)
                .contains("NAVIGATION_REQUIRED");
    }
}
