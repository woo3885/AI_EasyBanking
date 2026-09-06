package com.ddd.backend.conversation.navigation;

public final class BrowserNavigationException extends RuntimeException {
    private final BrowserNavigationError error;

    public BrowserNavigationException(BrowserNavigationError error) {
        super(error.safeMessage());
        this.error = error;
    }

    public BrowserNavigationError error() { return error; }
}
