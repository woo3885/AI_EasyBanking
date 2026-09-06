package com.ddd.backend.common.exception;

import java.util.Objects;

public final class BrowserActionRequestException
        extends RuntimeException {

    private final ErrorCode errorCode;

    public BrowserActionRequestException(
            ErrorCode errorCode,
            String message
    ) {
        super(
                message
        );

        this.errorCode =
                Objects.requireNonNull(
                        errorCode,
                        "ErrorCode는 필수입니다."
                );
    }

    public ErrorCode getErrorCode() {
        return errorCode;
    }
}