package com.ddd.backend.websocket.config;

import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.stereotype.Component;

import java.util.regex.Pattern;

@Component
public final class SessionTopicSubscriptionInterceptor
        implements ChannelInterceptor {

    private static final Pattern ALLOWED_DESTINATION = Pattern.compile(
            "^/topic/sessions/[A-Za-z0-9-]{1,100}/(?:status|events)$"
    );

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);
        if (accessor.getCommand() != StompCommand.SUBSCRIBE) {
            return message;
        }

        String destination = accessor.getDestination();
        if (destination == null
                || !ALLOWED_DESTINATION.matcher(destination).matches()) {
            throw new IllegalArgumentException(
                    "허용되지 않은 Session STOMP 구독 경로입니다."
            );
        }

        return message;
    }
}
