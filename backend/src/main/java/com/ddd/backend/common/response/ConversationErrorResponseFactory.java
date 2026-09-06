package com.ddd.backend.common.response;

import com.ddd.backend.conversation.ConversationError;

/** ApiResponse의 외부 errorCode 계약을 유지하기 위한 작은 adapter. */
public final class ConversationErrorResponseFactory {
    private ConversationErrorResponseFactory() { }

    public static ApiResponse<Void> create(ConversationError error) {
        return new ApiResponse<>(false, null, error.code(), error.message());
    }
}
