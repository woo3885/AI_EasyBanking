package com.ddd.backend.websocket.publisher;

import com.ddd.backend.domain.session.WorkflowStatus;
import com.ddd.backend.websocket.dto.AutomationTarget;
import com.ddd.backend.websocket.dto.AutomationUiEvent;
import com.ddd.backend.websocket.dto.AutomationUiEventSnapshot;
import com.ddd.backend.websocket.dto.AutomationUiEventType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import com.ddd.backend.service.decision.UserDecisionSessionState;

class AutomationUiEventPublisherTest {

    private SimpMessagingTemplate messagingTemplate;
    private AutomationStatusEventPublisher publisher;

    @BeforeEach
    void setUp() {
        messagingTemplate = mock(SimpMessagingTemplate.class);
        publisher = new AutomationStatusEventPublisher(messagingTemplate);
    }

    @Test
    void 상태와_가이드에_세션별_증가_sequence를_발급한다() {
        publisher.publish(
                "session-001",
                WorkflowStatus.PAGE_LOADING,
                "페이지를 불러오고 있습니다."
        );

        AutomationUiEventSnapshot snapshot = publisher
                .latestSnapshot("session-001")
                .orElseThrow();

        assertThat(snapshot.state().eventType())
                .isEqualTo(AutomationUiEventType.STATE);
        assertThat(snapshot.state().eventSequence()).isEqualTo(1L);
        assertThat(snapshot.guide().eventSequence()).isEqualTo(2L);
        assertThat(snapshot.latestEventSequence()).isEqualTo(3L);
    }

    @Test
    void Target은_Frame과_Snapshot에_결합되고_clear된다() {
        AutomationTarget target = new AutomationTarget(
                "el-12345678-001",
                "예금 상품 선택",
                10, 20, 100, 40,
                "frm-001", 7L, "snap-12345678"
        );

        AutomationUiEvent targetEvent = publisher.publishTarget(
                "session-001", target, "예금 상품 선택"
        );

        assertThat(targetEvent.target().frameSequence()).isEqualTo(7L);
        assertThat(publisher.latestSnapshot("session-001").orElseThrow().target())
                .isEqualTo(targetEvent);

        AutomationUiEvent clearEvent = publisher.publishTargetClear(
                "session-001", "Action을 시작합니다."
        );

        AutomationUiEventSnapshot snapshot = publisher
                .latestSnapshot("session-001")
                .orElseThrow();

        assertThat(clearEvent.eventSequence()).isEqualTo(2L);
        assertThat(snapshot.target()).isNull();
        assertThat(snapshot.latestEventSequence()).isEqualTo(2L);

        verify(messagingTemplate).convertAndSend(
                eq("/topic/sessions/session-001/events"),
                eq(targetEvent)
        );
    }

    @Test
    void 세션별_sequence는_서로_독립적이다() {
        AutomationUiEvent first = publisher.publishGuide(
                "session-001", "첫 번째", false
        );
        AutomationUiEvent other = publisher.publishGuide(
                "session-002", "다른 세션", false
        );

        assertThat(first.eventSequence()).isEqualTo(1L);
        assertThat(other.eventSequence()).isEqualTo(1L);
    }

    @Test
    void 사용자개입과_종료_상태는_Target을_제거한다() {
        for (WorkflowStatus status : new WorkflowStatus[]{
                WorkflowStatus.SECURE_INPUT_REQUIRED,
                WorkflowStatus.FINAL_CONFIRMATION_REQUIRED,
                WorkflowStatus.RISK_WARNING,
                WorkflowStatus.COMPLETED,
                WorkflowStatus.CANCELLED,
                WorkflowStatus.ERROR,
                WorkflowStatus.TERMINATED
        }) {
            String sessionId = "session-" + status.name().replace('_', '-');
            publisher.publishTarget(
                    sessionId,
                    new AutomationTarget(
                            "el-12345678-001", "대상", 1, 1, 10, 10,
                            "frm-001", 1L, "snap-12345678"
                    ),
                    "대상"
            );

            publisher.publish(sessionId, status, "상태 변경");

            assertThat(publisher.latestSnapshot(sessionId).orElseThrow().target())
                    .as(status.name())
                    .isNull();
        }
    }

    @Test
    void PAGE_LOADING은_이전화면_Target을_latest_snapshot에서_즉시_제거한다() {
        publisher.publishTarget("session-loading",
                new AutomationTarget("el-12345678-001", "이전 대상",
                        1, 1, 10, 10, "frm-001", 1L, "snap-12345678"),
                "이전 대상");

        publisher.publish("session-loading", WorkflowStatus.PAGE_LOADING,
                "새 화면을 확인하고 있습니다.");

        assertThat(publisher.latestSnapshot("session-loading")
                .orElseThrow().target()).isNull();
    }

    @Test
    void Decision_required와_resolved를_snapshot에_반영한다() {
        com.ddd.backend.websocket.dto.AutomationDecisionPrompt prompt =
                new com.ddd.backend.websocket.dto.AutomationDecisionPrompt(
                        "req-001", "dec-001",
                        com.ddd.backend.domain.session.DecisionType.PRODUCT_SELECTION,
                        java.util.List.of(
                                new com.ddd.backend.websocket.dto.AutomationDecisionOption(
                                        "product-001", "정기예금")),
                        "frm-001", 1L);

        publisher.publishDecisionRequired(
                "session-001", prompt, "상품을 선택하세요.");
        assertThat(publisher.latestSnapshot("session-001")
                .orElseThrow().decision().decision()).isEqualTo(prompt);

        publisher.publishDecisionResolved(
                "session-001", "선택이 처리되었습니다.");
        assertThat(publisher.latestSnapshot("session-001")
                .orElseThrow().decision()).isNull();
    }

    @Test
    void 보안_위험_종료_상태는_Decision_UI와_대기상태를_정리한다() {
        UserDecisionSessionState state = new UserDecisionSessionState();
        AutomationStatusEventPublisher securedPublisher =
                new AutomationStatusEventPublisher(messagingTemplate, state);
        var prompt = new com.ddd.backend.websocket.dto.AutomationDecisionPrompt(
                "req-001", "dec-001",
                com.ddd.backend.domain.session.DecisionType.PRODUCT_SELECTION,
                java.util.List.of(new com.ddd.backend.websocket.dto.AutomationDecisionOption(
                        "product-001", "정기예금")),
                "frm-001", 1L, "snap-001");
        state.register("session-001", prompt);
        securedPublisher.publishDecisionRequired("session-001", prompt, "선택하세요.");

        securedPublisher.publish("session-001", WorkflowStatus.RISK_WARNING, "위험 상태");

        assertThat(securedPublisher.latestSnapshot("session-001").orElseThrow().decision())
                .isNull();
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> state.consume(
                "session-001",
                new com.ddd.backend.api.dto.session.SubmitDecisionRequest(
                        "req-001", "dec-001",
                        com.ddd.backend.domain.session.DecisionType.PRODUCT_SELECTION,
                        java.util.List.of("product-001"), "frm-001", 1L),
                () -> {}))
                .hasMessage("대기 중인 사용자 결정이 없습니다.");
    }

    @Test
    void secure_request는_event와_reconnect_snapshot에_복원되고_resolve로_정리된다() {
        var request = new com.ddd.backend.security.secureinput.SecureInputRequest(
                "sec-001",
                com.ddd.backend.security.secureinput.SecureInputType.ACCOUNT_PASSWORD,
                "frm-001", 9L, "직접 입력해 주세요.");

        AutomationUiEvent event = publisher.publishSecureInputRequired(
                "session-001", request);

        assertThat(event.eventType())
                .isEqualTo(AutomationUiEventType.SECURE_INPUT_REQUIRED);
        assertThat(event.secureInput()).isEqualTo(request);
        assertThat(publisher.latestSnapshot("session-001").orElseThrow()
                .secureInput().secureInput()).isEqualTo(request);

        publisher.publishSecureInputResolved("session-001", request);
        assertThat(publisher.latestSnapshot("session-001").orElseThrow()
                .secureInput()).isNull();
    }

    @Test
    void final_confirmation은_reconnect_snapshot에_복원되고_resolve로_정리된다() {
        var confirmation = new com.ddd.backend.service.confirmation.FinalConfirmationRequest(
                "confirm-001",
                com.ddd.backend.domain.session.ConfirmationType.DEPOSIT_SUBSCRIPTION,
                "el-final", "snap-001",
                new com.ddd.backend.service.confirmation.FinalConfirmationSummary(
                        "정기예금", "12개월", "1,000,000원"));

        AutomationUiEvent event = publisher.publishConfirmationRequired(
                "session-001", confirmation);

        assertThat(event.eventType())
                .isEqualTo(AutomationUiEventType.CONFIRMATION_REQUIRED);
        assertThat(event.confirmation().confirmationId())
                .isEqualTo(confirmation.confirmationId());
        assertThat(event.confirmation().summary()).isEqualTo(confirmation.summary());
        assertThat(publisher.latestSnapshot("session-001").orElseThrow()
                .confirmation().confirmation().confirmationId())
                .isEqualTo(confirmation.confirmationId());

        publisher.publishConfirmationResolved("session-001", confirmation);
        assertThat(publisher.latestSnapshot("session-001").orElseThrow()
                .confirmation()).isNull();
    }

    @Test
    void final_risk_terminal_전환은_이전_secure_request를_snapshot에서_정리한다() {
        for (WorkflowStatus status : new WorkflowStatus[]{
                WorkflowStatus.FINAL_CONFIRMATION_REQUIRED,
                WorkflowStatus.RISK_WARNING,
                WorkflowStatus.CANCELLED,
                WorkflowStatus.ERROR,
                WorkflowStatus.TERMINATED}) {
            String sessionId = "session-secure-" + status.name().replace('_', '-');
            var request = new com.ddd.backend.security.secureinput.SecureInputRequest(
                    "sec-001",
                    com.ddd.backend.security.secureinput.SecureInputType.ACCOUNT_PASSWORD,
                    "frm-001", 1L, "직접 입력해 주세요.");
            publisher.publishSecureInputRequired(sessionId, request);

            publisher.publish(sessionId, status, "상태 전환");

            assertThat(publisher.latestSnapshot(sessionId).orElseThrow().secureInput())
                    .as(status.name()).isNull();
        }
    }

    @Test
    void secure와_risk_전환은_active_confirmation과_snapshot을_identity_clear한다() {
        var store = new com.ddd.backend.service.confirmation.FinalConfirmationStore();
        publisher.setFinalConfirmationStore(store);

        for (WorkflowStatus status : new WorkflowStatus[]{
                WorkflowStatus.SECURE_INPUT_REQUIRED, WorkflowStatus.RISK_WARNING}) {
            String sessionId = "session-confirmation-"
                    + status.name().toLowerCase().replace('_', '-');
            var confirmation = store.activate(sessionId,
                    com.ddd.backend.domain.session.ConfirmationType.DEPOSIT_SUBSCRIPTION,
                    "el-final", "snap-001", "frm-001", 7L,
                    new com.ddd.backend.service.confirmation.FinalConfirmationSummary(
                            "정기예금", "12개월", "1,000,000원"));
            publisher.publishConfirmationRequired(sessionId, confirmation);

            publisher.publish(sessionId, status, "상태 전환");

            assertThat(store.active(sessionId)).isEmpty();
            assertThat(publisher.latestSnapshot(sessionId).orElseThrow().confirmation())
                    .isNull();
        }
    }
}
