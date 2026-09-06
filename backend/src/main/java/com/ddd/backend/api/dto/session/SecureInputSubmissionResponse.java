package com.ddd.backend.api.dto.session;

public record SecureInputSubmissionResponse(
        String sessionId,
        String requestId,
        String secureRequestId,
        String status,
        String message
) {}
