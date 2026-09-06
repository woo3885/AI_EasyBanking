package com.ddd.backend.websocket.dto;

import com.ddd.backend.domain.session.WorkflowStatus;
import com.ddd.backend.security.SensitiveDataMasker;

import java.time.Instant;
import java.util.Objects;

public record AutomationStatusEvent(
        String sessionId,
        WorkflowStatus status,
        String message,
        Instant occurredAt
) {

    public AutomationStatusEvent {
        if (sessionId == null || sessionId.isBlank()) {
            throw new IllegalArgumentException(
                    "자동화 세션 ID는 비어 있을 수 없습니다."
            );
        }

        Objects.requireNonNull(
                status,
                "워크플로 상태는 필수입니다."
        );

        Objects.requireNonNull(
                occurredAt,
                "이벤트 발생 시각은 필수입니다."
        );

        message = normalizeMessage(message);
    }

    public static AutomationStatusEvent create(
            String sessionId,
            WorkflowStatus status,
            String message
    ) {
        return new AutomationStatusEvent(
                sessionId,
                status,
                message,
                Instant.now()
        );
    }

    private static String normalizeMessage(
            String message
    ) {
        if (message == null || message.isBlank()) {
            return null;
        }

        String masked = SensitiveDataMasker.maskFreeText(message.trim());
        return masked.substring(0, Math.min(masked.length(), 500));
    }
}
