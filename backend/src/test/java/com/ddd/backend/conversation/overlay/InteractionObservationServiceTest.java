package com.ddd.backend.conversation.overlay;

import com.ddd.backend.api.dto.conversation.InteractionObservationRequest;
import com.ddd.backend.automation.dom.ElementRegistry;
import com.ddd.backend.automation.dom.SanitizedDomSnapshot;
import com.ddd.backend.automation.dom.SanitizedDomSnapshotService;
import com.ddd.backend.automation.session.BrowserCommand;
import com.ddd.backend.automation.session.BrowserSessionManager;
import com.ddd.backend.conversation.bridge.DemoAgentBridgeBinding;
import com.ddd.backend.conversation.bridge.DemoAgentBridgeRegistry;
import com.ddd.backend.conversation.event.ConversationEventPublisher;
import com.ddd.backend.conversation.event.ConversationEventStore;
import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.domain.session.WorkflowStatus;
import com.ddd.backend.infrastructure.session.InMemoryAutomationSessionRepository;
import com.ddd.backend.conversation.gate.ConversationProtectedGateRegistry;
import com.ddd.backend.conversation.agent.ConversationAgentDecision;
import com.ddd.backend.conversation.agent.ConversationInteractionMode;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class InteractionObservationServiceTest {
    private static final Instant NOW = Instant.parse("2026-09-06T12:00:00Z");

    @Test
    void DOM변화를_확인한뒤_clear_event와_observed_event를_발행하고_한번만_재개한다() throws Exception {
        BrowserSessionManager browsers = mock(BrowserSessionManager.class);
        ElementRegistry elements = mock(ElementRegistry.class);
        SanitizedDomSnapshotService snapshots = mock(SanitizedDomSnapshotService.class);
        Page page = mock(Page.class);
        Locator locator = mock(Locator.class);
        when(locator.isVisible()).thenReturn(true);
        when(locator.isEnabled()).thenReturn(true);
        when(locator.evaluate(anyString())).thenReturn(Map.of("x", 120, "y", 240, "width", 180, "height", 56));
        when(elements.resolveLocator(page, "session-1", "el-secret")).thenReturn(locator);
        when(browsers.execute(eq("session-1"), any(Duration.class), any())).thenAnswer(invocation -> {
            BrowserCommand<?> command = invocation.getArgument(2);
            return command.execute(page);
        });

        SanitizedDomSnapshot source = snapshot("snap-1", "선택 전");
        SanitizedDomSnapshot resulting = snapshot("snap-2", "선택 완료");
        when(snapshots.createSnapshot("session-1")).thenReturn(resulting);
        DemoAgentBridgeRegistry bridges = new DemoAgentBridgeRegistry();
        bridges.put(new DemoAgentBridgeBinding("session-1", "secret", "page-1",
                "http://127.0.0.1:5190", Instant.now().plusSeconds(300)));
        OverlayTargetStore targets = new OverlayTargetStore(Duration.ofMinutes(2), Clock.fixed(NOW, ZoneOffset.UTC));
        PublicOverlayTarget target = target();
        var eventStore = new ConversationEventStore();
        var publisher = new ConversationEventPublisher(eventStore, mock(SimpMessagingTemplate.class));
        targets.setClearListener((value, reason) -> publisher.overlayClear(value, reason, NOW));
        targets.replace(target, "el-secret", DomSnapshotFingerprint.of(source));
        var sessions = new InMemoryAutomationSessionRepository();
        AutomationSession session = AutomationSession.restore(
                "session-1", "예금 가입", WorkflowStatus.SESSION_CREATED,
                NOW, NOW, null, NOW);
        session.transitionTo(WorkflowStatus.USER_DECISION_REQUIRED);
        sessions.save(session);
        ConversationObservationResumePort resume = mock(ConversationObservationResumePort.class);
        @SuppressWarnings("unchecked") ObjectProvider<ConversationObservationResumePort> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(resume);
        var service = new InteractionObservationService(bridges, targets, browsers, elements,
                snapshots, sessions, publisher, provider);
        var request = new InteractionObservationRequest("request-1", "target-1", "snap-1",
                "USER_CLICK", NOW);

        var accepted = service.observe("session-1", "secret", "page-1",
                "http://127.0.0.1:5190", request);

        assertThat(accepted.status()).isEqualTo("OBSERVATION_ACCEPTED");
        assertThat(sessions.findById("session-1")).get().extracting(AutomationSession::getStatus)
                .isEqualTo(WorkflowStatus.AI_EXECUTING);
        assertThat(eventStore.events("session-1")).extracting(event -> event.eventType())
                .containsExactly("OVERLAY_CLEAR", "USER_ACTION_OBSERVED");
        verify(resume, times(1)).resumeOnce(eq("session-1"),
                argThat(value -> value.targetId().equals("target-1") && value.consumedAt() != null),
                eq(resulting));

        assertThatThrownBy(() -> service.observe("session-1", "secret", "page-1",
                "http://127.0.0.1:5190", request))
                .isInstanceOfSatisfying(OverlayTargetException.class,
                        error -> assertThat(error.error()).isEqualTo(OverlayTargetError.OBSERVATION_DUPLICATE_REQUEST));
        verify(resume, times(1)).resumeOnce(anyString(), any(), any());
    }

    @Test
    void 보호_gate가_활성화되면_workflow상태와_무관하게_observation을_차단한다() {
        DemoAgentBridgeRegistry bridges = new DemoAgentBridgeRegistry();
        bridges.put(new DemoAgentBridgeBinding("session-1", "secret", "page-1",
                "http://127.0.0.1:5190", Instant.now().plusSeconds(300)));
        OverlayTargetStore targets = mock(OverlayTargetStore.class);
        var sessions = new InMemoryAutomationSessionRepository();
        AutomationSession session = AutomationSession.restore(
                "session-1", "예금 가입", WorkflowStatus.USER_DECISION_REQUIRED,
                NOW, NOW, null, NOW);
        sessions.save(session);
        @SuppressWarnings("unchecked") ObjectProvider<ConversationObservationResumePort> provider = mock(ObjectProvider.class);
        var service = new InteractionObservationService(bridges, targets,
                mock(BrowserSessionManager.class), mock(ElementRegistry.class),
                mock(SanitizedDomSnapshotService.class), sessions,
                mock(ConversationEventPublisher.class), provider);
        ConversationProtectedGateRegistry gates = new ConversationProtectedGateRegistry();
        gates.activate("session-1", new ConversationAgentDecision(
                "request-0", "message-0", "goal-1", 1,
                ConversationInteractionMode.RISK_WARNING, "위험 확인이 필요합니다.",
                1.0, "RISK", null, "snap-0", null, null, null));
        service.setProtectedGates(gates);
        var request = new InteractionObservationRequest(
                "request-1", "target-1", "snap-1", "USER_CLICK", NOW);

        assertThatThrownBy(() -> service.observe("session-1", "secret", "page-1",
                "http://127.0.0.1:5190", request))
                .isInstanceOfSatisfying(OverlayTargetException.class,
                        error -> assertThat(error.error()).isEqualTo(OverlayTargetError.TARGET_NOT_INTERACTABLE));
        verifyNoInteractions(targets);
    }

    private PublicOverlayTarget target() {
        return new PublicOverlayTarget("target-1", "session-1", "page-1", "snap-1",
                OverlayCoordinateSpace.VIEWPORT_CSS_PX,
                new PublicOverlayTarget.Rectangle(120, 240, 180, 56),
                new PublicOverlayTarget.Viewport(1280, 720), "button", "12개월 상품 선택",
                "이 버튼을 직접 눌러 주세요.", OverlayActionMode.GUIDE_USER_CLICK,
                NOW, NOW.plusSeconds(120), null);
    }

    private SanitizedDomSnapshot snapshot(String id, String text) {
        return new SanitizedDomSnapshot("1.0", id,
                new SanitizedDomSnapshot.PageSnapshot("https://redacted.invalid", "예금"),
                List.of(new SanitizedDomSnapshot.ElementSnapshot("el-any", "button", "button", text,
                        null, null, null, true, true,
                        new SanitizedDomSnapshot.BoundingBoxSnapshot(120, 240, 180, 56),
                        SanitizedDomSnapshot.SecurityPolicy.USER_DECISION)));
    }
}
