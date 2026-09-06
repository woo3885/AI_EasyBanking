package com.ddd.backend.conversation;
import java.time.Instant;
public record ConversationMessage(
        String messageId, String requestId, long sequence, ConversationRole role,
        String content, String kind, String questionId, Long goalRevision, Instant occurredAt
) { }
