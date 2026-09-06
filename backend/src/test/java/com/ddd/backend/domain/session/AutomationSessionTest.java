package com.ddd.backend.domain.session;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class AutomationSessionTest {

    @Test
    void 자동화_세션을_생성한다() {
        AutomationSession session =
                AutomationSession.create(
                        "예금 상품을 찾아 줘"
                );

        assertNotNull(session.getSessionId());
        assertEquals(
                "예금 상품을 찾아 줘",
                session.getUserRequest()
        );
        assertEquals(
                WorkflowStatus.SESSION_CREATED,
                session.getStatus()
        );
        assertNotNull(session.getCreatedAt());
        assertNotNull(session.getUpdatedAt());
    }

    @Test
    void 세션_상태를_변경한다() {
        AutomationSession session =
                createSession();

        session.transitionTo(
                WorkflowStatus.USER_DECISION_REQUIRED
        );

        assertEquals(
                WorkflowStatus.USER_DECISION_REQUIRED,
                session.getStatus()
        );
    }

    @Test
    void 사용자_결정을_제출하면_AI_실행_상태로_변경된다() {
        AutomationSession session =
                createSession();

        session.transitionTo(
                WorkflowStatus.USER_DECISION_REQUIRED
        );

        session.submitDecision();

        assertEquals(
                WorkflowStatus.AI_EXECUTING,
                session.getStatus()
        );
    }

    @Test
    void 추가_정보를_제출하면_AI_실행_상태로_변경된다() {
        AutomationSession session =
                createSession();

        session.transitionTo(
                WorkflowStatus.ADDITIONAL_INFORMATION_REQUIRED
        );

        session.submitDecision();

        assertEquals(
                WorkflowStatus.AI_EXECUTING,
                session.getStatus()
        );
    }

    @Test
    void 사용자_결정_대기_상태가_아니면_결정을_제출할_수_없다() {
        AutomationSession session =
                createSession();

        assertThrows(
                IllegalStateException.class,
                session::submitDecision
        );
    }

    @Test
    void 최종_확인을_승인하면_AI_실행_상태로_변경된다() {
        AutomationSession session =
                createSession();

        session.transitionTo(
                WorkflowStatus.FINAL_CONFIRMATION_REQUIRED
        );

        session.approveFinalConfirmation();

        assertEquals(
                WorkflowStatus.AI_EXECUTING,
                session.getStatus()
        );
    }

    @Test
    void 최종_확인을_거절하면_취소_상태로_변경된다() {
        AutomationSession session =
                createSession();

        session.transitionTo(
                WorkflowStatus.FINAL_CONFIRMATION_REQUIRED
        );

        session.rejectFinalConfirmation();

        assertEquals(
                WorkflowStatus.CANCELLED,
                session.getStatus()
        );
    }

    @Test
    void 최종_확인_대기_상태가_아니면_승인할_수_없다() {
        AutomationSession session =
                createSession();

        assertThrows(
                IllegalStateException.class,
                session::approveFinalConfirmation
        );
    }

    @Test
    void 최종_확인_대기_상태가_아니면_거절할_수_없다() {
        AutomationSession session =
                createSession();

        assertThrows(
                IllegalStateException.class,
                session::rejectFinalConfirmation
        );
    }

    @Test
    void 취소된_세션의_상태는_다시_변경할_수_없다() {
        AutomationSession session =
                createSession();

        session.cancel();

        assertThrows(
                IllegalStateException.class,
                () -> session.transitionTo(
                        WorkflowStatus.AI_EXECUTING
                )
        );
    }

    @Test
    void 진행_중인_세션을_취소한다() {
        AutomationSession session =
                createSession();

        session.transitionTo(
                WorkflowStatus.AI_EXECUTING
        );

        session.cancel();

        assertEquals(
                WorkflowStatus.CANCELLED,
                session.getStatus()
        );
    }

    private AutomationSession createSession() {
        return AutomationSession.create(
                "예금 가입을 도와 줘"
        );
    }
}