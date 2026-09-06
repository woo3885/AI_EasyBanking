package com.ddd.backend.conversation.overlay;

public final class OverlayTargetException extends RuntimeException {
    private final OverlayTargetError error;
    public OverlayTargetException(OverlayTargetError error) {
        super(error.safeMessage());
        this.error = error;
    }
    public OverlayTargetError error() { return error; }
}
