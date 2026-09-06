package com.ddd.backend.websocket.frame;

import com.ddd.backend.frame.BrowserFrameStore;
import com.ddd.backend.security.capture.CapturedBrowserFrame;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class BrowserFrameWebSocketLifecycleTest {

    private BrowserFrameStore browserFrameStore;

    private BrowserFrameWebSocketHandler handler;

    @BeforeEach
    void setUp() {
        browserFrameStore =
                new BrowserFrameStore();

        handler =
                new BrowserFrameWebSocketHandler(
                        browserFrameStore
                );
    }

    @Test
    void 세션종료시_Viewer_WebSocket을_서버에서_닫는다()
            throws Exception {

        String sessionId =
                "session-lifecycle";

        browserFrameStore.publish(
                sessionId,
                new CapturedBrowserFrame(
                        new byte[]{
                                1, 2, 3
                        },
                        1280,
                        720,
                        "image/png"
                )
        );

        WebSocketSession session =
                createSession(
                        sessionId
                );

        handler.afterConnectionEstablished(
                session
        );

        assertThat(
                handler.hasConnection(
                        sessionId
                )
        ).isTrue();

        handler.closeConnection(
                sessionId
        );

        verify(
                session
        ).close(
                CloseStatus.NORMAL
        );

        assertThat(
                handler.hasConnection(
                        sessionId
                )
        ).isFalse();

        assertThat(
                handler.activeConnectionCount()
        ).isZero();
    }

    @Test
    void 연결이_없는_세션을_닫아도_오류가_발생하지_않는다() {
        handler.closeConnection(
                "session-not-connected"
        );

        assertThat(
                handler.activeConnectionCount()
        ).isZero();
    }

    private WebSocketSession createSession(
            String automationSessionId
    ) {
        WebSocketSession session =
                mock(
                        WebSocketSession.class
                );

        Map<String, Object> attributes =
                new HashMap<>();

        attributes.put(
                FrameWebSocketHandshakeInterceptor
                        .SESSION_ID_ATTRIBUTE,
                automationSessionId
        );

        when(
                session.getAttributes()
        ).thenReturn(
                attributes
        );

        when(
                session.getAcceptedProtocol()
        ).thenReturn(
                BrowserFrameWebSocketHandler
                        .SUB_PROTOCOL
        );

        when(
                session.isOpen()
        ).thenReturn(
                true
        );

        return session;
    }
}