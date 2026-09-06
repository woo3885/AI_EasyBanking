package com.ddd.backend.api.dto.conversation;

import java.time.Instant;
import com.ddd.backend.conversation.overlay.PublicOverlayTarget;

public record ConversationBridgeRecoveryResponse(
        String sessionId,
        String pageIdentity,
        String eventSubscription,
        String conversationSnapshotPath,
        Instant expiresAt,
        PublicOverlayTarget activeTarget
) {
    public static ConversationBridgeRecoveryResponse of(
            String sessionId,
            String pageIdentity,
            Instant expiresAt,
            PublicOverlayTarget activeTarget
    ) {
        return new ConversationBridgeRecoveryResponse(
                sessionId,
                pageIdentity,
                "/topic/sessions/" + sessionId + "/events",
                "/api/v1/sessions/" + sessionId + "/conversation",
                expiresAt,
                activeTarget);
    }
}
