package com.ddd.backend.service;

import com.ddd.backend.automation.session.BrowserSessionManager;
import com.ddd.backend.ai.AiDecisionExecutionService;
import com.ddd.backend.ai.AgentLoopService;
import com.ddd.backend.automation.BrowserActionExecutionResult;
import com.ddd.backend.automation.BrowserActionType;
import com.ddd.backend.automation.dom.ElementLocatorResolver;
import com.ddd.backend.common.exception.SessionNotFoundException;
import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.domain.session.DecisionType;
import com.ddd.backend.domain.session.WorkflowStatus;
import com.ddd.backend.infrastructure.session.InMemoryAutomationSessionRepository;
import com.ddd.backend.service.validation.UserDecisionValidator;
import com.ddd.backend.websocket.publisher.AutomationStatusEventPublisher;
import com.ddd.backend.api.dto.session.SubmitDecisionRequest;
import com.ddd.backend.api.dto.session.SubmitConfirmationRequest;
import com.ddd.backend.frame.BrowserFrameStore;
import com.ddd.backend.security.capture.CapturedBrowserFrame;
import com.ddd.backend.service.decision.UserDecisionSessionState;
import com.ddd.backend.websocket.dto.AutomationDecisionOption;
import com.ddd.backend.websocket.dto.AutomationDecisionPrompt;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class UserDecisionServiceTest {

    private InMemoryAutomationSessionRepository sessionRepository;
    private BrowserSessionManager browserSessionManager;
    private AutomationStatusEventPublisher statusEventPublisher;
    private UserDecisionService service;

    @BeforeEach
    void setUp() {
        sessionRepository =
                new InMemoryAutomationSessionRepository();

        browserSessionManager =
                mock(BrowserSessionManager.class);

        statusEventPublisher =
                mock(AutomationStatusEventPublisher.class);

        service =
                new UserDecisionService(
                        sessionRepository,
                        new UserDecisionValidator(),
                        browserSessionManager,
                        statusEventPublisher
                );
    }

    @Test
    void 사용자_선택을_제출하면_AI_실행_상태로_변경한다() {
        AutomationSession session =
                createSession(
                        WorkflowStatus.USER_DECISION_REQUIRED
                );

        AutomationSession result =
                service.submitDecision(
                        session.getSessionId(),
                        DecisionType.PRODUCT_SELECTION,
                        List.of("product-001")
                );

        assertThat(result.getStatus())
                .isEqualTo(
                        WorkflowStatus.AI_EXECUTING
                );

        verify(statusEventPublisher)
                .publish(
                        session.getSessionId(),
                        WorkflowStatus.AI_EXECUTING,
                        "사용자 선택이 제출되었습니다."
                );
    }

    @Test
    void 발급된_Decision과_현재_Frame이_일치할_때만_재개한다() {
        AutomationSession session = createSession(
                WorkflowStatus.USER_DECISION_REQUIRED);
        BrowserFrameStore frameStore = new BrowserFrameStore();
        var frame = frameStore.publish(
                session.getSessionId(),
                new CapturedBrowserFrame(
                        new byte[]{1, 2, 3}, 1280, 720, "image/png"));
        UserDecisionSessionState decisionState = new UserDecisionSessionState();
        decisionState.register(
                session.getSessionId(),
                new AutomationDecisionPrompt(
                        "req-001", "dec-001", DecisionType.PRODUCT_SELECTION,
                        List.of(new AutomationDecisionOption("product-001", "정기예금")),
                        frame.metadata().frameId(), frame.metadata().sequence()));

        UserDecisionService securedService = new UserDecisionService(
                sessionRepository,
                new UserDecisionValidator(),
                browserSessionManager,
                statusEventPublisher,
                decisionState,
                frameStore);
        SubmitDecisionRequest request = new SubmitDecisionRequest(
                "req-001", "dec-001", DecisionType.PRODUCT_SELECTION,
                List.of("product-001"),
                frame.metadata().frameId(), frame.metadata().sequence());

        AutomationSession result = securedService.submitDecision(
                session.getSessionId(), request);

        assertThat(result.getStatus()).isEqualTo(WorkflowStatus.AI_EXECUTING);
        assertThatThrownBy(() -> securedService.submitDecision(
                session.getSessionId(), request))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("이미 처리된 사용자 결정 요청입니다.");
    }

    @Test
    void 선택한_Element를_실행한_뒤_AI를_재호출한다() {
        AutomationSession session = createSession(WorkflowStatus.USER_DECISION_REQUIRED);
        BrowserFrameStore frameStore = new BrowserFrameStore();
        var frame = frameStore.publish(session.getSessionId(),
                new CapturedBrowserFrame(new byte[]{1}, 1280, 720, "image/png"));
        UserDecisionSessionState decisionState = new UserDecisionSessionState();
        decisionState.register(session.getSessionId(), new AutomationDecisionPrompt(
                "req-001", "dec-001", DecisionType.TERMS_AGREEMENT,
                List.of(new AutomationDecisionOption(
                        "term-required", "[필수] 서비스", true, false, false)),
                frame.metadata().frameId(), frame.metadata().sequence()));
        BrowserActionExecutionService actionService = mock(BrowserActionExecutionService.class);
        when(actionService.executeElementClick(session.getSessionId(), "term-required"))
                .thenReturn(BrowserActionExecutionResult.executed(BrowserActionType.CLICK));
        AiDecisionExecutionService aiService = mock(AiDecisionExecutionService.class);
        UserDecisionService securedService = new UserDecisionService(
                sessionRepository, new UserDecisionValidator(), browserSessionManager,
                statusEventPublisher, decisionState, frameStore, actionService, aiService);

        securedService.submitDecision(session.getSessionId(), new SubmitDecisionRequest(
                "req-001", "dec-001", DecisionType.TERMS_AGREEMENT,
                List.of("term-required"), frame.metadata().frameId(), frame.metadata().sequence()));

        verify(actionService).executeElementClick(session.getSessionId(), "term-required");
        verify(aiService).execute(session.getSessionId());
    }

    @Test
    void production_resume은_Decision_resolved_후_loop를_exactly_once_예약한다() {
        AutomationSession session = createSession(WorkflowStatus.USER_DECISION_REQUIRED);
        BrowserFrameStore frameStore = new BrowserFrameStore();
        var frame = frameStore.publish(session.getSessionId(),
                new CapturedBrowserFrame(new byte[]{1}, 1280, 720, "image/png"));
        UserDecisionSessionState state = new UserDecisionSessionState();
        state.register(session.getSessionId(), new AutomationDecisionPrompt(
                "req-order", "dec-order", DecisionType.PRODUCT_SELECTION,
                List.of(new AutomationDecisionOption("product", "상품")),
                frame.metadata().frameId(), frame.metadata().sequence(), "snap-order"));
        BrowserActionExecutionService actions = mock(BrowserActionExecutionService.class);
        when(actions.executeElementClick(session.getSessionId(), "product"))
                .thenReturn(BrowserActionExecutionResult.executed(BrowserActionType.CLICK));
        AgentLoopService coordinator = mock(AgentLoopService.class);
        when(coordinator.resume(session.getSessionId())).thenReturn(true);
        UserDecisionService secured = new UserDecisionService(
                sessionRepository, new UserDecisionValidator(), browserSessionManager,
                statusEventPublisher, state, frameStore, actions,
                mock(AiDecisionExecutionService.class), null, coordinator);

        secured.submitDecision(session.getSessionId(), new SubmitDecisionRequest(
                "req-order", "dec-order", DecisionType.PRODUCT_SELECTION,
                List.of("product"), frame.metadata().frameId(), frame.metadata().sequence()));

        org.mockito.InOrder order = org.mockito.Mockito.inOrder(
                statusEventPublisher, coordinator);
        order.verify(statusEventPublisher).publishDecisionResolved(
                session.getSessionId(), "사용자 결정이 처리되었습니다.");
        order.verify(coordinator).resume(session.getSessionId());
        verify(coordinator, org.mockito.Mockito.times(1)).resume(session.getSessionId());
        verify(statusEventPublisher, never()).publish(
                session.getSessionId(), WorkflowStatus.AI_EXECUTING,
                "사용자 선택이 제출되었습니다.");
    }

    @Test
    void 약관은_제출된_최종_선택집합과_다른_항목만_토글한다() {
        AutomationSession session = createSession(WorkflowStatus.USER_DECISION_REQUIRED);
        BrowserFrameStore frameStore = new BrowserFrameStore();
        var frame = frameStore.publish(session.getSessionId(),
                new CapturedBrowserFrame(new byte[]{1}, 1280, 720, "image/png"));
        UserDecisionSessionState state = new UserDecisionSessionState();
        state.register(session.getSessionId(), new AutomationDecisionPrompt(
                "req-sync", "dec-sync", DecisionType.TERMS_AGREEMENT,
                List.of(
                        new AutomationDecisionOption("keep", "[필수] 유지", true, true, false),
                        new AutomationDecisionOption("uncheck", "[선택] 해제", false, true, false),
                        new AutomationDecisionOption("check", "[선택] 선택", false, false, false)),
                frame.metadata().frameId(), frame.metadata().sequence(), "snap-sync"));
        BrowserActionExecutionService actions = mock(BrowserActionExecutionService.class);
        when(actions.executeElementClick(org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(BrowserActionExecutionResult.executed(BrowserActionType.CLICK));
        ElementLocatorResolver resolver = mock(ElementLocatorResolver.class);
        when(resolver.withLocator(org.mockito.ArgumentMatchers.eq(session.getSessionId()),
                org.mockito.ArgumentMatchers.eq("keep"), org.mockito.ArgumentMatchers.any()))
                .thenReturn(true);
        when(resolver.withLocator(org.mockito.ArgumentMatchers.eq(session.getSessionId()),
                org.mockito.ArgumentMatchers.eq("uncheck"), org.mockito.ArgumentMatchers.any()))
                .thenReturn(false);
        when(resolver.withLocator(org.mockito.ArgumentMatchers.eq(session.getSessionId()),
                org.mockito.ArgumentMatchers.eq("check"), org.mockito.ArgumentMatchers.any()))
                .thenReturn(true);
        AiDecisionExecutionService ai = mock(AiDecisionExecutionService.class);
        UserDecisionService secured = new UserDecisionService(
                sessionRepository, new UserDecisionValidator(), browserSessionManager,
                statusEventPublisher, state, frameStore, actions, ai, resolver);

        secured.submitDecision(session.getSessionId(), new SubmitDecisionRequest(
                "req-sync", "dec-sync", DecisionType.TERMS_AGREEMENT,
                List.of("keep", "check"), frame.metadata().frameId(),
                frame.metadata().sequence()));

        verify(actions, never()).executeElementClick(session.getSessionId(), "keep");
        verify(actions).executeElementClick(session.getSessionId(), "uncheck");
        verify(actions).executeElementClick(session.getSessionId(), "check");
        verify(ai).execute(session.getSessionId());
    }

    @Test
    void AI_재호출이_실패하면_active_Decision을_유지한다() {
        AutomationSession session = createSession(WorkflowStatus.USER_DECISION_REQUIRED);
        BrowserFrameStore frameStore = new BrowserFrameStore();
        var frame = frameStore.publish(session.getSessionId(),
                new CapturedBrowserFrame(new byte[]{1}, 1280, 720, "image/png"));
        UserDecisionSessionState state = new UserDecisionSessionState();
        state.register(session.getSessionId(), new AutomationDecisionPrompt(
                "req-retry", "dec-retry", DecisionType.PRODUCT_SELECTION,
                List.of(new AutomationDecisionOption("product", "상품")),
                frame.metadata().frameId(), frame.metadata().sequence(), "snap-retry"));
        BrowserActionExecutionService actions = mock(BrowserActionExecutionService.class);
        when(actions.executeElementClick(session.getSessionId(), "product"))
                .thenReturn(BrowserActionExecutionResult.executed(BrowserActionType.CLICK));
        AiDecisionExecutionService ai = mock(AiDecisionExecutionService.class);
        when(ai.execute(session.getSessionId())).thenThrow(new IllegalStateException("C unavailable"));
        UserDecisionService secured = new UserDecisionService(
                sessionRepository, new UserDecisionValidator(), browserSessionManager,
                statusEventPublisher, state, frameStore, actions, ai);
        SubmitDecisionRequest request = new SubmitDecisionRequest(
                "req-retry", "dec-retry", DecisionType.PRODUCT_SELECTION,
                List.of("product"), frame.metadata().frameId(), frame.metadata().sequence());

        assertThatThrownBy(() -> secured.submitDecision(session.getSessionId(), request))
                .isInstanceOf(com.ddd.backend.common.exception.UserDecisionResumeException.class)
                .hasMessage("사용자 결정 후속 처리에 실패했습니다.");

        assertThat(state.pendingPrompt(session.getSessionId()).decisionId())
                .isEqualTo("dec-retry");
        assertThat(session.getStatus()).isEqualTo(WorkflowStatus.USER_DECISION_REQUIRED);
    }

    @Test
    void 추가_정보를_제출하면_AI_실행_상태로_변경한다() {
        AutomationSession session =
                createSession(
                        WorkflowStatus.ADDITIONAL_INFORMATION_REQUIRED
                );

        AutomationSession result =
                service.submitDecision(
                        session.getSessionId(),
                        DecisionType.ADDITIONAL_INFORMATION,
                        List.of("information-001")
                );

        assertThat(result.getStatus())
                .isEqualTo(
                        WorkflowStatus.AI_EXECUTING
                );

        verify(statusEventPublisher)
                .publish(
                        session.getSessionId(),
                        WorkflowStatus.AI_EXECUTING,
                        "추가 정보가 제출되었습니다."
                );
    }

    @Test
    void 사용자_결정_대기_상태가_아니면_선택할_수_없다() {
        AutomationSession session =
                createSession(
                        WorkflowStatus.AI_EXECUTING
                );

        assertThatThrownBy(
                () -> service.submitDecision(
                        session.getSessionId(),
                        DecisionType.PRODUCT_SELECTION,
                        List.of("product-001")
                )
        )
                .isInstanceOf(
                        IllegalStateException.class
                )
                .hasMessage(
                        "사용자 결정 대기 상태에서만 선택을 제출할 수 있습니다."
                );

        verifyNoInteractions(
                statusEventPublisher
        );
    }

    @Test
    void 추가정보가_아닌_결정을_추가정보_대기상태에_제출할_수_없다() {
        AutomationSession session =
                createSession(
                        WorkflowStatus.ADDITIONAL_INFORMATION_REQUIRED
                );

        assertThatThrownBy(
                () -> service.submitDecision(
                        session.getSessionId(),
                        DecisionType.PRODUCT_SELECTION,
                        List.of("product-001")
                )
        )
                .isInstanceOf(
                        IllegalStateException.class
                );

        verifyNoInteractions(
                statusEventPublisher
        );
    }

    @Test
    void 최종_실행을_승인하면_AI_실행_상태로_변경한다() {
        AutomationSession session =
                createSession(
                        WorkflowStatus.FINAL_CONFIRMATION_REQUIRED
                );

        AutomationSession result =
                service.confirmFinalAction(
                        session.getSessionId(),
                        "confirm-001",
                        true
                );

        assertThat(result.getStatus())
                .isEqualTo(
                        WorkflowStatus.AI_EXECUTING
                );

        verify(statusEventPublisher)
                .publish(
                        session.getSessionId(),
                        WorkflowStatus.AI_EXECUTING,
                        "사용자가 최종 실행을 승인했습니다."
                );
    }

    @Test
    void 승인_API에_false를_전달하면_실패한다() {
        AutomationSession session =
                createSession(
                        WorkflowStatus.FINAL_CONFIRMATION_REQUIRED
                );

        assertThatThrownBy(
                () -> service.confirmFinalAction(
                        session.getSessionId(),
                        "confirm-001",
                        false
                )
        )
                .isInstanceOf(
                        IllegalArgumentException.class
                )
                .hasMessage(
                        "최종 실행 승인 요청에서는 approved가 true여야 합니다."
                );

        verifyNoInteractions(
                statusEventPublisher
        );
    }

    @Test
    void active_confirmation과_ID가_일치할_때만_pending_target을_한번_실행한다() {
        AutomationSession session = createSession(
                WorkflowStatus.FINAL_CONFIRMATION_REQUIRED);
        BrowserActionExecutionService executionService =
                mock(BrowserActionExecutionService.class);
        var store = new com.ddd.backend.service.confirmation.FinalConfirmationStore();
        var request = store.activate(session.getSessionId(),
                com.ddd.backend.domain.session.ConfirmationType.DEPOSIT_SUBSCRIPTION,
                "el-final", "snap-001",
                new com.ddd.backend.service.confirmation.FinalConfirmationSummary(
                        "정기예금", "12개월", "1,000,000원"));
        UserDecisionService securedService = new UserDecisionService(
                sessionRepository, new UserDecisionValidator(),
                browserSessionManager, statusEventPublisher,
                null, null, executionService, null, null);
        securedService.setFinalConfirmationStore(store);
        when(executionService.executeConfirmedFinalClick(
                session.getSessionId(), "el-final"))
                .thenReturn(BrowserActionExecutionResult.executed(
                        BrowserActionType.CLICK));

        AutomationSession result = securedService.confirmFinalAction(
                session.getSessionId(), request.confirmationId(), true);

        assertThat(result.getStatus()).isEqualTo(WorkflowStatus.AI_EXECUTING);
        verify(executionService).executeConfirmedFinalClick(
                session.getSessionId(), "el-final");
        assertThatThrownBy(() -> securedService.confirmFinalAction(
                session.getSessionId(), request.confirmationId(), true))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void consume_이후_Action_실패는_재활성화없이_identity_clear후_ERROR로_전환한다() {
        AutomationSession session = createSession(
                WorkflowStatus.FINAL_CONFIRMATION_REQUIRED);
        BrowserActionExecutionService executionService =
                mock(BrowserActionExecutionService.class);
        var store = new com.ddd.backend.service.confirmation.FinalConfirmationStore();
        var confirmation = store.activate(session.getSessionId(),
                com.ddd.backend.domain.session.ConfirmationType.DEPOSIT_SUBSCRIPTION,
                "el-final", "snap-001",
                new com.ddd.backend.service.confirmation.FinalConfirmationSummary(
                        "정기예금", "12개월", "1,000,000원"));
        UserDecisionService secured = new UserDecisionService(
                sessionRepository, new UserDecisionValidator(),
                browserSessionManager, statusEventPublisher,
                null, null, executionService, null, null);
        secured.setFinalConfirmationStore(store);
        when(executionService.executeConfirmedFinalClick(
                session.getSessionId(), "el-final"))
                .thenReturn(BrowserActionExecutionResult.blocked(BrowserActionType.CLICK));

        assertThatThrownBy(() -> secured.confirmFinalAction(
                session.getSessionId(), confirmation.confirmationId(), true))
                .isInstanceOfSatisfying(
                        com.ddd.backend.service.confirmation.ConfirmationException.class,
                        exception -> assertThat(exception.getErrorCode()).isEqualTo(
                                com.ddd.backend.common.exception.ErrorCode
                                        .CONFIRMATION_POLICY_MISMATCH));

        assertThat(store.active(session.getSessionId())).isEmpty();
        assertThat(sessionRepository.findById(session.getSessionId()).orElseThrow()
                .getStatus()).isEqualTo(WorkflowStatus.ERROR);
        verify(statusEventPublisher).publishConfirmationClear(
                session.getSessionId(), confirmation);
        verify(statusEventPublisher).publish(session.getSessionId(), WorkflowStatus.ERROR,
                "최종 실행을 안전하게 완료할 수 없어 중단했습니다.");
    }

    @Test
    void final_confirmation_이후_frame이_바뀌면_승인과_거절을_모두_차단한다() {
        AutomationSession session = createSession(
                WorkflowStatus.FINAL_CONFIRMATION_REQUIRED);
        BrowserFrameStore frameStore = new BrowserFrameStore();
        var sourceFrame = frameStore.publish(session.getSessionId(),
                new CapturedBrowserFrame(new byte[]{1}, 1280, 720, "image/png"));
        var store = new com.ddd.backend.service.confirmation.FinalConfirmationStore();
        var confirmation = store.activate(
                session.getSessionId(),
                com.ddd.backend.domain.session.ConfirmationType.DEPOSIT_SUBSCRIPTION,
                "el-final", "snap-001",
                sourceFrame.metadata().frameId(), sourceFrame.metadata().sequence(),
                new com.ddd.backend.service.confirmation.FinalConfirmationSummary(
                        "정기예금", "12개월", "1,000,000원"));
        UserDecisionService secured = new UserDecisionService(
                sessionRepository, new UserDecisionValidator(),
                browserSessionManager, statusEventPublisher,
                new UserDecisionSessionState(), frameStore);
        secured.setFinalConfirmationStore(store);

        frameStore.publishAfterAction(session.getSessionId(),
                new CapturedBrowserFrame(new byte[]{2}, 1280, 720, "image/png"));
        SubmitConfirmationRequest approve = new SubmitConfirmationRequest(
                "req-approve", confirmation.confirmationId(), true,
                sourceFrame.metadata().frameId(), sourceFrame.metadata().sequence());
        SubmitConfirmationRequest reject = new SubmitConfirmationRequest(
                "req-reject", confirmation.confirmationId(), false,
                sourceFrame.metadata().frameId(), sourceFrame.metadata().sequence());

        assertThatThrownBy(() -> secured.confirmFinalAction(
                session.getSessionId(), approve))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("오래된 Viewer Frame");
        assertThatThrownBy(() -> secured.rejectFinalAction(
                session.getSessionId(), reject))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("오래된 Viewer Frame");
        assertThat(store.active(session.getSessionId())).contains(confirmation);
    }

    @Test
    void 최종_실행을_거절하면_세션과_브라우저를_종료한다() {
        AutomationSession session =
                createSession(
                        WorkflowStatus.FINAL_CONFIRMATION_REQUIRED
                );

        when(
                browserSessionManager.exists(
                        session.getSessionId()
                )
        ).thenReturn(true);

        AutomationSession result =
                service.rejectFinalAction(
                        session.getSessionId(),
                        "confirm-001",
                        false
                );

        assertThat(result.getStatus())
                .isEqualTo(
                        WorkflowStatus.CANCELLED
                );

        verify(browserSessionManager)
                .closeSession(
                        session.getSessionId()
                );

        verify(statusEventPublisher)
                .publish(
                        session.getSessionId(),
                        WorkflowStatus.CANCELLED,
                        "최종 실행이 거절되어 세션이 취소되었습니다."
                );
    }

    @Test
    void 브라우저_세션이_없어도_최종_실행을_거절한다() {
        AutomationSession session =
                createSession(
                        WorkflowStatus.FINAL_CONFIRMATION_REQUIRED
                );

        when(
                browserSessionManager.exists(
                        session.getSessionId()
                )
        ).thenReturn(false);

        AutomationSession result =
                service.rejectFinalAction(
                        session.getSessionId(),
                        "confirm-001",
                        false
                );

        assertThat(result.getStatus())
                .isEqualTo(
                        WorkflowStatus.CANCELLED
                );

        verify(
                browserSessionManager,
                never()
        ).closeSession(
                session.getSessionId()
        );
    }

    @Test
    void 거절_API에_true를_전달하면_실패한다() {
        AutomationSession session =
                createSession(
                        WorkflowStatus.FINAL_CONFIRMATION_REQUIRED
                );

        assertThatThrownBy(
                () -> service.rejectFinalAction(
                        session.getSessionId(),
                        "confirm-001",
                        true
                )
        )
                .isInstanceOf(
                        IllegalArgumentException.class
                )
                .hasMessage(
                        "최종 실행 거절 요청에서는 approved가 false여야 합니다."
                );

        verifyNoInteractions(
                statusEventPublisher
        );
    }

    @Test
    void 존재하지_않는_세션에_선택을_제출하면_실패한다() {
        assertThatThrownBy(
                () -> service.submitDecision(
                        "not-found-session",
                        DecisionType.PRODUCT_SELECTION,
                        List.of("product-001")
                )
        )
                .isInstanceOf(
                        SessionNotFoundException.class
                );

        verifyNoInteractions(
                statusEventPublisher
        );
    }

    private AutomationSession createSession(
            WorkflowStatus status
    ) {
        AutomationSession session =
                AutomationSession.create(
                        "예금 가입을 도와 줘"
                );

        if (status
                != WorkflowStatus.SESSION_CREATED) {
            session.transitionTo(
                    status
            );
        }

        return sessionRepository.save(
                session
        );
    }
}
