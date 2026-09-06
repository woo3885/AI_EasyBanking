package com.ddd.backend.api.controller;

import com.ddd.backend.api.dto.action.BrowserActionRequest;
import com.ddd.backend.api.dto.action.BrowserActionResponse;
import com.ddd.backend.common.response.ApiResponse;
import com.ddd.backend.service.action.PublicBrowserActionService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Objects;

@RestController
@RequestMapping(
        "/api/v1/sessions/{sessionId}/actions"
)
public final class BrowserActionController {

    private final PublicBrowserActionService
            publicBrowserActionService;

    public BrowserActionController(
            PublicBrowserActionService
                    publicBrowserActionService
    ) {
        this.publicBrowserActionService =
                Objects.requireNonNull(
                        publicBrowserActionService,
                        "PublicBrowserActionService는 필수입니다."
                );
    }

    @PostMapping
    public ApiResponse<BrowserActionResponse>
    executeAction(
            @PathVariable
            String sessionId,

            @Valid
            @RequestBody
            BrowserActionRequest request
    ) {
        BrowserActionResponse response =
                publicBrowserActionService
                        .execute(
                                sessionId,
                                request
                        );

        return ApiResponse.success(
                response,
                "Browser Action 요청이 처리되었습니다."
        );
    }
}