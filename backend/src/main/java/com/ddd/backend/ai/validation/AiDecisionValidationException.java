package com.ddd.backend.ai.validation;

import java.util.Objects;

public final class AiDecisionValidationException
        extends RuntimeException {

    private final Code code;

    public AiDecisionValidationException(
            Code code,
            String message
    ) {
        super(message);

        this.code =
                Objects.requireNonNull(
                        code,
                        "Validation code는 필수입니다."
                );
    }

    public Code code() {
        return code;
    }

    public enum Code {

        INVALID_PAYLOAD,

        MISSING_ELEMENT_ID,

        UNKNOWN_ELEMENT_ID,

        ELEMENT_NOT_INTERACTABLE,

        USER_DECISION_REQUIRED,

        SECURE_INPUT_REQUIRED,

        FINAL_CONFIRMATION_REQUIRED,

        BLOCKED_ELEMENT,

        UNSAFE_KEY,

        INVALID_SCROLL,

        INVALID_WAIT
    }
}