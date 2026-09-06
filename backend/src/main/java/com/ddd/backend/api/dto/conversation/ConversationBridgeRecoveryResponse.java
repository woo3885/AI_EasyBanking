package com.ddd.backend.api.dto.conversation;

import java.time.Instant;

public record ConversationBridgeRecoveryResponse(
        String sessionId,
        String pageIdentity,
        String eventSubscription,
        String conversationSnapshotPath,
        Instant expiresAt
) {
    public static ConversationBridgeRecoveryResponse of(
            String sessionId,
            String pageIdentity,
            Instant expiresAt
    ) {
        return new ConversationBridgeRecoveryResponse(
                sessionId,
                pageIdentity,
                "/topic/sessions/" + sessionId + "/events",
                "/api/v1/sessions/" + sessionId + "/conversation",
                expiresAt);
    }
}
