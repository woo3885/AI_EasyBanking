package com.ddd.backend.api.dto.action;

import com.ddd.backend.automation.BrowserActionExecutionResult;
import com.ddd.backend.automation.BrowserActionExecutionStatus;
import com.ddd.backend.automation.BrowserActionType;
import com.ddd.backend.frame.BrowserFrameMetadata;

import java.util.Objects;

public record BrowserActionResponse(
        String requestId,
        BrowserActionType actionType,
        BrowserActionExecutionStatus status,
        String message,
        String frameId,
        long sequence,
        boolean frameAdvanced
) {

    public static BrowserActionResponse from(
            String requestId,
            BrowserActionExecutionResult result,
            BrowserFrameMetadata beforeFrame,
            BrowserFrameMetadata afterFrame
    ) {
        Objects.requireNonNull(
                requestId,
                "requestId는 필수입니다."
        );

        Objects.requireNonNull(
                result,
                "BrowserActionExecutionResult는 필수입니다."
        );

        Objects.requireNonNull(
                beforeFrame,
                "기존 Frame 정보는 필수입니다."
        );

        Objects.requireNonNull(
                afterFrame,
                "현재 Frame 정보는 필수입니다."
        );

        return new BrowserActionResponse(
                requestId,
                result.actionType(),
                result.status(),
                result.message(),
                afterFrame.frameId(),
                afterFrame.sequence(),
                afterFrame.sequence()
                        > beforeFrame.sequence()
        );
    }
}