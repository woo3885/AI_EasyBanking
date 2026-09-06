package com.ddd.backend.conversation.navigation;

import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;

import static com.ddd.backend.conversation.navigation.BrowserNavigationError.*;

@Component
public final class PendingBrowserNavigationRegistry {
    private final ConcurrentHashMap<String, PendingBrowserNavigation> active = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Set<String>> requestIds = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Set<String>> consumedIds = new ConcurrentHashMap<>();
    private final Clock clock;
    private volatile Consumer<PendingBrowserNavigation> clearListener = ignored -> { };

    public PendingBrowserNavigationRegistry() { this(Clock.systemUTC()); }
    PendingBrowserNavigationRegistry(Clock clock) { this.clock = clock; }

    public void setClearListener(Consumer<PendingBrowserNavigation> listener) {
        clearListener = listener == null ? ignored -> { } : listener;
    }

    public synchronized PendingBrowserNavigation replace(PendingBrowserNavigation value) {
        PendingBrowserNavigation previous = active.put(value.sessionId(), value);
        if (previous != null && previous.status() != PendingBrowserNavigation.Status.CONSUMED) {
            clearListener.accept(previous.withStatus(PendingBrowserNavigation.Status.CLEARED));
        }
        return value;
    }

    public synchronized PendingBrowserNavigation claim(String sessionId, String requestId,
            String navigationId, String browserBindingId, String sourcePageIdentity,
            String destinationPageIdentity, long routeRevision, String renderedRoute) {
        if (!requestIds.computeIfAbsent(sessionId, ignored -> ConcurrentHashMap.newKeySet()).add(requestId)) {
            throw new BrowserNavigationException(NAVIGATION_DUPLICATE_REQUEST);
        }
        PendingBrowserNavigation value = active.get(sessionId);
        if (value == null) {
            if (consumedIds.getOrDefault(sessionId, Set.of()).contains(navigationId)) {
                throw new BrowserNavigationException(PAGE_READY_ALREADY_ACCEPTED);
            }
            throw new BrowserNavigationException(NAVIGATION_NOT_FOUND);
        }
        if (!value.expiresAt().isAfter(clock.instant())) {
            active.remove(sessionId, value);
            clearListener.accept(value.withStatus(PendingBrowserNavigation.Status.CLEARED));
            throw new BrowserNavigationException(NAVIGATION_EXPIRED);
        }
        if (value.status() == PendingBrowserNavigation.Status.IN_PROGRESS) {
            throw new BrowserNavigationException(NAVIGATION_REQUEST_IN_PROGRESS);
        }
        if (!value.navigationId().equals(navigationId)) throw new BrowserNavigationException(NAVIGATION_ID_MISMATCH);
        if (!value.browserBindingId().equals(browserBindingId)) throw new BrowserNavigationException(BROWSER_BINDING_MISMATCH);
        if (!value.sourcePageIdentity().equals(sourcePageIdentity)
                || !value.destinationPageIdentity().equals(destinationPageIdentity)) {
            throw new BrowserNavigationException(NAVIGATION_PAGE_IDENTITY_MISMATCH);
        }
        if (value.routeRevision() != routeRevision) throw new BrowserNavigationException(NAVIGATION_STALE);
        if (!value.destinationRoute().equals(renderedRoute)) throw new BrowserNavigationException(NAVIGATION_ROUTE_MISMATCH);
        PendingBrowserNavigation claimed = value.withStatus(PendingBrowserNavigation.Status.IN_PROGRESS);
        active.put(sessionId, claimed);
        return claimed;
    }

    public synchronized PendingBrowserNavigation consume(String sessionId, String navigationId) {
        PendingBrowserNavigation value = active.get(sessionId);
        if (value == null || !value.navigationId().equals(navigationId)) {
            throw new BrowserNavigationException(NAVIGATION_NOT_FOUND);
        }
        PendingBrowserNavigation consumed = value.withStatus(PendingBrowserNavigation.Status.CONSUMED);
        active.remove(sessionId, value);
        consumedIds.computeIfAbsent(sessionId, ignored -> ConcurrentHashMap.newKeySet()).add(navigationId);
        return consumed;
    }

    public boolean hasActive(String sessionId) { return active.containsKey(sessionId); }
    public synchronized void removeSession(String sessionId) {
        PendingBrowserNavigation removed = active.remove(sessionId);
        if (removed != null) clearListener.accept(removed.withStatus(PendingBrowserNavigation.Status.CLEARED));
        requestIds.remove(sessionId);
        consumedIds.remove(sessionId);
    }
}
