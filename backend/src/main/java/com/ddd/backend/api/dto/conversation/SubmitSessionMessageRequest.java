package com.ddd.backend.api.dto.conversation;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

public record SubmitSessionMessageRequest(
        @NotBlank(message = "메시지 요청이 올바르지 않습니다.") String requestId,
        @NotBlank(message = "메시지 요청이 올바르지 않습니다.") String messageId,
        @NotBlank(message = "메시지 요청이 올바르지 않습니다.") String content,
        String answerToQuestionId,
        @NotNull(message = "메시지 요청이 올바르지 않습니다.") @PositiveOrZero Long expectedConversationSequence,
        @NotNull(message = "메시지 요청이 올바르지 않습니다.") @PositiveOrZero Long expectedGoalRevision,
        Instant clientOccurredAt
) {
}
