package com.ddd.backend.conversation.navigation;

import com.ddd.backend.api.dto.conversation.BrowserPageReadyRequest;
import com.ddd.backend.conversation.bridge.UserBrowserBridgeBinding;
import com.ddd.backend.conversation.bridge.UserBrowserBridgeRegistry;
import com.ddd.backend.conversation.event.ConversationEvent;
import com.ddd.backend.conversation.event.ConversationEventPublisher;
import com.ddd.backend.conversation.event.ConversationEventStore;
import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.domain.session.WorkflowStatus;
import com.ddd.backend.infrastructure.session.InMemoryAutomationSessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class BrowserNavigationProductionFlowTest {
    private final String sessionId = "session-navigation";
    private final String origin = "https://frontend.example";
    private final String token = "browser-secret";
    private final String bindingId = "browser-binding-1";
    private final String sourcePage = "browser-page-source";
    private InMemoryAutomationSessionRepository sessions;
    private UserBrowserBridgeRegistry bindings;
    private ConversationEventStore eventStore;
    private BrowserPageReadyResumePort resume;
    private BrowserNavigationService service;

    @BeforeEach
    void setUp() {
        sessions = new InMemoryAutomationSessionRepository();
        sessions.save(AutomationSession.restore(sessionId, "예금 가입", WorkflowStatus.AI_EXECUTING,
                Instant.now(), Instant.now(), null, Instant.now()));
        bindings = new UserBrowserBridgeRegistry();
        bindings.put(new UserBrowserBridgeBinding(sessionId, bindingId, token, sourcePage,
                origin, Instant.now().plusSeconds(600)));
        eventStore = new ConversationEventStore();
        var publisher = new ConversationEventPublisher(eventStore, mock(SimpMessagingTemplate.class));
        resume = mock(BrowserPageReadyResumePort.class);
        @SuppressWarnings("unchecked") ObjectProvider<BrowserPageReadyResumePort> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(resume);
        service = new BrowserNavigationService(sessions, bindings,
                new PendingBrowserNavigationRegistry(), new BrowserNavigationRoutePolicy(),
                publisher, provider);
    }

    @Test
    void navigation부터_pageReady_identity회전과_exactlyOnce재개까지_연결한다() {
        PendingBrowserNavigation navigation = service.requireNavigation(
                sessionId, "/deposit/products", 1, BrowserNavigationMode.SPA_PUSH,
                "예금 상품 화면으로 이동해 주세요.");

        var response = service.pageReady(sessionId, token, origin, bindingId, sourcePage,
                request("request-ready-1", navigation));

        assertThat(navigation.sourcePageIdentity()).isNotEqualTo(navigation.destinationPageIdentity());
        assertThat(response.status()).isEqualTo("PAGE_READY_ACCEPTED");
        assertThat(response.pageIdentity()).isEqualTo(navigation.destinationPageIdentity());
        assertThat(bindings.find(sessionId)).get()
                .extracting(UserBrowserBridgeBinding::pageIdentity)
                .isEqualTo(navigation.destinationPageIdentity());
        assertThat(bindings.find(sessionId).orElseThrow().currentRoute())
                .isEqualTo("/deposit/products");
        assertThat(eventStore.events(sessionId)).extracting(ConversationEvent::eventType)
                .containsExactly("NAVIGATION_REQUIRED", "PAGE_READY_OBSERVED");
        org.mockito.Mockito.verify(resume).resumeOnce(navigation.withStatus(PendingBrowserNavigation.Status.CONSUMED));

        assertThatThrownBy(() -> service.pageReady(
                sessionId, token, origin, bindingId, sourcePage,
                request("request-ready-2", navigation)))
                .isInstanceOfSatisfying(BrowserNavigationException.class,
                        error -> assertThat(error.error()).isEqualTo(BrowserNavigationError.PAGE_READY_ALREADY_ACCEPTED));
    }

    @Test
    void binding_route_identity_revision_mismatch를_각각_차단한다() {
        PendingBrowserNavigation navigation = service.requireNavigation(
                sessionId, "/deposit/products", 3, BrowserNavigationMode.SPA_REPLACE, "이동");

        assertThatThrownBy(() -> service.pageReady(
                sessionId, "wrong-token", origin, bindingId, sourcePage,
                request("request-wrong-binding", navigation)))
                .isInstanceOfSatisfying(BrowserNavigationException.class,
                        error -> assertThat(error.error()).isEqualTo(BrowserNavigationError.BROWSER_BINDING_MISMATCH));
        assertThatThrownBy(() -> service.pageReady(
                sessionId, token, origin, bindingId, sourcePage,
                new BrowserPageReadyRequest("request-wrong-route", navigation.navigationId(),
                        sourcePage, navigation.destinationPageIdentity(), 3, "/transfer/accounts",
                        1280, 720, 2.0)))
                .isInstanceOfSatisfying(BrowserNavigationException.class,
                        error -> assertThat(error.error()).isEqualTo(BrowserNavigationError.NAVIGATION_ROUTE_MISMATCH));
        assertThatThrownBy(() -> new BrowserNavigationRoutePolicy().requireAllowed("https://evil.example/a"))
                .isInstanceOf(BrowserNavigationException.class);
    }

    @Test
    void protected와_terminal_workflow에서는_navigation을_생성하지_않는다() {
        for (WorkflowStatus status : new WorkflowStatus[]{
                WorkflowStatus.SECURE_INPUT_REQUIRED, WorkflowStatus.RISK_WARNING,
                WorkflowStatus.FINAL_CONFIRMATION_REQUIRED, WorkflowStatus.COMPLETED,
                WorkflowStatus.CANCELLED, WorkflowStatus.TERMINATED}) {
            sessions.save(AutomationSession.restore(sessionId, "예금 가입", status,
                    Instant.now(), Instant.now(), null, Instant.now()));
            assertThatThrownBy(() -> service.requireNavigation(
                    sessionId, "/deposit/products", 1, BrowserNavigationMode.SPA_PUSH, "이동"))
                    .isInstanceOfSatisfying(BrowserNavigationException.class,
                            error -> assertThat(error.error()).isEqualTo(BrowserNavigationError.NAVIGATION_WORKFLOW_CONFLICT));
        }
    }

    private BrowserPageReadyRequest request(String requestId, PendingBrowserNavigation navigation) {
        return new BrowserPageReadyRequest(requestId, navigation.navigationId(),
                navigation.sourcePageIdentity(), navigation.destinationPageIdentity(),
                navigation.routeRevision(), navigation.destinationRoute(), 1280, 720, 2.0);
    }
}
