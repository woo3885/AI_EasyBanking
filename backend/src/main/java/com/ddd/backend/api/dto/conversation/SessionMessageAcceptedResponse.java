package com.ddd.backend.api.dto.conversation;

import com.ddd.backend.conversation.MessageAcceptance;
import com.ddd.backend.conversation.MessageQueueStatus;
import com.ddd.backend.domain.session.WorkflowStatus;

import java.time.Instant;

public record SessionMessageAcceptedResponse(
        String sessionId,
        String requestId,
        String messageId,
        long acceptedSequence,
        MessageQueueStatus queueStatus,
        WorkflowStatus workflowStatus,
        Instant acceptedAt,
        boolean duplicate
) {
    public static SessionMessageAcceptedResponse from(
            MessageAcceptance acceptance,
            WorkflowStatus workflowStatus
    ) {
        return new SessionMessageAcceptedResponse(
                acceptance.sessionId(), acceptance.requestId(), acceptance.messageId(),
                acceptance.acceptedSequence(), acceptance.queueStatus(), workflowStatus,
                acceptance.acceptedAt(), acceptance.duplicate());
    }
}
