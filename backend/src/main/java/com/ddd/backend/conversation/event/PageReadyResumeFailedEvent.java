package com.ddd.backend.conversation.event;

import com.ddd.backend.conversation.navigation.PageReadyResumeError;

import java.time.Instant;

public record PageReadyResumeFailedEvent(
        String eventId, long eventSequence, String eventType, String sessionId,
        String navigationId, PageReadyResumeError errorCode, String message, Instant occurredAt
) implements ConversationEvent { }
