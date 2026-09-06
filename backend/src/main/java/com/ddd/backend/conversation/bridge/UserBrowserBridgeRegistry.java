package com.ddd.backend.conversation.bridge;

import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Component
public final class UserBrowserBridgeRegistry {
    private final ConcurrentHashMap<String, UserBrowserBridgeBinding> bindings = new ConcurrentHashMap<>();

    public void put(UserBrowserBridgeBinding binding) {
        bindings.put(binding.sessionId(), binding);
    }

    public Optional<UserBrowserBridgeBinding> find(String sessionId) {
        UserBrowserBridgeBinding binding = bindings.get(sessionId);
        if (binding == null) return Optional.empty();
        if (!binding.expiresAt().isAfter(Instant.now())) {
            bindings.remove(sessionId, binding);
            return Optional.empty();
        }
        return Optional.of(binding);
    }

    public UserBrowserBridgeBinding require(
            String sessionId, String token, String origin, String pageIdentity) {
        UserBrowserBridgeBinding binding = find(sessionId)
                .orElseThrow(DemoAgentBridgeAuthenticationException::new);
        if (!constantTimeEquals(binding.bridgeToken(), token)
                || !binding.allowedOrigin().equals(origin)
                || !binding.pageIdentity().equals(pageIdentity)) {
            throw new DemoAgentBridgeAuthenticationException();
        }
        return binding;
    }

    public void removeSession(String sessionId) {
        if (sessionId != null) bindings.remove(sessionId);
    }

    private boolean constantTimeEquals(String expected, String actual) {
        if (expected == null || actual == null) return false;
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                actual.getBytes(StandardCharsets.UTF_8));
    }
}
