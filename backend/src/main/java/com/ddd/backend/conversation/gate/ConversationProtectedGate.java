package com.ddd.backend.conversation.gate;

import com.ddd.backend.conversation.agent.ConversationInteractionMode;

import java.time.Instant;

public record ConversationProtectedGate(
        String gateId,
        String sessionId,
        String requestMessageId,
        ConversationInteractionMode mode,
        String sourceSnapshotId,
        Instant activatedAt
) {
}
