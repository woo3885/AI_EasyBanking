package com.ddd.backend.api.dto.session;

public record ConfirmationActionResponse(
        String sessionId,
        String requestId,
        String confirmationId,
        String sourceFrameId,
        long sourceFrameSequence,
        Status status,
        String message
) {
    public enum Status {
        APPROVAL_ACCEPTED,
        REJECTION_ACCEPTED
    }
}
