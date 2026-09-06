package com.ddd.backend.conversation.event;

import java.time.Instant;

public record NavigationClearEvent(
        String eventId, long eventSequence, String eventType, String sessionId,
        String navigationId, String browserBindingId,
        String sourcePageIdentity, String destinationPageIdentity,
        long routeRevision, String reason, Instant occurredAt
) implements ConversationEvent {
}
