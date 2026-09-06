package com.ddd.backend.automation;

import org.springframework.stereotype.Component;

import java.util.Objects;

@Component
public final class BrowserActionPolicyEvaluator {

    public BrowserActionPolicyResult evaluate(
            BrowserAction action,
            BrowserActionPolicyContext context
    ) {
        Objects.requireNonNull(
                action,
                "브라우저 행동 명령은 필수입니다."
        );

        Objects.requireNonNull(
                context,
                "브라우저 행동 정책 정보는 필수입니다."
        );

        if (context.blockedTarget()) {
            return BrowserActionPolicyResult.blocked();
        }

        if (context.sensitiveInput()) {
            return BrowserActionPolicyResult
                    .secureInputRequired();
        }

        if (context.finalExecution()) {
            return BrowserActionPolicyResult
                    .finalConfirmationRequired();
        }

        if (context.userChoice()
                || context.optionalConsent()) {

            return BrowserActionPolicyResult
                    .userActionRequired();
        }

        return switch (action.type()) {
            case PAUSE_FOR_SECURE_INPUT ->
                    BrowserActionPolicyResult
                            .secureInputRequired();

            case REQUEST_FINAL_CONFIRMATION ->
                    BrowserActionPolicyResult
                            .finalConfirmationRequired();

            case WAIT_FOR_USER ->
                    BrowserActionPolicyResult
                            .userActionRequired();

            case STOP ->
                    BrowserActionPolicyResult.blocked();

            default ->
                    BrowserActionPolicyResult.allowed();
        };
    }
}
