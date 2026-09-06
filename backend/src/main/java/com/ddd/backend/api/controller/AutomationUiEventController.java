package com.ddd.backend.api.controller;

import com.ddd.backend.common.response.ApiResponse;
import com.ddd.backend.service.AutomationSessionService;
import com.ddd.backend.websocket.dto.AutomationUiEventSnapshot;
import com.ddd.backend.websocket.publisher.AutomationStatusEventPublisher;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Objects;

@RestController
@RequestMapping("/api/v1/sessions")
public final class AutomationUiEventController {

    private final AutomationSessionService sessionService;
    private final AutomationStatusEventPublisher eventPublisher;

    public AutomationUiEventController(
            AutomationSessionService sessionService,
            AutomationStatusEventPublisher eventPublisher
    ) {
        this.sessionService = Objects.requireNonNull(sessionService);
        this.eventPublisher = Objects.requireNonNull(eventPublisher);
    }

    @GetMapping("/{sessionId}/events/latest")
    public ApiResponse<AutomationUiEventSnapshot> latest(
            @PathVariable String sessionId
    ) {
        sessionService.getSession(sessionId);
        AutomationUiEventSnapshot snapshot = eventPublisher.latestSnapshot(sessionId)
                .orElseGet(() -> new AutomationUiEventSnapshot(
                        sessionId, 0L, null, null, null));
        return ApiResponse.success(snapshot);
    }
}
