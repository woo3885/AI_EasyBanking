package com.ddd.backend.websocket.config;

import com.ddd.backend.config.RestCorsProperties;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.concurrent.ConcurrentTaskScheduler;

@Configuration(proxyBeanMethods = false)
@EnableWebSocketMessageBroker
public class WebSocketConfig
        implements WebSocketMessageBrokerConfigurer {

    public static final String STOMP_ENDPOINT = "/ws";
    public static final String APPLICATION_PREFIX = "/app";
    public static final String BROKER_PREFIX = "/topic";

    private final RestCorsProperties corsProperties;
    private final TaskScheduler heartbeatTaskScheduler;
    private final SessionTopicSubscriptionInterceptor subscriptionInterceptor;

    @Autowired
    public WebSocketConfig(
            RestCorsProperties corsProperties,
            @Qualifier("stompHeartbeatTaskScheduler")
            TaskScheduler heartbeatTaskScheduler,
            SessionTopicSubscriptionInterceptor subscriptionInterceptor
    ) {
        this.corsProperties = corsProperties;
        this.heartbeatTaskScheduler = heartbeatTaskScheduler;
        this.subscriptionInterceptor = subscriptionInterceptor;
    }

    /* 기존 단위 테스트와 독립 설정 사용 호환용. */
    public WebSocketConfig() {
        this(
                new RestCorsProperties(),
                new ConcurrentTaskScheduler(),
                new SessionTopicSubscriptionInterceptor()
        );
    }

    @Override
    public void registerStompEndpoints(
            StompEndpointRegistry registry
    ) {
        registry.addEndpoint(STOMP_ENDPOINT)
                .setAllowedOrigins(
                        corsProperties.getAllowedOrigins()
                                .toArray(String[]::new)
                );
    }

    @Override
    public void configureMessageBroker(
            MessageBrokerRegistry registry
    ) {
        registry.setApplicationDestinationPrefixes(
                APPLICATION_PREFIX
        );

        registry.enableSimpleBroker(BROKER_PREFIX)
                .setHeartbeatValue(new long[]{10_000L, 10_000L})
                .setTaskScheduler(heartbeatTaskScheduler);
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(subscriptionInterceptor);
    }
}
