package com.ddd.backend.conversation.overlay;

import com.ddd.backend.conversation.navigation.PageReadyResumeError;

public final class GuideUserMaterializationException extends RuntimeException {
    private final PageReadyResumeError error;

    public GuideUserMaterializationException(PageReadyResumeError error) {
        this(error, null);
    }

    public GuideUserMaterializationException(PageReadyResumeError error, Throwable cause) {
        super(error.safeMessage(), cause);
        this.error = error;
    }

    public PageReadyResumeError error() {
        return error;
    }
}
