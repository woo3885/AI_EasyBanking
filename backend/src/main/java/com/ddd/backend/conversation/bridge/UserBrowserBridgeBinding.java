package com.ddd.backend.conversation.bridge;

import java.time.Instant;

/** 사용자 브라우저에만 전달되는 세션 범위 binding. */
public record UserBrowserBridgeBinding(
        String sessionId,
        String browserBindingId,
        String bridgeToken,
        String pageIdentity,
        String currentRoute,
        String allowedOrigin,
        Instant expiresAt
) {
    public UserBrowserBridgeBinding(String sessionId, String browserBindingId, String bridgeToken,
            String pageIdentity, String allowedOrigin, Instant expiresAt) {
        this(sessionId, browserBindingId, bridgeToken, pageIdentity, null, allowedOrigin, expiresAt);
    }
    public UserBrowserBridgeBinding withPageIdentity(String nextPageIdentity) {
        return new UserBrowserBridgeBinding(
                sessionId, browserBindingId, bridgeToken, nextPageIdentity, currentRoute,
                allowedOrigin, expiresAt);
    }
    public UserBrowserBridgeBinding withPage(String nextPageIdentity, String nextRoute) {
        return new UserBrowserBridgeBinding(
                sessionId, browserBindingId, bridgeToken, nextPageIdentity, nextRoute,
                allowedOrigin, expiresAt);
    }
}
