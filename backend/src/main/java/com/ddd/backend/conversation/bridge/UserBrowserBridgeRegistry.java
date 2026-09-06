package com.ddd.backend.conversation.bridge;

import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import com.ddd.backend.conversation.navigation.BrowserNavigationError;
import com.ddd.backend.conversation.navigation.BrowserNavigationException;

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
            String sessionId, String token, String origin, String browserBindingId, String pageIdentity) {
        UserBrowserBridgeBinding binding = find(sessionId)
                .orElseThrow(DemoAgentBridgeAuthenticationException::new);
        if (!constantTimeEquals(binding.bridgeToken(), token)
                || !binding.allowedOrigin().equals(origin)
                || !binding.browserBindingId().equals(browserBindingId)
                || !binding.pageIdentity().equals(pageIdentity)) {
            throw new DemoAgentBridgeAuthenticationException();
        }
        return binding;
    }

    public UserBrowserBridgeBinding authenticateForNavigation(
            String sessionId, String token, String origin,
            String browserBindingId) {
        UserBrowserBridgeBinding binding = bindings.get(sessionId);
        if (binding == null) {
            throw new BrowserNavigationException(BrowserNavigationError.BROWSER_BINDING_NOT_FOUND);
        }
        if (!binding.expiresAt().isAfter(Instant.now())) {
            bindings.remove(sessionId, binding);
            throw new BrowserNavigationException(BrowserNavigationError.BROWSER_BINDING_EXPIRED);
        }
        if (!constantTimeEquals(binding.bridgeToken(), token)
                || !binding.allowedOrigin().equals(origin)
                || !binding.browserBindingId().equals(browserBindingId)) {
            throw new BrowserNavigationException(BrowserNavigationError.BROWSER_BINDING_MISMATCH);
        }
        return binding;
    }

    public synchronized UserBrowserBridgeBinding rotatePageIdentity(
            String sessionId, String browserBindingId, String expectedPageIdentity,
            String destinationPageIdentity) {
        UserBrowserBridgeBinding current = find(sessionId)
                .orElseThrow(DemoAgentBridgeAuthenticationException::new);
        if (!current.browserBindingId().equals(browserBindingId)
                || !current.pageIdentity().equals(expectedPageIdentity)) {
            throw new DemoAgentBridgeAuthenticationException();
        }
        UserBrowserBridgeBinding rotated = current.withPageIdentity(destinationPageIdentity);
        bindings.put(sessionId, rotated);
        return rotated;
    }

    public synchronized UserBrowserBridgeBinding rotatePageIdentity(
            String sessionId, String browserBindingId, String expectedPageIdentity,
            String destinationPageIdentity, String renderedRoute) {
        UserBrowserBridgeBinding current = find(sessionId)
                .orElseThrow(DemoAgentBridgeAuthenticationException::new);
        if (!current.browserBindingId().equals(browserBindingId)
                || !current.pageIdentity().equals(expectedPageIdentity)) {
            throw new DemoAgentBridgeAuthenticationException();
        }
        UserBrowserBridgeBinding rotated = current.withPage(destinationPageIdentity, renderedRoute);
        bindings.put(sessionId, rotated);
        return rotated;
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
