package com.ddd.backend.websocket.config;

import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.config.SimpleBrokerRegistration;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.StompWebSocketEndpointRegistration;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class WebSocketConfigTest {

    private final WebSocketConfig config =
            new WebSocketConfig();

    @Test
    void STOMP_연결_주소를_등록한다() {
        StompEndpointRegistry registry =
                mock(StompEndpointRegistry.class);

        StompWebSocketEndpointRegistration registration =
                mock(
                        StompWebSocketEndpointRegistration.class
                );

        when(
                registry.addEndpoint(
                        WebSocketConfig.STOMP_ENDPOINT
                )
        ).thenReturn(registration);

        config.registerStompEndpoints(registry);

        verify(registry).addEndpoint(
                WebSocketConfig.STOMP_ENDPOINT
        );

        verify(registration).setAllowedOrigins(
                "http://127.0.0.1:5173",
                "http://127.0.0.1:5190"
        );
    }

    @Test
    void 애플리케이션과_브로커_주소를_설정한다() {
        MessageBrokerRegistry registry =
                mock(MessageBrokerRegistry.class);

        SimpleBrokerRegistration brokerRegistration =
                mock(SimpleBrokerRegistration.class);

        when(registry.enableSimpleBroker(
                WebSocketConfig.BROKER_PREFIX
        )).thenReturn(brokerRegistration);

        when(brokerRegistration.setHeartbeatValue(
                org.mockito.ArgumentMatchers.any(long[].class)
        )).thenReturn(brokerRegistration);

        config.configureMessageBroker(registry);

        verify(registry)
                .setApplicationDestinationPrefixes(
                        WebSocketConfig.APPLICATION_PREFIX
                );

        verify(registry)
                .enableSimpleBroker(
                        WebSocketConfig.BROKER_PREFIX
                );

        verify(brokerRegistration).setHeartbeatValue(
                new long[]{10_000L, 10_000L}
        );
    }
}
