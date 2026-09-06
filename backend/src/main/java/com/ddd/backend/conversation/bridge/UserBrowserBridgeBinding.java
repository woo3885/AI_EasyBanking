package com.ddd.backend.conversation.bridge;

import java.time.Instant;

/** 사용자 브라우저에만 전달되는 세션 범위 binding. */
public record UserBrowserBridgeBinding(
        String sessionId,
        String browserBindingId,
        String bridgeToken,
        String pageIdentity,
        String allowedOrigin,
        Instant expiresAt
) {
    public UserBrowserBridgeBinding withPageIdentity(String nextPageIdentity) {
        return new UserBrowserBridgeBinding(
                sessionId, browserBindingId, bridgeToken, nextPageIdentity, allowedOrigin, expiresAt);
    }
}
