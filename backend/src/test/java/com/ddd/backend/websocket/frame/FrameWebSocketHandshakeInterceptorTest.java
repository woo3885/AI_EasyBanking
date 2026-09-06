package com.ddd.backend.websocket.frame;

import com.ddd.backend.frame.BrowserFrameStore;
import com.ddd.backend.security.capture.CapturedBrowserFrame;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.socket.WebSocketHandler;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FrameWebSocketHandshakeInterceptorTest {

    private BrowserFrameStore browserFrameStore;

    private FrameWebSocketHandshakeInterceptor interceptor;

    @BeforeEach
    void setUp() {
        browserFrameStore =
                new BrowserFrameStore();

        interceptor =
                new FrameWebSocketHandshakeInterceptor(
                        browserFrameStore
                );
    }

    @Test
    void Frame이_존재하는_세션이면_handshake를_허용한다() {
        String sessionId =
                "session-123";

        browserFrameStore.publish(
                sessionId,
                createFrame()
        );

        ServerHttpRequest request =
                mock(
                        ServerHttpRequest.class
                );

        ServerHttpResponse response =
                mock(
                        ServerHttpResponse.class
                );

        WebSocketHandler handler =
                mock(
                        WebSocketHandler.class
                );

        when(
                request.getURI()
        ).thenReturn(
                URI.create(
                        "http://127.0.0.1:8080"
                                + "/ws/sessions/"
                                + sessionId
                                + "/frames"
                )
        );

        Map<String, Object> attributes =
                new HashMap<>();

        boolean result =
                interceptor.beforeHandshake(
                        request,
                        response,
                        handler,
                        attributes
                );

        assertThat(
                result
        ).isTrue();

        assertThat(
                attributes
        ).containsEntry(
                FrameWebSocketHandshakeInterceptor
                        .SESSION_ID_ATTRIBUTE,
                sessionId
        );
    }

    @Test
    void 존재하지_않는_세션이면_404로_handshake를_차단한다() {
        ServerHttpRequest request =
                mock(
                        ServerHttpRequest.class
                );

        ServerHttpResponse response =
                mock(
                        ServerHttpResponse.class
                );

        WebSocketHandler handler =
                mock(
                        WebSocketHandler.class
                );

        when(
                request.getURI()
        ).thenReturn(
                URI.create(
                        "http://127.0.0.1:8080"
                                + "/ws/sessions/"
                                + "not-found-session"
                                + "/frames"
                )
        );

        Map<String, Object> attributes =
                new HashMap<>();

        boolean result =
                interceptor.beforeHandshake(
                        request,
                        response,
                        handler,
                        attributes
                );

        assertThat(
                result
        ).isFalse();

        verify(
                response
        ).setStatusCode(
                HttpStatus.NOT_FOUND
        );

        assertThat(
                attributes
        ).doesNotContainKey(
                FrameWebSocketHandshakeInterceptor
                        .SESSION_ID_ATTRIBUTE
        );
    }

    @Test
    void 잘못된_endpoint면_400으로_handshake를_차단한다() {
        ServerHttpRequest request =
                mock(
                        ServerHttpRequest.class
                );

        ServerHttpResponse response =
                mock(
                        ServerHttpResponse.class
                );

        WebSocketHandler handler =
                mock(
                        WebSocketHandler.class
                );

        when(
                request.getURI()
        ).thenReturn(
                URI.create(
                        "http://127.0.0.1:8080"
                                + "/ws/sessions/session-123/wrong"
                )
        );

        Map<String, Object> attributes =
                new HashMap<>();

        boolean result =
                interceptor.beforeHandshake(
                        request,
                        response,
                        handler,
                        attributes
                );

        assertThat(
                result
        ).isFalse();

        verify(
                response
        ).setStatusCode(
                HttpStatus.BAD_REQUEST
        );
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
}