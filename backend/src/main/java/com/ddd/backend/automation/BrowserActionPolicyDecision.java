package com.ddd.backend.automation;

public enum BrowserActionPolicyDecision {

    ALLOW,
    USER_ACTION_REQUIRED,
    SECURE_INPUT_REQUIRED,
    FINAL_CONFIRMATION_REQUIRED,
    BLOCKED
}
