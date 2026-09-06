package com.ddd.backend.api.controller;

import com.ddd.backend.api.dto.conversation.ConversationBridgeRecoveryResponse;
import com.ddd.backend.common.response.ApiResponse;
import com.ddd.backend.conversation.bridge.DemoAgentBridgeBinding;
import com.ddd.backend.conversation.bridge.DemoAgentBridgeRegistry;
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

    private final DemoAgentBridgeRegistry bridges;
    private final AutomationSessionService sessions;
    private final OverlayTargetStore targets;

    public ConversationBridgeController(
            DemoAgentBridgeRegistry bridges,
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
            @RequestHeader(value = "Origin", required = false) String origin
    ) {
        sessions.getSession(sessionId);
        DemoAgentBridgeBinding binding = bridges.require(
                sessionId, bridgeToken, origin, pageIdentity);
        return ApiResponse.success(ConversationBridgeRecoveryResponse.of(
                binding.sessionId(), binding.pageIdentity(), binding.expiresAt(),
                targets.active(sessionId, pageIdentity).orElse(null)));
    }
}
