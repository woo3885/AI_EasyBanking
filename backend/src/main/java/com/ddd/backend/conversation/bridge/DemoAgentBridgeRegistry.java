package com.ddd.backend.conversation.bridge;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Component
public final class DemoAgentBridgeRegistry {
    private final ConcurrentHashMap<String, DemoAgentBridgeBinding> bindings = new ConcurrentHashMap<>();

    public void put(DemoAgentBridgeBinding binding) {
        bindings.put(binding.sessionId(), binding);
    }

    public Optional<DemoAgentBridgeBinding> find(String sessionId) {
        DemoAgentBridgeBinding binding = bindings.get(sessionId);
        if (binding == null) return Optional.empty();
        if (!binding.expiresAt().isAfter(Instant.now())) {
            bindings.remove(sessionId, binding);
            return Optional.empty();
        }
        return Optional.of(binding);
    }

    public DemoAgentBridgeBinding require(
            String sessionId,
            String bridgeToken,
            String origin,
            String pageIdentity
    ) {
        DemoAgentBridgeBinding binding = find(sessionId)
                .orElseThrow(DemoAgentBridgeAuthenticationException::new);
        if (!constantTimeEquals(binding.bridgeToken(), bridgeToken)
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
        byte[] left = expected.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        byte[] right = actual.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        return java.security.MessageDigest.isEqual(left, right);
    }
}
