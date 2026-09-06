package com.ddd.backend.api.dto.session;

import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.domain.session.WorkflowStatus;
import com.ddd.backend.websocket.frame.BrowserFrameWebSocketHandler;

import java.time.Instant;

public record AutomationSessionResponse(
        String sessionId,
        String userRequest,
        WorkflowStatus status,
        Instant createdAt,
        Instant updatedAt,
        String frameWebSocketPath,
        String frameProtocol
) {

    private static final String FRAME_WS_PREFIX =
            "/ws/sessions/";

    private static final String FRAME_WS_SUFFIX =
            "/frames";

    public static AutomationSessionResponse from(
            AutomationSession session
    ) {
        return new AutomationSessionResponse(
                session.getSessionId(),
                session.getUserRequest(),
                session.getStatus(),
                session.getCreatedAt(),
                session.getUpdatedAt(),
                createFrameWebSocketPath(
                        session.getSessionId()
                ),
                BrowserFrameWebSocketHandler.SUB_PROTOCOL
        );
    }

    private static String createFrameWebSocketPath(
            String sessionId
    ) {
        if (sessionId == null
                || sessionId.isBlank()) {

            throw new IllegalArgumentException(
                    "Frame WebSocket 경로에 사용할 "
                            + "세션 ID는 비어 있을 수 없습니다."
            );
        }

        return FRAME_WS_PREFIX
                + sessionId
                + FRAME_WS_SUFFIX;
    }
}