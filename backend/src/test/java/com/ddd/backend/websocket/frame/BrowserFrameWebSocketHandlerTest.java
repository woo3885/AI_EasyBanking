package com.ddd.backend.websocket.frame;

import com.ddd.backend.frame.BrowserFramePayload;
import com.ddd.backend.frame.BrowserFrameStore;
import com.ddd.backend.security.capture.CapturedBrowserFrame;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class BrowserFrameWebSocketHandlerTest {

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
    void 지원_subprotocol은_D17_protocol이다() {
        assertThat(
                handler.getSubProtocols()
        ).containsExactly(
                "ddd.browser-frame.v1"
        );
    }

    @Test
    void 연결되면_metadata후_binary를_순서대로_전송한다()
            throws Exception {

        String sessionId =
                "session-123";

        byte[] frameBytes =
                new byte[]{
                        10, 20, 30, 40
                };

        BrowserFramePayload stored =
                browserFrameStore.publish(
                        sessionId,
                        new CapturedBrowserFrame(
                                frameBytes,
                                1280,
                                720,
                                "image/png"
                        )
                );

        WebSocketSession webSocketSession =
                createOpenSession(
                        "ws-1",
                        sessionId,
                        BrowserFrameWebSocketHandler
                                .SUB_PROTOCOL
                );

        handler.afterConnectionEstablished(
                webSocketSession
        );

        ArgumentCaptor<WebSocketMessage<?>> captor =
                ArgumentCaptor.forClass(
                        WebSocketMessage.class
                );

        verify(
                webSocketSession,
                times(2)
        ).sendMessage(
                captor.capture()
        );

        List<WebSocketMessage<?>> messages =
                captor.getAllValues();

        assertThat(
                messages
        ).hasSize(
                2
        );

        assertThat(
                messages.get(0)
        ).isInstanceOf(
                TextMessage.class
        );

        assertThat(
                messages.get(1)
        ).isInstanceOf(
                BinaryMessage.class
        );

        TextMessage metadataMessage =
                (TextMessage) messages.get(
                        0
                );

        String metadataJson =
                metadataMessage.getPayload();

        assertThat(
                metadataJson
        ).contains(
                "\"type\":\"BROWSER_FRAME\""
        );

        assertThat(
                metadataJson
        ).contains(
                "\"sessionId\":\""
                        + sessionId
                        + "\""
        );

        assertThat(
                metadataJson
        ).contains(
                "\"frameId\":\""
                        + stored.metadata()
                        .frameId()
                        + "\""
        );

        assertThat(
                metadataJson
        ).contains(
                "\"sequence\":1"
        );

        assertThat(
                metadataJson
        ).contains(
                "\"width\":1280"
        );

        assertThat(
                metadataJson
        ).contains(
                "\"height\":720"
        );

        assertThat(
                metadataJson
        ).contains(
                "\"mimeType\":\"image/png\""
        );

        assertThat(
                metadataJson
        ).contains(
                "\"byteLength\":"
                        + frameBytes.length
        );

        BinaryMessage binaryMessage =
                (BinaryMessage) messages.get(
                        1
                );

        ByteBuffer payload =
                binaryMessage.getPayload()
                        .duplicate();

        byte[] actualBytes =
                new byte[
                        payload.remaining()
                        ];

        payload.get(
                actualBytes
        );

        assertThat(
                actualBytes
        ).containsExactly(
                frameBytes
        );

        assertThat(
                handler.hasConnection(
                        sessionId
                )
        ).isTrue();

        assertThat(
                handler.activeConnectionCount()
        ).isEqualTo(
                1
        );
    }

    @Test
    void 잘못된_subprotocol이면_연결을_종료하고_Frame을_보내지_않는다()
            throws Exception {

        String sessionId =
                "session-123";

        browserFrameStore.publish(
                sessionId,
                createFrame()
        );

        WebSocketSession session =
                createOpenSession(
                        "ws-1",
                        sessionId,
                        "wrong.protocol"
                );

        handler.afterConnectionEstablished(
                session
        );

        verify(
                session
        ).close(
                CloseStatus.POLICY_VIOLATION
        );

        verify(
                session,
                never()
        ).sendMessage(
                org.mockito.ArgumentMatchers
                        .any()
        );

        assertThat(
                handler.hasConnection(
                        sessionId
                )
        ).isFalse();
    }

    @Test
    void 같은_자동화_세션에_두번째_WebSocket_연결을_허용하지_않는다()
            throws Exception {

        String sessionId =
                "session-123";

        browserFrameStore.publish(
                sessionId,
                createFrame()
        );

        WebSocketSession first =
                createOpenSession(
                        "ws-1",
                        sessionId,
                        BrowserFrameWebSocketHandler
                                .SUB_PROTOCOL
                );

        WebSocketSession second =
                createOpenSession(
                        "ws-2",
                        sessionId,
                        BrowserFrameWebSocketHandler
                                .SUB_PROTOCOL
                );

        handler.afterConnectionEstablished(
                first
        );

        handler.afterConnectionEstablished(
                second
        );

        verify(
                second
        ).close(
                CloseStatus.POLICY_VIOLATION
        );

        verify(
                second,
                never()
        ).sendMessage(
                org.mockito.ArgumentMatchers
                        .any()
        );

        assertThat(
                handler.activeConnectionCount()
        ).isEqualTo(
                1
        );

        assertThat(
                handler.hasConnection(
                        sessionId
                )
        ).isTrue();
    }

    @Test
    void WebSocket이_닫히면_연결_정보를_삭제한다()
            throws Exception {

        String sessionId =
                "session-123";

        browserFrameStore.publish(
                sessionId,
                createFrame()
        );

        WebSocketSession session =
                createOpenSession(
                        "ws-1",
                        sessionId,
                        BrowserFrameWebSocketHandler
                                .SUB_PROTOCOL
                );

        handler.afterConnectionEstablished(
                session
        );

        assertThat(
                handler.hasConnection(
                        sessionId
                )
        ).isTrue();

        handler.afterConnectionClosed(
                session,
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
    void 연결후_새_Frame을_publish하고_sendLatest하면_최신_sequence를_전송한다()
            throws Exception {

        String sessionId =
                "session-123";

        browserFrameStore.publish(
                sessionId,
                createFrame()
        );

        WebSocketSession session =
                createOpenSession(
                        "ws-1",
                        sessionId,
                        BrowserFrameWebSocketHandler
                                .SUB_PROTOCOL
                );

        handler.afterConnectionEstablished(
                session
        );

        /*
         * 최초 sequence=1 전송 완료.
         */
        browserFrameStore.publish(
                sessionId,
                new CapturedBrowserFrame(
                        new byte[]{
                                9, 8, 7, 6
                        },
                        1280,
                        720,
                        "image/png"
                )
        );

        handler.sendLatest(
                sessionId
        );

        ArgumentCaptor<WebSocketMessage<?>> captor =
                ArgumentCaptor.forClass(
                        WebSocketMessage.class
                );

        /*
         * Frame 2개:
         *
         * metadata + binary
         * metadata + binary
         *
         * 총 4개 메시지.
         */
        verify(
                session,
                times(4)
        ).sendMessage(
                captor.capture()
        );

        List<WebSocketMessage<?>> messages =
                captor.getAllValues();

        TextMessage secondMetadata =
                (TextMessage) messages.get(
                        2
                );

        assertThat(
                secondMetadata.getPayload()
        ).contains(
                "\"sequence\":2"
        );
    }

    private WebSocketSession createOpenSession(
            String webSocketId,
            String automationSessionId,
            String acceptedProtocol
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
                session.getId()
        ).thenReturn(
                webSocketId
        );

        when(
                session.getAttributes()
        ).thenReturn(
                attributes
        );

        when(
                session.getAcceptedProtocol()
        ).thenReturn(
                acceptedProtocol
        );

        when(
                session.isOpen()
        ).thenReturn(
                true
        );

        return session;
    }

    private CapturedBrowserFrame createFrame() {
        return new CapturedBrowserFrame(
                new byte[]{
                        1, 2, 3, 4
                },
                1280,
                720,
                "image/png"
        );
    }

    @Test
    void 같은_sequence를_sendLatest해도_중복전송하지_않는다()
            throws Exception {

        String sessionId =
                "session-duplicate";

        browserFrameStore.publish(
                sessionId,
                createFrame()
        );

        WebSocketSession session =
                createOpenSession(
                        "ws-duplicate",
                        sessionId,
                        BrowserFrameWebSocketHandler
                                .SUB_PROTOCOL
                );

        /*
         * 연결 시 sequence=1
         *
         * metadata + binary
         */
        handler.afterConnectionEstablished(
                session
        );

        /*
         * Store에 새 Frame이 없는 상태에서
         * 다시 sendLatest 호출.
         */
        handler.sendLatest(
                sessionId
        );

        /*
         * 동일 sequence이므로
         * 최초 2개 메시지만 존재해야 한다.
         */
        verify(
                session,
                times(2)
        ).sendMessage(
                org.mockito.ArgumentMatchers.any()
        );
    }
}