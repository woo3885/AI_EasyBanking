package com.ddd.backend.conversation.event;

import com.ddd.backend.conversation.navigation.BrowserNavigationMode;

import java.time.Instant;

public record NavigationRequiredEvent(
        String eventId, long eventSequence, String eventType, String sessionId,
        String navigationId, String browserBindingId,
        String sourcePageIdentity, String destinationPageIdentity,
        String destinationRoute, long routeRevision,
        BrowserNavigationMode navigationMode, Instant expiresAt,
        String guide, Instant occurredAt
) implements ConversationEvent {
}
