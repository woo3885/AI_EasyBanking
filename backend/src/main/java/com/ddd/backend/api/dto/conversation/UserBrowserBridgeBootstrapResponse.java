package com.ddd.backend.api.dto.conversation;

import com.ddd.backend.conversation.bridge.UserBrowserBridgeBinding;

import java.time.Instant;

/** URL/storage가 아닌 최초 ACK 메모리에서만 소비하는 사용자 브라우저 binding. */
public record UserBrowserBridgeBootstrapResponse(
        String sessionId,
        String bridgeToken,
        String pageIdentity,
        Instant expiresAt,
        String recoveryPath,
        String pageReadyStatus
) {
    public static UserBrowserBridgeBootstrapResponse from(UserBrowserBridgeBinding binding) {
        return new UserBrowserBridgeBootstrapResponse(
                binding.sessionId(), binding.bridgeToken(), binding.pageIdentity(), binding.expiresAt(),
                "/api/v1/sessions/" + binding.sessionId() + "/conversation/bridge",
                "READY");
    }
}
