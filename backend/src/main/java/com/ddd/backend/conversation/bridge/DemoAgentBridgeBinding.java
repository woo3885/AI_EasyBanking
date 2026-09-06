package com.ddd.backend.conversation.bridge;

import java.time.Instant;

public record DemoAgentBridgeBinding(
        String sessionId,
        String bridgeToken,
        String pageIdentity,
        String allowedOrigin,
        Instant expiresAt
) {
}
