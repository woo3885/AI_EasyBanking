package com.ddd.backend.automation;

public enum BrowserActionExecutionStatus {

    EXECUTED,
    NO_ACTION,
    USER_ACTION_REQUIRED,
    SECURE_INPUT_REQUIRED,
    FINAL_CONFIRMATION_REQUIRED,
    BLOCKED,
    STOPPED
}