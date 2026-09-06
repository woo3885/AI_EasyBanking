package com.ddd.backend.conversation;

public final class ConversationException extends RuntimeException {
    private final ConversationError error;

    public ConversationException(ConversationError error) {
        super(error.message());
        this.error = error;
    }

    public ConversationError error() {
        return error;
    }
}
