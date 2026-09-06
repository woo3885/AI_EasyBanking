package com.ddd.backend.websocket.config;

import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

class SessionTopicSubscriptionInterceptorTest {

    private final SessionTopicSubscriptionInterceptor interceptor =
            new SessionTopicSubscriptionInterceptor();

    @Test
    void 세션_UI_event_구독을_허용한다() {
        Message<byte[]> message = subscribe(
                "/topic/sessions/session-001/events"
        );

        assertThat(interceptor.preSend(message, mock(MessageChannel.class)))
                .isSameAs(message);
    }

    @Test
    void 변조된_구독_경로를_거부한다() {
        Message<byte[]> message = subscribe(
                "/topic/sessions/session-001/../../admin"
        );

        assertThatThrownBy(() -> interceptor.preSend(
                message, mock(MessageChannel.class)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("허용되지 않은 Session STOMP 구독 경로입니다.");
    }

    private Message<byte[]> subscribe(String destination) {
        StompHeaderAccessor accessor =
                StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        accessor.setDestination(destination);
        accessor.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }
}
