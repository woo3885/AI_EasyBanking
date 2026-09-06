package com.ddd.backend.api.dto.conversation;

public record BrowserPageReadyResponse(
        String sessionId,
        String requestId,
        String navigationId,
        String browserBindingId,
        String sourcePageIdentity,
        String pageIdentity,
        long routeRevision,
        String renderedRoute,
        String status,
        String message
) {
}
