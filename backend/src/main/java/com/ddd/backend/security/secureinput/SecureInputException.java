package com.ddd.backend.security.secureinput;

import com.ddd.backend.common.exception.ErrorCode;

public final class SecureInputException extends IllegalStateException {
    private final ErrorCode errorCode;

    public SecureInputException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    public ErrorCode getErrorCode() {
        return errorCode;
    }
}
