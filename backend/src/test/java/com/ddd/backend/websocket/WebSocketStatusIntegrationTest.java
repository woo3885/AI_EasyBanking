package com.ddd.backend.websocket;

import com.ddd.backend.domain.session.WorkflowStatus;
import com.ddd.backend.websocket.publisher.AutomationStatusEventPublisher;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.messaging.converter.SimpleMessageConverter;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

import java.lang.reflect.Type;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(
        webEnvironment =
                SpringBootTest.WebEnvironment.RANDOM_PORT
)
class WebSocketStatusIntegrationTest {

    @LocalServerPort
    private int port;

    @Autowired
    private AutomationStatusEventPublisher statusEventPublisher;

    private WebSocketStompClient stompClient;
    private StompSession stompSession;

    @BeforeEach
    void setUp() {
        stompClient =
                new WebSocketStompClient(
                        new StandardWebSocketClient()
                );

        stompClient.setMessageConverter(
                new SimpleMessageConverter()
        );
    }

    @AfterEach
    void tearDown() {
        if (stompSession != null
                && stompSession.isConnected()) {

            stompSession.disconnect();
        }

        if (stompClient != null) {
            stompClient.stop();
        }
    }

    @Test
    void 세션별_상태_채널을_구독하고_이벤트를_수신한다()
            throws Exception {

        String sessionId =
                "session-integration";

        String destination =
                "/topic/sessions/"
                        + sessionId
                        + "/status";

        CompletableFuture<String> receivedMessage =
                new CompletableFuture<>();

        stompSession =
                stompClient.connectAsync(
                                websocketUrl(),
                                new StompSessionHandlerAdapter() {
                                }
                        )
                        .get(
                                5,
                                TimeUnit.SECONDS
                        );

        stompSession.subscribe(
                destination,
                new StompFrameHandler() {

                    @Override
                    public Type getPayloadType(
                            StompHeaders headers
                    ) {
                        return byte[].class;
                    }

                    @Override
                    public void handleFrame(
                            StompHeaders headers,
                            Object payload
                    ) {
                        byte[] messageBytes =
                                (byte[]) payload;

                        receivedMessage.complete(
                                new String(
                                        messageBytes,
                                        StandardCharsets.UTF_8
                                )
                        );
                    }
                }
        );

        statusEventPublisher.publish(
                sessionId,
                WorkflowStatus.PAGE_LOADING,
                "금융사이트에 접속하고 있습니다."
        );

        String message =
                receivedMessage.get(
                        5,
                        TimeUnit.SECONDS
                );

        assertThat(message)
                .contains(
                        "\"sessionId\":\"session-integration\""
                );

        assertThat(message)
                .contains(
                        "\"status\":\"PAGE_LOADING\""
                );

        assertThat(message)
                .contains(
                        "\"message\":\"금융사이트에 접속하고 있습니다.\""
                );

        assertThat(message)
                .contains("\"occurredAt\"");
    }

    private String websocketUrl() {
        return "ws://127.0.0.1:"
                + port
                + "/ws";
    }
}