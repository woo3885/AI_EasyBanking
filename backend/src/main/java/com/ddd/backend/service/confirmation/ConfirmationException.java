package com.ddd.backend.service.confirmation;

import com.ddd.backend.common.exception.ErrorCode;

public final class ConfirmationException extends IllegalStateException {
    private final ErrorCode errorCode;

    public ConfirmationException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    public ErrorCode getErrorCode() {
        return errorCode;
    }
}
