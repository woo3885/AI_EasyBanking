package com.ddd.backend.conversation.event;

import com.ddd.backend.domain.session.WorkflowStatus;
import java.time.Instant;

public record AiMessageEvent(
        String eventId,
        long eventSequence,
        String eventType,
        String sessionId,
        WorkflowStatus workflowStatus,
        String messageId,
        long sequence,
        String text,
        String kind,
        long goalRevision,
        String errorCode,
        Instant occurredAt
) implements ConversationEvent { }
