package com.ddd.backend.conversation.overlay;

import com.ddd.backend.automation.dom.ElementRegistry;
import com.ddd.backend.automation.dom.SanitizedDomSnapshot;
import com.ddd.backend.automation.session.BrowserCommand;
import com.ddd.backend.automation.session.BrowserSessionManager;
import com.ddd.backend.conversation.ConversationMessagePolicy;
import com.ddd.backend.conversation.bridge.DemoAgentBridgeBinding;
import com.ddd.backend.conversation.bridge.DemoAgentBridgeRegistry;
import com.ddd.backend.conversation.bridge.UserBrowserBridgeBinding;
import com.ddd.backend.conversation.bridge.UserBrowserBridgeRegistry;
import com.ddd.backend.conversation.event.ConversationEventPublisher;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class UserBrowserOverlayIdentityTest {
    @Test
    void target은_Playwright가_아닌_현재_userBrowser_pageIdentity로_발행한다() throws Exception {
        BrowserSessionManager browsers = mock(BrowserSessionManager.class);
        ElementRegistry elements = mock(ElementRegistry.class);
        Page page = mock(Page.class);
        Locator locator = mock(Locator.class);
        when(locator.isVisible()).thenReturn(true);
        when(locator.isEnabled()).thenReturn(true);
        when(locator.getAttribute("data-ddd-public-target")).thenReturn("deposit-product-12m-select");
        when(locator.evaluate(anyString())).thenReturn(Map.of(
                "x", 1, "y", 2, "width", 100, "height", 30,
                "viewportWidth", 1280, "viewportHeight", 720, "topLevel", true));
        when(elements.resolveLocator(page, "session-1", "element-1")).thenReturn(locator);
        when(browsers.execute(eq("session-1"), any(Duration.class), any())).thenAnswer(invocation -> {
            BrowserCommand<?> command = invocation.getArgument(2);
            return command.execute(page);
        });
        var playwright = new DemoAgentBridgeRegistry();
        playwright.put(new DemoAgentBridgeBinding(
                "session-1", "playwright-token", "playwright-page", "https://bank.example",
                Instant.now().plusSeconds(300)));
        var user = new UserBrowserBridgeRegistry();
        user.put(new UserBrowserBridgeBinding(
                "session-1", "binding-1", "user-token", "user-page", "https://frontend.example",
                Instant.now().plusSeconds(300)));
        var targets = new OverlayTargetStore(
                Duration.ofMinutes(2), Clock.fixed(Instant.now(), ZoneOffset.UTC));
        var service = new OverlayTargetService(
                browsers, elements, playwright, targets,
                mock(ConversationEventPublisher.class), new ConversationMessagePolicy());
        service.setUserBrowserBindings(user);
        var snapshot = new SanitizedDomSnapshot(
                "1.0", "snapshot-1", new SanitizedDomSnapshot.PageSnapshot("redacted", "예금"),
                List.of(new SanitizedDomSnapshot.ElementSnapshot(
                        "element-1", "button", "button", "12개월", null, null, null,
                        true, true, null, new SanitizedDomSnapshot.BoundingBoxSnapshot(1, 2, 100, 30),
                        SanitizedDomSnapshot.SecurityPolicy.USER_DECISION,
                        "deposit-product-12m-select")));

        PublicOverlayTarget target = service.create(
                "session-1", "playwright-page", snapshot, "element-1", "선택해 주세요.");

        assertThat(target.pageIdentity()).isEqualTo("user-page");
        assertThat(target.pageIdentity()).isNotEqualTo("playwright-page");
        assertThat(target.contractVersion()).isEqualTo(2);
        assertThat(target.locator().publicTargetKey()).isEqualTo("deposit-product-12m-select");
    }
}
