package com.ddd.backend.conversation.bridge;

import com.ddd.backend.config.RestCorsProperties;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

@Service
public final class UserBrowserBridgeService {
    private static final Duration MAX_USER_BROWSER_TTL = Duration.ofMinutes(5);
    private final DemoAgentBridgeRegistry playwrightBindings;
    private final UserBrowserBridgeRegistry browserBindings;
    private final DemoAgentBridgeProperties properties;
    private final RestCorsProperties cors;

    public UserBrowserBridgeService(
            DemoAgentBridgeRegistry playwrightBindings,
            UserBrowserBridgeRegistry browserBindings,
            DemoAgentBridgeProperties properties,
            RestCorsProperties cors
    ) {
        this.playwrightBindings = playwrightBindings;
        this.browserBindings = browserBindings;
        this.properties = properties;
        this.cors = cors;
    }

    public UserBrowserBridgeBinding issue(String sessionId, String origin) {
        if (origin == null || !cors.getAllowedOrigins().contains(origin)) {
            throw new DemoAgentBridgeAuthenticationException();
        }
        DemoAgentBridgeBinding playwright = playwrightBindings.find(sessionId)
                .orElseThrow(DemoAgentBridgeAuthenticationException::new);
        Duration ttl = properties.getTtl();
        if (ttl == null || ttl.isZero() || ttl.isNegative()) {
            throw new IllegalStateException("사용자 Browser bridge TTL이 올바르지 않습니다.");
        }
        if (ttl.compareTo(MAX_USER_BROWSER_TTL) > 0) ttl = MAX_USER_BROWSER_TTL;
        UserBrowserBridgeBinding binding = new UserBrowserBridgeBinding(
                sessionId,
                "browser-binding-" + UUID.randomUUID(),
                UUID.randomUUID().toString(),
                "browser-page-" + UUID.randomUUID(),
                origin,
                Instant.now().plus(ttl));
        browserBindings.put(binding);
        return binding;
    }

    /** Playwright bridge 기능이 꺼진 환경에서는 기존 세션 생성을 방해하지 않는다. */
    public UserBrowserBridgeBinding issueIfAvailable(String sessionId, String origin) {
        return playwrightBindings.find(sessionId).isEmpty() ? null : issue(sessionId, origin);
    }
}
