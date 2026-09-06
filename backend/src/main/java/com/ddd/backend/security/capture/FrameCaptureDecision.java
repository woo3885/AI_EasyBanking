package com.ddd.backend.security.capture;

public enum FrameCaptureDecision {

    ALLOW,
    SECURE_INPUT_BLOCKED,
    INSPECTION_FAILED_BLOCKED;

    public boolean isAllowed() {
        return this == ALLOW;
    }
}