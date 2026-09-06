package com.ddd.backend.conversation.overlay;

import com.ddd.backend.automation.session.BrowserCommand;
import com.ddd.backend.automation.dom.ElementRegistry;
import com.ddd.backend.automation.dom.SanitizedDomSnapshot;
import com.ddd.backend.automation.session.BrowserSessionManager;
import com.ddd.backend.conversation.ConversationMessagePolicy;
import com.ddd.backend.conversation.bridge.DemoAgentBridgeBinding;
import com.ddd.backend.conversation.bridge.DemoAgentBridgeRegistry;
import com.ddd.backend.conversation.event.ConversationEventPublisher;
import com.ddd.backend.conversation.navigation.PageReadyResumeError;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class OverlayEventPublishFailureTest {
    @Test
    void event_발행_실패시_public_target을_정리하고_domain_reason을_보존한다() {
        BrowserSessionManager browsers = mock(BrowserSessionManager.class);
        ElementRegistry elements = mock(ElementRegistry.class);
        Page page = mock(Page.class);
        Locator locator = mock(Locator.class);
        when(locator.isVisible()).thenReturn(true);
        when(locator.isEnabled()).thenReturn(true);
        when(locator.evaluate(anyString())).thenReturn(Map.of(
                "x", 1, "y", 2, "width", 100, "height", 30,
                "viewportWidth", 1280, "viewportHeight", 720, "topLevel", true));
        when(elements.resolveLocator(any(), anyString(), anyString())).thenReturn(locator);
        when(browsers.execute(anyString(), any(Duration.class), any())).thenAnswer(invocation -> {
            BrowserCommand<?> command = invocation.getArgument(2);
            return command.execute(page);
        });
        var bridges = new DemoAgentBridgeRegistry();
        bridges.put(new DemoAgentBridgeBinding("session-1", "token", "playwright-page",
                "https://bank.example", Instant.now().plusSeconds(300)));
        var targets = new OverlayTargetStore(Duration.ofMinutes(2));
        ConversationEventPublisher events = mock(ConversationEventPublisher.class);
        doThrow(new IllegalStateException("transport failed"))
                .when(events).overlayTarget(any(), any(Instant.class));
        var service = new OverlayTargetService(
                browsers, elements, bridges, targets, events, new ConversationMessagePolicy());
        var snapshot = new SanitizedDomSnapshot("1.0", "snap-test",
                new SanitizedDomSnapshot.PageSnapshot("http://localhost/deposit/products", "상품"),
                List.of(new SanitizedDomSnapshot.ElementSnapshot(
                        "el-test-001", "button", "button", "우대금리 정기예금", null,
                        null, null, true, true, null,
                        SanitizedDomSnapshot.SecurityPolicy.USER_DECISION)));

        assertThatThrownBy(() -> service.create(
                "session-1", "playwright-page", snapshot, "el-test-001", "선택하세요."))
                .isInstanceOfSatisfying(GuideUserMaterializationException.class,
                        error -> assertThat(error.error())
                                .isEqualTo(PageReadyResumeError.OVERLAY_EVENT_PUBLISH_FAILED));
        assertThat(targets.active("session-1", "playwright-page")).isEmpty();
    }
}
