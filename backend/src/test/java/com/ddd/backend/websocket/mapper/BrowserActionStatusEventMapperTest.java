package com.ddd.backend.websocket.mapper;

import com.ddd.backend.automation.BrowserActionExecutionStatus;
import com.ddd.backend.domain.session.WorkflowStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BrowserActionStatusEventMapperTest {

    private BrowserActionStatusEventMapper mapper;

    @BeforeEach
    void setUp() {
        mapper =
                new BrowserActionStatusEventMapper();
    }

    @Test
    void 실행_완료는_AI_실행중으로_변환한다() {
        assertThat(
                mapper.toWorkflowStatus(
                        BrowserActionExecutionStatus.EXECUTED
                )
        ).isEqualTo(
                WorkflowStatus.AI_EXECUTING
        );
    }

    @Test
    void 행동_없음은_AI_실행중으로_변환한다() {
        assertThat(
                mapper.toWorkflowStatus(
                        BrowserActionExecutionStatus.NO_ACTION
                )
        ).isEqualTo(
                WorkflowStatus.AI_EXECUTING
        );
    }

    @Test
    void 사용자_행동_필요는_사용자_결정_필요로_변환한다() {
        assertThat(
                mapper.toWorkflowStatus(
                        BrowserActionExecutionStatus
                                .USER_ACTION_REQUIRED
                )
        ).isEqualTo(
                WorkflowStatus.USER_DECISION_REQUIRED
        );
    }

    @Test
    void 보안_입력_필요는_민감정보_입력_필요로_변환한다() {
        assertThat(
                mapper.toWorkflowStatus(
                        BrowserActionExecutionStatus
                                .SECURE_INPUT_REQUIRED
                )
        ).isEqualTo(
                WorkflowStatus.SECURE_INPUT_REQUIRED
        );
    }

    @Test
    void 최종_확인_필요는_최종_확인_상태로_변환한다() {
        assertThat(
                mapper.toWorkflowStatus(
                        BrowserActionExecutionStatus
                                .FINAL_CONFIRMATION_REQUIRED
                )
        ).isEqualTo(
                WorkflowStatus.FINAL_CONFIRMATION_REQUIRED
        );
    }

    @Test
    void 차단은_위험_경고로_변환한다() {
        assertThat(
                mapper.toWorkflowStatus(
                        BrowserActionExecutionStatus.BLOCKED
                )
        ).isEqualTo(
                WorkflowStatus.RISK_WARNING
        );
    }

    @Test
    void 자동화_중지는_종료_상태로_변환한다() {
        assertThat(
                mapper.toWorkflowStatus(
                        BrowserActionExecutionStatus.STOPPED
                )
        ).isEqualTo(
                WorkflowStatus.TERMINATED
        );
    }

    @Test
    void 실행_상태가_null이면_변환할_수_없다() {
        assertThatThrownBy(
                () -> mapper.toWorkflowStatus(null)
        )
                .isInstanceOf(
                        NullPointerException.class
                )
                .hasMessage(
                        "브라우저 행동 실행 상태는 필수입니다."
                );
    }

    @Test
    void 실행_상태에_맞는_메시지를_생성한다() {
        assertThat(
                mapper.message(
                        BrowserActionExecutionStatus
                                .SECURE_INPUT_REQUIRED
                )
        ).isEqualTo(
                "민감정보는 사용자가 직접 입력해야 합니다."
        );

        assertThat(
                mapper.message(
                        BrowserActionExecutionStatus.BLOCKED
                )
        ).isEqualTo(
                "보안 정책에 따라 브라우저 행동을 차단했습니다."
        );
    }
}