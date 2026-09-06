package com.ddd.backend.api.controller;

import com.ddd.backend.api.dto.conversation.ConversationBridgeRecoveryResponse;
import com.ddd.backend.common.response.ApiResponse;
import com.ddd.backend.conversation.bridge.UserBrowserBridgeBinding;
import com.ddd.backend.conversation.bridge.UserBrowserBridgeRegistry;
import com.ddd.backend.service.AutomationSessionService;
import com.ddd.backend.conversation.overlay.OverlayTargetStore;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/sessions/{sessionId}/conversation")
public final class ConversationBridgeController {
    public static final String BRIDGE_TOKEN_HEADER = "X-DDD-Bridge-Token";
    public static final String PAGE_IDENTITY_HEADER = "X-DDD-Page-Identity";
    public static final String BROWSER_BINDING_ID_HEADER = "X-DDD-Browser-Binding-Id";

    private final UserBrowserBridgeRegistry bridges;
    private final AutomationSessionService sessions;
    private final OverlayTargetStore targets;

    public ConversationBridgeController(
            UserBrowserBridgeRegistry bridges,
            AutomationSessionService sessions,
            OverlayTargetStore targets
    ) {
        this.bridges = bridges;
        this.sessions = sessions;
        this.targets = targets;
    }

    @GetMapping("/bridge")
    public ApiResponse<ConversationBridgeRecoveryResponse> recover(
            @PathVariable String sessionId,
            @RequestHeader(value = BRIDGE_TOKEN_HEADER, required = false) String bridgeToken,
            @RequestHeader(value = PAGE_IDENTITY_HEADER, required = false) String pageIdentity,
            @RequestHeader(value = BROWSER_BINDING_ID_HEADER, required = false) String browserBindingId,
            @RequestHeader(value = "Origin", required = false) String origin
    ) {
        sessions.getSession(sessionId);
        UserBrowserBridgeBinding binding = bridges.require(
                sessionId, bridgeToken, origin, browserBindingId, pageIdentity);
        return ApiResponse.success(ConversationBridgeRecoveryResponse.of(
                binding.sessionId(), binding.pageIdentity(), binding.expiresAt(),
                targets.active(sessionId, pageIdentity).orElse(null)));
    }
}
