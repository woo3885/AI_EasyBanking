package com.ddd.backend.conversation.bridge;

import com.ddd.backend.config.RestCorsProperties;
import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.domain.session.WorkflowStatus;
import com.ddd.backend.infrastructure.session.InMemoryAutomationSessionRepository;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class UserBrowserBridgeServiceTest {
    @Test
    void backendPlaywrightBinding과_분리된_userBrowserBinding을_허용된_origin에_발급한다() {
        var playwright = new DemoAgentBridgeRegistry();
        playwright.put(new DemoAgentBridgeBinding(
                "session-1", "playwright-secret", "page-1", "https://bank.example",
                Instant.now().plusSeconds(300)));
        var browser = new UserBrowserBridgeRegistry();
        var properties = new DemoAgentBridgeProperties();
        properties.setTtl(Duration.ofMinutes(5));
        var cors = new RestCorsProperties();
        cors.setAllowedOrigins(List.of("https://frontend.example"));
        var service = new UserBrowserBridgeService(playwright, browser, properties, cors);
        var sessions = new InMemoryAutomationSessionRepository();
        sessions.save(AutomationSession.restore("session-1", "예금", WorkflowStatus.AI_EXECUTING,
                Instant.now(), Instant.now(), "http://localhost:3000/transfer/accounts", Instant.now()));
        service.setSessions(sessions);

        UserBrowserBridgeBinding issued = service.issue("session-1", "https://frontend.example");

        assertThat(issued.pageIdentity()).isNotEqualTo("page-1");
        assertThat(issued.bridgeToken()).isNotEqualTo("playwright-secret");
        assertThat(issued.currentRoute()).isEqualTo("/transfer/accounts");
        assertThat(browser.require("session-1", issued.bridgeToken(),
                "https://frontend.example", issued.browserBindingId(), issued.pageIdentity())).isEqualTo(issued);
    }

    @Test
    void allowlist밖의_origin에는_binding을_발급하지_않는다() {
        var playwright = new DemoAgentBridgeRegistry();
        playwright.put(new DemoAgentBridgeBinding(
                "session-1", "playwright-secret", "page-1", "https://bank.example",
                Instant.now().plusSeconds(300)));
        var cors = new RestCorsProperties();
        cors.setAllowedOrigins(List.of("https://frontend.example"));
        var service = new UserBrowserBridgeService(
                playwright, new UserBrowserBridgeRegistry(), new DemoAgentBridgeProperties(), cors);

        assertThatThrownBy(() -> service.issue("session-1", "https://evil.example"))
                .isInstanceOf(DemoAgentBridgeAuthenticationException.class);
    }
}
