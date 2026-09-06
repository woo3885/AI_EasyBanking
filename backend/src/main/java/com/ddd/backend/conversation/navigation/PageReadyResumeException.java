package com.ddd.backend.conversation.navigation;

public final class PageReadyResumeException extends RuntimeException {
    private final PageReadyResumeError error;

    public PageReadyResumeException(PageReadyResumeError error, Throwable cause) {
        super(error.safeMessage(), cause);
        this.error = error;
    }

    public PageReadyResumeError error() {
        return error;
    }
}
