package com.ddd.backend.api.controller;

import com.ddd.backend.api.dto.conversation.BrowserPageReadyRequest;
import com.ddd.backend.api.dto.conversation.BrowserPageReadyResponse;
import com.ddd.backend.common.response.ApiResponse;
import com.ddd.backend.conversation.navigation.BrowserNavigationService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/sessions/{sessionId}/browser-bindings")
public final class BrowserNavigationController {
    private final BrowserNavigationService service;

    public BrowserNavigationController(BrowserNavigationService service) { this.service = service; }

    @PostMapping("/page-ready")
    public ApiResponse<BrowserPageReadyResponse> pageReady(
            @PathVariable String sessionId,
            @RequestHeader(ConversationBridgeController.BRIDGE_TOKEN_HEADER) String bridgeToken,
            @RequestHeader(ConversationBridgeController.BROWSER_BINDING_ID_HEADER) String browserBindingId,
            @RequestHeader(ConversationBridgeController.PAGE_IDENTITY_HEADER) String pageIdentity,
            @RequestHeader("Origin") String origin,
            @Valid @RequestBody BrowserPageReadyRequest request) {
        return ApiResponse.success(service.pageReady(
                sessionId, bridgeToken, origin, browserBindingId, pageIdentity, request));
    }
}
