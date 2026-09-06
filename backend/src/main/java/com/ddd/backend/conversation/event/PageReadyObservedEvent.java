package com.ddd.backend.conversation.event;

import java.time.Instant;

public record PageReadyObservedEvent(
        String eventId, long eventSequence, String eventType, String sessionId,
        String navigationId, String browserBindingId,
        String sourcePageIdentity, String pageIdentity,
        long routeRevision, Instant occurredAt
) implements ConversationEvent {
}
