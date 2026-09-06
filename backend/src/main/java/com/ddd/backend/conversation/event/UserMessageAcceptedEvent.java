package com.ddd.backend.conversation.event;
import com.ddd.backend.domain.session.WorkflowStatus;
import java.time.Instant;
public record UserMessageAcceptedEvent(
        String eventId, long eventSequence, String eventType, String sessionId,
        String messageId, long acceptedSequence, WorkflowStatus workflowStatus, Instant occurredAt
) implements ConversationEvent { }
