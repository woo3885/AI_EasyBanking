package com.ddd.backend.websocket.dto;

import com.ddd.backend.domain.session.WorkflowStatus;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AutomationStatusEventTest {

    @Test
    void 상태_이벤트를_생성한다() {
        Instant occurredAt =
                Instant.parse("2026-08-03T11:00:00Z");

        AutomationStatusEvent event =
                new AutomationStatusEvent(
                        "session-001",
                        WorkflowStatus.PAGE_LOADING,
                        " 금융사이트에 접속하고 있습니다. ",
                        occurredAt
                );

        assertThat(event.sessionId())
                .isEqualTo("session-001");

        assertThat(event.status())
                .isEqualTo(WorkflowStatus.PAGE_LOADING);

        assertThat(event.message())
                .isEqualTo("금융사이트에 접속하고 있습니다.");

        assertThat(event.occurredAt())
                .isEqualTo(occurredAt);
    }

    @Test
    void 공백_메시지는_null로_변환한다() {
        AutomationStatusEvent event =
                new AutomationStatusEvent(
                        "session-001",
                        WorkflowStatus.AI_EXECUTING,
                        "   ",
                        Instant.now()
                );

        assertThat(event.message()).isNull();
    }

    @Test
    void 상태_메시지의_민감정보를_masking한다() {
        AutomationStatusEvent event = new AutomationStatusEvent(
                "session-001",
                WorkflowStatus.SECURE_INPUT_REQUIRED,
                "인증번호 123456을 입력하세요",
                Instant.now()
        );

        assertThat(event.message()).doesNotContain("123456");
        assertThat(event.message()).contains("[SECURE_CODE]");
    }

    @Test
    void 세션_ID가_비어_있으면_생성할_수_없다() {
        assertThatThrownBy(
                () -> new AutomationStatusEvent(
                        " ",
                        WorkflowStatus.PAGE_LOADING,
                        null,
                        Instant.now()
                )
        )
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage(
                        "자동화 세션 ID는 비어 있을 수 없습니다."
                );
    }

    @Test
    void 워크플로_상태가_null이면_생성할_수_없다() {
        assertThatThrownBy(
                () -> new AutomationStatusEvent(
                        "session-001",
                        null,
                        null,
                        Instant.now()
                )
        )
                .isInstanceOf(NullPointerException.class)
                .hasMessage(
                        "워크플로 상태는 필수입니다."
                );
    }

    @Test
    void 이벤트_발생_시각이_null이면_생성할_수_없다() {
        assertThatThrownBy(
                () -> new AutomationStatusEvent(
                        "session-001",
                        WorkflowStatus.PAGE_LOADING,
                        null,
                        null
                )
        )
                .isInstanceOf(NullPointerException.class)
                .hasMessage(
                        "이벤트 발생 시각은 필수입니다."
                );
    }
}
