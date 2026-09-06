package com.ddd.backend.automation;

public record BrowserActionPolicyContext(
        boolean sensitiveInput,
        boolean userChoice,
        boolean optionalConsent,
        boolean finalExecution,
        boolean blockedTarget
) {

    public static BrowserActionPolicyContext normal() {
        return new BrowserActionPolicyContext(
                false,
                false,
                false,
                false,
                false
        );
    }

    public static BrowserActionPolicyContext forSensitiveInput() {
        return new BrowserActionPolicyContext(
                true,
                false,
                false,
                false,
                false
        );
    }

    public static BrowserActionPolicyContext forUserChoice() {
        return new BrowserActionPolicyContext(
                false,
                true,
                false,
                false,
                false
        );
    }

    public static BrowserActionPolicyContext forOptionalConsent() {
        return new BrowserActionPolicyContext(
                false,
                false,
                true,
                false,
                false
        );
    }

    public static BrowserActionPolicyContext forFinalExecution() {
        return new BrowserActionPolicyContext(
                false,
                false,
                false,
                true,
                false
        );
    }

    public static BrowserActionPolicyContext forBlockedTarget() {
        return new BrowserActionPolicyContext(
                false,
                false,
                false,
                false,
                true
        );
    }
}
