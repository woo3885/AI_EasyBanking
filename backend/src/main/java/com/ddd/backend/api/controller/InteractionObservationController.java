package com.ddd.backend.api.controller;

import com.ddd.backend.api.dto.conversation.InteractionObservationAcceptedResponse;
import com.ddd.backend.api.dto.conversation.InteractionObservationRequest;
import com.ddd.backend.common.response.ApiResponse;
import com.ddd.backend.conversation.overlay.InteractionObservationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/sessions/{sessionId}/interaction-observations")
public final class InteractionObservationController {
    private final InteractionObservationService observations;
    public InteractionObservationController(InteractionObservationService observations) {
        this.observations = observations;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<InteractionObservationAcceptedResponse>> observe(
            @PathVariable String sessionId,
            @RequestHeader(value = ConversationBridgeController.BRIDGE_TOKEN_HEADER, required = false) String bridgeToken,
            @RequestHeader(value = ConversationBridgeController.PAGE_IDENTITY_HEADER, required = false) String pageIdentity,
            @RequestHeader(value = ConversationBridgeController.BROWSER_BINDING_ID_HEADER, required = false) String browserBindingId,
            @RequestHeader(value = "Origin", required = false) String origin,
            @Valid @RequestBody InteractionObservationRequest request
    ) {
        var accepted = observations.observe(
                sessionId, bridgeToken, browserBindingId, pageIdentity, origin, request);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(ApiResponse.success(accepted,
                "관찰 요청이 접수되었습니다. 클릭 성공이나 업무 성공을 의미하지 않습니다."));
    }
}
