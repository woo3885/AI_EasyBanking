package com.ddd.backend.ai;

public final class AiDecisionClientException
        extends RuntimeException {

    public AiDecisionClientException(
            String message
    ) {
        super(
                message
        );
    }

    public AiDecisionClientException(
            String message,
            Throwable cause
    ) {
        super(
                message,
                cause
        );
    }
}