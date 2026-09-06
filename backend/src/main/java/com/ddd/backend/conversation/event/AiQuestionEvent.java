package com.ddd.backend.conversation.event;
import com.ddd.backend.domain.session.WorkflowStatus;
import java.time.Instant;
public record AiQuestionEvent(
        String eventId, long eventSequence, String eventType, String sessionId,
        WorkflowStatus workflowStatus, String messageId, long sequence,
        String questionId, String text, String kind, long goalRevision, Instant occurredAt
) implements ConversationEvent { }
