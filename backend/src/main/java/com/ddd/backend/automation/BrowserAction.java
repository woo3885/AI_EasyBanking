package com.ddd.backend.automation;

import java.util.Objects;

public record BrowserAction(
        BrowserActionType type,
        String selector,
        String value,
        Integer scrollX,
        Integer scrollY,
        Integer waitMillis
) {

    public BrowserAction {
        Objects.requireNonNull(
                type,
                "브라우저 행동 유형은 필수입니다."
        );
    }
}
