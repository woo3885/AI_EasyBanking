package com.ddd.backend.conversation.bridge;

import com.ddd.backend.config.RestCorsProperties;
import com.ddd.backend.domain.session.AutomationSessionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.net.URI;
import java.util.UUID;

@Service
public final class UserBrowserBridgeService {
    private static final Duration MAX_USER_BROWSER_TTL = Duration.ofMinutes(5);
    private final DemoAgentBridgeRegistry playwrightBindings;
    private final UserBrowserBridgeRegistry browserBindings;
    private final DemoAgentBridgeProperties properties;
    private final RestCorsProperties cors;
    private AutomationSessionRepository sessions;

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

    @Autowired(required = false)
    void setSessions(AutomationSessionRepository sessions) {
        this.sessions = sessions;
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
                currentRoute(sessionId),
                origin,
                Instant.now().plus(ttl));
        browserBindings.put(binding);
        return binding;
    }

    private String currentRoute(String sessionId) {
        if (sessions == null) return null;
        String currentUrl = sessions.findById(sessionId)
                .map(session -> session.getCurrentUrl()).orElse(null);
        if (currentUrl == null || currentUrl.isBlank()) return null;
        try {
            String path = URI.create(currentUrl).getPath();
            return path == null || path.isBlank() ? "/" : path;
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException("세션의 현재 URL을 route로 변환할 수 없습니다.");
        }
    }

    /** Playwright bridge 기능이 꺼진 환경에서는 기존 세션 생성을 방해하지 않는다. */
    public UserBrowserBridgeBinding issueIfAvailable(String sessionId, String origin) {
        return playwrightBindings.find(sessionId).isEmpty() ? null : issue(sessionId, origin);
    }
}
