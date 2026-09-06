package com.ddd.backend.conversation.navigation;

import java.time.Instant;

public record PendingBrowserNavigation(
        String navigationId,
        String sessionId,
        String browserBindingId,
        String sourcePageIdentity,
        String destinationPageIdentity,
        String destinationRoute,
        long routeRevision,
        BrowserNavigationMode navigationMode,
        Instant expiresAt,
        Status status
) {
    public enum Status { ACTIVE, IN_PROGRESS, CONSUMED, CLEARED }
    public PendingBrowserNavigation withStatus(Status next) {
        return new PendingBrowserNavigation(navigationId, sessionId, browserBindingId,
                sourcePageIdentity, destinationPageIdentity, destinationRoute,
                routeRevision, navigationMode, expiresAt, next);
    }
}
