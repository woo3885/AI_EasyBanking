package com.ddd.backend.websocket.frame;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration(proxyBeanMethods = false)
@EnableWebSocket
public class FrameWebSocketConfig
        implements WebSocketConfigurer {

    public static final String FRAME_ENDPOINT_PATTERN =
            "/ws/sessions/*/frames";

    private final BrowserFrameWebSocketHandler frameHandler;
    private final FrameWebSocketHandshakeInterceptor handshakeInterceptor;
    private final FrameWebSocketProperties properties;

    public FrameWebSocketConfig(
            BrowserFrameWebSocketHandler frameHandler,
            FrameWebSocketHandshakeInterceptor handshakeInterceptor,
            FrameWebSocketProperties properties
    ) {
        this.frameHandler =
                frameHandler;

        this.handshakeInterceptor =
                handshakeInterceptor;

        this.properties =
                properties;
    }

    @Override
    public void registerWebSocketHandlers(
            WebSocketHandlerRegistry registry
    ) {
        String[] allowedOrigins =
                properties.getAllowedOrigins()
                        .toArray(
                                String[]::new
                        );

        registry.addHandler(
                        frameHandler,
                        FRAME_ENDPOINT_PATTERN
                )
                .addInterceptors(
                        handshakeInterceptor
                )
                .setAllowedOrigins(
                        allowedOrigins
                );
    }
}