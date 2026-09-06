package com.ddd.backend.conversation.overlay;

import com.ddd.backend.automation.BrowserActionPolicyContextResolver;
import com.ddd.backend.automation.dom.*;
import com.ddd.backend.automation.session.BrowserSessionManager;
import com.ddd.backend.automation.worker.PlaywrightWorker;
import com.ddd.backend.conversation.*;
import com.ddd.backend.conversation.agent.*;
import com.ddd.backend.conversation.bridge.*;
import com.ddd.backend.conversation.event.*;
import com.ddd.backend.conversation.goal.*;
import com.ddd.backend.conversation.navigation.NavigationDecisionContext;
import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.domain.session.WorkflowStatus;
import com.ddd.backend.infrastructure.session.InMemoryAutomationSessionRepository;
import com.microsoft.playwright.Route;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class ProductTargetFingerprintProductionFlowTest {
    @Test
    void destination_snapshot의_상품명_fingerprint로_overlay를_한번_발행한다() {
        String sessionId = "product-target-production";
        try (PlaywrightWorker worker = new PlaywrightWorker();
             BrowserSessionManager browsers = new BrowserSessionManager(worker)) {
            browsers.createSession(sessionId);
            browsers.execute(sessionId, Duration.ofSeconds(5), page -> {
                page.route("**/deposit/products", route -> route.fulfill(new Route.FulfillOptions()
                        .setStatus(200).setContentType("text/html; charset=utf-8").setBody("""
                        <article><h2>12개월 정기예금</h2>
                          <button onclick="document.body.dataset.selected='basic'">이 상품 선택</button>
                        </article>
                        <article><h2>우대금리 정기예금</h2>
                          <button onclick="document.body.dataset.selected='preferred'">이 상품 선택</button>
                        </article>
                        """)));
                page.navigate("http://127.0.0.1:5190/deposit/products");
                return null;
            });
            DomSanitizer sanitizer = new DomSanitizer();
            ElementFingerprintExtractor fingerprints = new ElementFingerprintExtractor();
            ElementRegistry elements = new ElementRegistry(sanitizer, fingerprints);
            var snapshots = new SanitizedDomSnapshotService(browsers,
                    new InteractiveElementExtractor(browsers, fingerprints),
                    new BrowserActionPolicyContextResolver(browsers), sanitizer, elements);
            var sessions = new InMemoryAutomationSessionRepository();
            sessions.save(AutomationSession.restore(sessionId, "100만 원으로 12개월 예금",
                    WorkflowStatus.AI_EXECUTING, Instant.now(), Instant.now(),
                    "http://127.0.0.1:5190/deposit/products", Instant.now()));
            var states = new ConversationStateStore(Duration.ofMinutes(30));
            var mailbox = new SessionMessageMailbox();
            var eventStore = new ConversationEventStore();
            var conversations = new ConversationService(sessions, states, mailbox,
                    new ConversationMessagePolicy(), eventStore);
            ConversationState state = states.getOrCreate(sessionId);
            state.appendUserMessage("request-1", "message-1",
                    "100만 원으로 12개월 예금 가입을 도와줘", Instant.now(), MessageQueueStatus.ACTIVE);
            state.applyGoalPatch(state.goal().goalId(), 0, "message-1",
                    new UserGoalPatch(0, "DEPOSIT", new UserGoal.Amount("1000000", "KRW"),
                            new UserGoal.Duration(12, "MONTH"), List.of(), null, null), null);
            var playwrightBindings = new DemoAgentBridgeRegistry();
            playwrightBindings.put(new DemoAgentBridgeBinding(sessionId, "token", "playwright-page",
                    "http://127.0.0.1:5190", Instant.now().plusSeconds(300)));
            var userBindings = new UserBrowserBridgeRegistry();
            userBindings.put(new UserBrowserBridgeBinding(sessionId, "binding", "user-token",
                    "destination-page", "/deposit/products", "http://127.0.0.1:5190",
                    Instant.now().plusSeconds(300)));
            var events = new ConversationEventPublisher(eventStore, mock(SimpMessagingTemplate.class));
            ConversationAgentClient client = request -> {
                var target = request.snapshot().sanitizedDomSnapshot().elements().stream()
                        .filter(element -> "우대금리 정기예금".equals(element.text()))
                        .findFirst().orElseThrow();
                return new ConversationAgentDecision(request.requestId(), request.requestMessageId(),
                        request.goal().goalId(), request.goal().revision(), ConversationInteractionMode.GUIDE_USER,
                        "상품을 선택해 주세요.", 1.0, "USER_ACTION_REQUIRED", "DOM_CHANGE",
                        request.snapshot().sourceSnapshotId(), null, null,
                        new ConversationAgentDecision.ActionCandidate("WAIT_FOR_USER", target.elementId(),
                                "button", target.text(), "상품을 선택해 주세요."));
            };
            var validator = new ConversationAgentContractValidator(new ConversationMessagePolicy());
            var domDecisions = new ConversationAgentDomDecisionService(
                    snapshots, playwrightBindings, client, validator);
            var targets = new OverlayTargetStore(Duration.ofMinutes(2));
            var overlay = new OverlayTargetService(
                    browsers, elements, playwrightBindings, targets, events, new ConversationMessagePolicy());
            ReflectionTestUtils.invokeMethod(overlay, "setUserBrowserBindings", userBindings);
            ReflectionTestUtils.invokeMethod(overlay, "setConversationGoalRouteGate",
                    conversations, new GoalRouteCompatibilityPolicy());
            var coordinator = new ConversationAgentCoordinator(
                    conversations, mailbox, sessions, client, validator, events);
            ReflectionTestUtils.invokeMethod(coordinator, "setOverlayTargetService", overlay);
            NavigationDecisionContext context = new NavigationDecisionContext(sessionId, "decision-1",
                    "request-1", "message-1", state.goalRevision(), "source-before-navigation",
                    com.ddd.backend.conversation.navigation.BrowserSemanticRoute.DEPOSIT_PRODUCTS,
                    com.ddd.backend.conversation.navigation.BrowserNavigationMode.SPA_PUSH,
                    "navigation-1", NavigationDecisionContext.ResumeStatus.IN_PROGRESS);

            var result = domDecisions.decideAfterNavigation(sessionId, context, state);
            coordinator.applyObservedDomDecision(sessionId, result.decision(), result.snapshot());

            assertThat(eventStore.events(sessionId)).extracting(ConversationEvent::eventType)
                    .containsExactly("OVERLAY_TARGET", "AI_MESSAGE");
            PublicOverlayTarget target = targets.active(sessionId, "destination-page").orElseThrow();
            assertThat(target.pageIdentity()).isEqualTo("destination-page");
            assertThat(target.sourceSnapshotId()).isEqualTo(result.snapshot().snapshotId());
            assertThat(target.label()).isEqualTo("우대금리 정기예금");
        }
    }
}
