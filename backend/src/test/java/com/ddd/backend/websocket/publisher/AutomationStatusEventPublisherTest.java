package com.ddd.backend.websocket.publisher;

import com.ddd.backend.domain.session.WorkflowStatus;
import com.ddd.backend.websocket.dto.AutomationStatusEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

class AutomationStatusEventPublisherTest {

    private SimpMessagingTemplate messagingTemplate;
    private AutomationStatusEventPublisher publisher;

    @BeforeEach
    void setUp() {
        messagingTemplate =
                mock(SimpMessagingTemplate.class);

        publisher =
                new AutomationStatusEventPublisher(
                        messagingTemplate
                );
    }

    @Test
    void 세션별_상태_채널로_이벤트를_전송한다() {
        AutomationStatusEvent event =
                AutomationStatusEvent.create(
                        "session-001",
                        WorkflowStatus.PAGE_LOADING,
                        "금융사이트에 접속하고 있습니다."
                );

        publisher.publish(event);

        verify(messagingTemplate)
                .convertAndSend(
                        "/topic/sessions/session-001/status",
                        event
                );
    }

    @Test
    void 상태값으로_이벤트를_생성해_전송한다() {
        publisher.publish(
                "session-002",
                WorkflowStatus.AI_EXECUTING,
                "다음 행동을 분석하고 있습니다."
        );

        ArgumentCaptor<AutomationStatusEvent> eventCaptor =
                ArgumentCaptor.forClass(
                        AutomationStatusEvent.class
                );

        verify(messagingTemplate)
                .convertAndSend(
                        org.mockito.ArgumentMatchers.eq(
                                "/topic/sessions/session-002/status"
                        ),
                        eventCaptor.capture()
                );

        AutomationStatusEvent event =
                eventCaptor.getValue();

        assertThat(event.sessionId())
                .isEqualTo("session-002");

        assertThat(event.status())
                .isEqualTo(
                        WorkflowStatus.AI_EXECUTING
                );

        assertThat(event.message())
                .isEqualTo(
                        "다음 행동을 분석하고 있습니다."
                );

        assertThat(event.occurredAt())
                .isNotNull();
    }

    @Test
    void 경로를_변조할_수_있는_세션_ID는_차단한다() {
        AutomationStatusEvent event =
                AutomationStatusEvent.create(
                        "session-001/admin",
                        WorkflowStatus.PAGE_LOADING,
                        null
                );

        assertThatThrownBy(
                () -> publisher.publish(event)
        )
                .isInstanceOf(
                        IllegalArgumentException.class
                )
                .hasMessage(
                        "WebSocket 전송에 사용할 수 없는 세션 ID입니다."
                );

        verifyNoInteractions(messagingTemplate);
    }

    @Test
    void null_이벤트는_전송할_수_없다() {
        assertThatThrownBy(
                () -> publisher.publish(
                        (AutomationStatusEvent) null
                )
        )
                .isInstanceOf(
                        NullPointerException.class
                )
                .hasMessage(
                        "상태 이벤트는 필수입니다."
                );

        verifyNoInteractions(messagingTemplate);
    }
}