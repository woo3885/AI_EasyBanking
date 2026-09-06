package com.ddd.backend.conversation;

import java.time.Instant;

public record MessageAcceptance(
        String sessionId,
        String requestId,
        String messageId,
        long acceptedSequence,
        MessageQueueStatus queueStatus,
        Instant acceptedAt,
        boolean duplicate
) {
    MessageAcceptance asDuplicate() {
        return new MessageAcceptance(
                sessionId, requestId, messageId, acceptedSequence,
                MessageQueueStatus.DUPLICATE, acceptedAt, true);
    }
}
