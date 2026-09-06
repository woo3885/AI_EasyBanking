package com.ddd.backend.conversation.bridge;

import com.ddd.backend.automation.session.BrowserSessionManager;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

@Service
public final class DemoAgentBridgeService {
    private static final Duration BOOTSTRAP_TIMEOUT = Duration.ofSeconds(5);
    private final BrowserSessionManager browserSessions;
    private final DemoAgentBridgeRegistry registry;
    private final DemoAgentBridgeProperties properties;

    public DemoAgentBridgeService(
            BrowserSessionManager browserSessions,
            DemoAgentBridgeRegistry registry,
            DemoAgentBridgeProperties properties
    ) {
        this.browserSessions = browserSessions;
        this.registry = registry;
        this.properties = properties;
    }

    public DemoAgentBridgeBinding bootstrap(String sessionId) {
        if (!properties.isEnabled()) return null;
        String currentUrl = browserSessions.currentUrl(sessionId);
        String origin = origin(currentUrl);
        if (!properties.getAllowedOrigins().contains(origin)) {
            throw new IllegalStateException("Demo Agent bridge origin이 allowlist에 없습니다.");
        }
        Duration ttl = properties.getTtl();
        if (ttl == null || ttl.isZero() || ttl.isNegative()) {
            throw new IllegalStateException("Demo Agent bridge TTL이 올바르지 않습니다.");
        }
        DemoAgentBridgeBinding binding = new DemoAgentBridgeBinding(
                sessionId,
                UUID.randomUUID().toString(),
                "page-" + UUID.randomUUID(),
                origin,
                Instant.now().plus(ttl));
        String script = bootstrapScript(binding);
        browserSessions.execute(sessionId, BOOTSTRAP_TIMEOUT, page -> {
            page.addInitScript(script);
            page.evaluate(script);
            return null;
        });
        registry.put(binding);
        return binding;
    }

    static String bootstrapScript(DemoAgentBridgeBinding binding) {
        return """
                (() => {
                  if (window.location.origin !== '%s') return;
                  const binding = Object.freeze({sessionId:'%s', bridgeToken:'%s', pageIdentity:'%s'});
                  Object.defineProperty(window, '__DDD_AGENT_BRIDGE__', {
                    value: binding, configurable: false, enumerable: false, writable: false
                  });
                })()
                """.formatted(
                        binding.allowedOrigin(),
                        binding.sessionId(),
                        binding.bridgeToken(),
                        binding.pageIdentity());
    }

    public void removeSession(String sessionId) {
        registry.removeSession(sessionId);
    }

    private String origin(String rawUrl) {
        try {
            URI uri = URI.create(rawUrl);
            int port = uri.getPort();
            return uri.getScheme() + "://" + uri.getHost() + (port < 0 ? "" : ":" + port);
        } catch (RuntimeException exception) {
            throw new IllegalStateException("현재 Page origin을 확인할 수 없습니다.");
        }
    }
}
