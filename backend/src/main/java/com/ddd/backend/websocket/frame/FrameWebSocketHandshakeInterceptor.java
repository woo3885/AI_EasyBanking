package com.ddd.backend.websocket.frame;

import com.ddd.backend.frame.BrowserFrameStore;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public final class FrameWebSocketHandshakeInterceptor
        implements HandshakeInterceptor {

    public static final String SESSION_ID_ATTRIBUTE =
            "dddFrameSessionId";

    private static final Pattern FRAME_PATH_PATTERN =
            Pattern.compile(
                    "^/ws/sessions/"
                            + "([a-zA-Z0-9-]{1,100})"
                            + "/frames$"
            );

    private final BrowserFrameStore browserFrameStore;

    public FrameWebSocketHandshakeInterceptor(
            BrowserFrameStore browserFrameStore
    ) {
        this.browserFrameStore =
                Objects.requireNonNull(
                        browserFrameStore,
                        "BrowserFrameStore는 필수입니다."
                );
    }

    @Override
    public boolean beforeHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Map<String, Object> attributes
    ) {
        String path =
                request.getURI()
                        .getPath();

        Matcher matcher =
                FRAME_PATH_PATTERN.matcher(
                        path
                );

        /*
         * /ws/sessions/{sessionId}/frames
         * 정확한 형태만 허용.
         */
        if (!matcher.matches()) {
            response.setStatusCode(
                    HttpStatus.BAD_REQUEST
            );

            return false;
        }

        String sessionId =
                matcher.group(
                        1
                );

        /*
         * D17 세션 생성 과정에서
         * 첫 Frame이 정상적으로 저장된 세션만
         * WebSocket 연결을 허용한다.
         *
         * 없는 세션 ID를 임의로 넣어
         * 다른 세션 Frame을 조회하는 것을 방지한다.
         */
        if (browserFrameStore.latest(
                sessionId
        ).isEmpty()) {

            response.setStatusCode(
                    HttpStatus.NOT_FOUND
            );

            return false;
        }

        /*
         * Handshake에서 검증한 sessionId를
         * WebSocketSession attribute로 넘긴다.
         */
        attributes.put(
                SESSION_ID_ATTRIBUTE,
                sessionId
        );

        return true;
    }

    @Override
    public void afterHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Exception exception
    ) {
        /*
         * 별도 후처리 없음.
         */
    }
}