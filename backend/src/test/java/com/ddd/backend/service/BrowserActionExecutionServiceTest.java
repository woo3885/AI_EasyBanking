package com.ddd.backend.service;

import com.ddd.backend.automation.BrowserAction;
import com.ddd.backend.automation.BrowserActionExecutionResult;
import com.ddd.backend.automation.BrowserActionExecutor;
import com.ddd.backend.automation.BrowserActionType;
import com.ddd.backend.common.exception.SessionNotFoundException;
import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.domain.session.WorkflowStatus;
import com.ddd.backend.frame.BrowserFrameStore;
import com.ddd.backend.infrastructure.session.InMemoryAutomationSessionRepository;
import com.ddd.backend.security.capture.BrowserFrameCaptureService;
import com.ddd.backend.security.capture.CapturedBrowserFrame;
import com.ddd.backend.security.capture.FrameCaptureAttempt;
import com.ddd.backend.security.capture.FrameCaptureDecision;
import com.ddd.backend.websocket.frame.BrowserFrameWebSocketHandler;
import com.ddd.backend.websocket.mapper.BrowserActionStatusEventMapper;
import com.ddd.backend.websocket.publisher.AutomationStatusEventPublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.inOrder;
import org.mockito.InOrder;

class BrowserActionExecutionServiceTest {

    private BrowserActionExecutor actionExecutor;

    private AutomationStatusEventPublisher statusEventPublisher;

    private InMemoryAutomationSessionRepository sessionRepository;

    private BrowserFrameCaptureService browserFrameCaptureService;

    private BrowserFrameStore browserFrameStore;

    private BrowserFrameWebSocketHandler frameWebSocketHandler;

    private BrowserActionExecutionService service;

    private CapturedBrowserFrame capturedFrame;

    @BeforeEach
    void setUp() {
        actionExecutor =
                mock(
                        BrowserActionExecutor.class
                );

        statusEventPublisher =
                mock(
                        AutomationStatusEventPublisher.class
                );

        sessionRepository =
                new InMemoryAutomationSessionRepository();

        browserFrameCaptureService =
                mock(
                        BrowserFrameCaptureService.class
                );

        browserFrameStore =
                mock(
                        BrowserFrameStore.class
                );

        frameWebSocketHandler =
                mock(
                        BrowserFrameWebSocketHandler.class
                );

        capturedFrame =
                new CapturedBrowserFrame(
                        new byte[]{
                                1, 2, 3, 4
                        },
                        1280,
                        720,
                        "image/png"
                );

        service =
                new BrowserActionExecutionService(
                        actionExecutor,
                        new BrowserActionStatusEventMapper(),
                        sessionRepository,
                        statusEventPublisher,
                        browserFrameCaptureService,
                        browserFrameStore,
                        frameWebSocketHandler
                );
    }

    @Test
    void secure_latch_중에는_일반_Action을_실행하지_않는다() {
        AutomationSession session = AutomationSession.create("보안 입력 테스트");
        sessionRepository.save(session);
        var registry = new com.ddd.backend.security.secureinput.SecureInputRegistry();
        registry.activate(session.getSessionId(),
                com.ddd.backend.security.secureinput.SecureInputType.ACCOUNT_PASSWORD,
                "frm-001", 1L, "https://demo/secure");
        service.setSecureInputRegistry(registry);

        assertThatThrownBy(() -> service.execute(
                session.getSessionId(), new BrowserAction(
                        BrowserActionType.NONE, null, null, null, null, null)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("보안 입력 중");
        verifyNoInteractions(actionExecutor);
    }

    /*
     * 기존 기능 +
     * D17 Frame 갱신 확인.
     */
    @Test
    void 행동을_실행하고_세션상태와_Viewer_Frame을_갱신한다() {
        AutomationSession session =
                createSession();

        BrowserAction action =
                createClickAction(
                        "#btn-next"
                );

        BrowserActionExecutionResult executionResult =
                BrowserActionExecutionResult.executed(
                        BrowserActionType.CLICK
                );

        when(
                actionExecutor.execute(
                        session.getSessionId(),
                        action
                )
        ).thenReturn(
                executionResult
        );

        when(
                browserFrameCaptureService.capture(
                        session.getSessionId()
                )
        ).thenReturn(
                FrameCaptureAttempt.captured(
                        capturedFrame
                )
        );

        BrowserActionExecutionResult result =
                service.execute(
                        session.getSessionId(),
                        action
                );

        assertThat(
                result
        ).isSameAs(
                executionResult
        );

        assertSessionStatus(
                session.getSessionId(),
                WorkflowStatus.PAGE_LOADING
        );

        /*
         * D17:
         * 성공한 행동 후 새 Frame 캡처.
         */
        verify(
                browserFrameCaptureService
        ).capture(
                session.getSessionId()
        );

        /*
         * 최신 Frame Store 갱신.
         */
        verify(
                browserFrameStore
        ).publishAfterAction(
                session.getSessionId(),
                capturedFrame
        );

        /*
         * 연결된 Viewer로 최신 Frame 전송.
         */
        verify(
                frameWebSocketHandler
        ).sendLatest(
                session.getSessionId()
        );

        InOrder eventOrder = inOrder(statusEventPublisher,
                browserFrameCaptureService, browserFrameStore,
                frameWebSocketHandler);
        eventOrder.verify(statusEventPublisher).publish(session.getSessionId(),
                WorkflowStatus.PAGE_LOADING,
                "변경된 화면을 안전하게 확인하고 있습니다.");
        eventOrder.verify(browserFrameCaptureService).capture(session.getSessionId());
        eventOrder.verify(browserFrameStore).publishAfterAction(
                session.getSessionId(), capturedFrame);
        eventOrder.verify(frameWebSocketHandler).sendLatest(session.getSessionId());
    }

    @Test
    void Action_성공후_동일_PNG도_Frame_sequence를_증가시킨다() {
        AutomationSession session =
                createSession();

        BrowserAction action =
                createClickAction(
                        "#btn-next"
                );

        when(
                actionExecutor.execute(
                        session.getSessionId(),
                        action
                )
        ).thenReturn(
                BrowserActionExecutionResult.executed(
                        BrowserActionType.CLICK
                )
        );

        when(
                browserFrameCaptureService.capture(
                        session.getSessionId()
                )
        ).thenReturn(
                FrameCaptureAttempt.captured(
                        capturedFrame
                )
        );

        BrowserFrameStore realFrameStore =
                new BrowserFrameStore();

        realFrameStore.publish(
                session.getSessionId(),
                capturedFrame
        );

        BrowserActionExecutionService integratedService =
                new BrowserActionExecutionService(
                        actionExecutor,
                        new BrowserActionStatusEventMapper(),
                        sessionRepository,
                        statusEventPublisher,
                        browserFrameCaptureService,
                        realFrameStore,
                        frameWebSocketHandler
                );

        integratedService.execute(
                session.getSessionId(),
                action
        );

        assertThat(
                realFrameStore.latest(
                        session.getSessionId()
                ).orElseThrow().metadata().sequence()
        ).isEqualTo(
                2L
        );

        verify(
                frameWebSocketHandler
        ).sendLatest(
                session.getSessionId()
        );
    }

    @Test
    void 사용자_선택이_필요하면_Frame을_새로_캡처하지_않는다() {
        AutomationSession session =
                createSession();

        BrowserAction action =
                createClickAction(
                        "#account-option"
                );

        BrowserActionExecutionResult executionResult =
                BrowserActionExecutionResult
                        .userActionRequired(
                                BrowserActionType.CLICK
                        );

        when(
                actionExecutor.execute(
                        session.getSessionId(),
                        action
                )
        ).thenReturn(
                executionResult
        );

        service.execute(
                session.getSessionId(),
                action
        );

        assertSessionStatus(
                session.getSessionId(),
                WorkflowStatus.USER_DECISION_REQUIRED
        );

        verify(
                statusEventPublisher
        ).publish(
                session.getSessionId(),
                WorkflowStatus.USER_DECISION_REQUIRED,
                "사용자의 선택이 필요합니다."
        );

        verify(
                browserFrameCaptureService,
                never()
        ).capture(
                session.getSessionId()
        );

        verifyNoInteractions(
                browserFrameStore,
                frameWebSocketHandler
        );
    }

    @Test
    void 민감정보_입력이_필요하면_Frame을_캡처하지_않는다() {
        AutomationSession session =
                createSession();

        BrowserAction action =
                new BrowserAction(
                        BrowserActionType.TYPE,
                        "#password",
                        "입력되지-않아야-하는-값",
                        null,
                        null,
                        null
                );

        BrowserActionExecutionResult executionResult =
                BrowserActionExecutionResult
                        .secureInputRequired(
                                BrowserActionType.TYPE
                        );

        when(
                actionExecutor.execute(
                        session.getSessionId(),
                        action
                )
        ).thenReturn(
                executionResult
        );

        service.execute(
                session.getSessionId(),
                action
        );

        assertSessionStatus(
                session.getSessionId(),
                WorkflowStatus.SECURE_INPUT_REQUIRED
        );

        verify(
                statusEventPublisher
        ).publish(
                session.getSessionId(),
                WorkflowStatus.SECURE_INPUT_REQUIRED,
                "민감정보는 사용자가 직접 입력해야 합니다."
        );

        /*
         * 보안입력 화면에서는 screenshot 자체를
         * 호출하지 않는 것이 핵심.
         */
        verify(
                browserFrameCaptureService,
                never()
        ).capture(
                session.getSessionId()
        );

        verifyNoInteractions(
                browserFrameStore,
                frameWebSocketHandler
        );
    }

    @Test
    void 최종_확인이_필요하면_Frame을_새로_캡처하지_않는다() {
        AutomationSession session =
                createSession();

        BrowserAction action =
                createClickAction(
                        "#final-submit"
                );

        BrowserActionExecutionResult executionResult =
                BrowserActionExecutionResult
                        .finalConfirmationRequired(
                                BrowserActionType.CLICK
                        );

        when(
                actionExecutor.execute(
                        session.getSessionId(),
                        action
                )
        ).thenReturn(
                executionResult
        );

        service.execute(
                session.getSessionId(),
                action
        );

        assertSessionStatus(
                session.getSessionId(),
                WorkflowStatus.FINAL_CONFIRMATION_REQUIRED
        );

        verify(
                statusEventPublisher
        ).publish(
                session.getSessionId(),
                WorkflowStatus.FINAL_CONFIRMATION_REQUIRED,
                "최종 실행 전 사용자의 확인이 필요합니다."
        );

        verify(
                browserFrameCaptureService,
                never()
        ).capture(
                session.getSessionId()
        );

        verifyNoInteractions(
                browserFrameStore,
                frameWebSocketHandler
        );
    }

    /*
     * Action은 EXECUTED였지만
     * CaptureGuard가 secure-input을 감지한 경우.
     *
     * 기존 마지막 안전 Frame을 유지해야 한다.
     */
    @Test
    void 실행후_Frame_캡처가_보안정책으로_차단되면_기존_Frame을_유지한다() {
        AutomationSession session =
                createSession();

        BrowserAction action =
                createClickAction(
                        "#next"
                );

        BrowserActionExecutionResult executionResult =
                BrowserActionExecutionResult.executed(
                        BrowserActionType.CLICK
                );

        when(
                actionExecutor.execute(
                        session.getSessionId(),
                        action
                )
        ).thenReturn(
                executionResult
        );

        when(
                browserFrameCaptureService.capture(
                        session.getSessionId()
                )
        ).thenReturn(
                FrameCaptureAttempt.blocked(
                        FrameCaptureDecision
                                .SECURE_INPUT_BLOCKED
                )
        );

        BrowserActionExecutionResult result =
                service.execute(
                        session.getSessionId(),
                        action
                );

        /*
         * Browser Action 자체는 성공.
         */
        assertThat(
                result
        ).isSameAs(
                executionResult
        );

        assertSessionStatus(
                session.getSessionId(),
                WorkflowStatus.PAGE_LOADING
        );

        /*
         * 새 Frame을 Store에 넣거나
         * Viewer로 보내면 안 된다.
         */
        verify(
                browserFrameStore,
                never()
        ).publishAfterAction(
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.any()
        );

        verify(
                frameWebSocketHandler,
                never()
        ).sendLatest(
                session.getSessionId()
        );
    }

    /*
     * Viewer Frame 캡처 자체가 실패해도
     * 이미 성공한 Browser Action을 ERROR로
     * 뒤집지 않는다.
     */
    @Test
    void Frame_캡처_오류가_발생해도_실행된_Action은_성공상태를_유지한다() {
        AutomationSession session =
                createSession();

        BrowserAction action =
                createClickAction(
                        "#next"
                );

        BrowserActionExecutionResult executionResult =
                BrowserActionExecutionResult.executed(
                        BrowserActionType.CLICK
                );

        when(
                actionExecutor.execute(
                        session.getSessionId(),
                        action
                )
        ).thenReturn(
                executionResult
        );

        when(
                browserFrameCaptureService.capture(
                        session.getSessionId()
                )
        ).thenThrow(
                new IllegalStateException(
                        "frame capture failed"
                )
        );

        BrowserActionExecutionResult result =
                service.execute(
                        session.getSessionId(),
                        action
                );

        assertThat(
                result
        ).isSameAs(
                executionResult
        );

        assertSessionStatus(
                session.getSessionId(),
                WorkflowStatus.PAGE_LOADING
        );

        verify(
                browserFrameStore,
                never()
        ).publishAfterAction(
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.any()
        );

        verify(
                frameWebSocketHandler,
                never()
        ).sendLatest(
                session.getSessionId()
        );
    }

    /*
     * Frame은 Store에 정상 저장했지만
     * Viewer WebSocket 전송이 실패한 경우.
     *
     * Action 성공 결과는 그대로 유지한다.
     */
    @Test
    void Viewer_WebSocket_전송이_실패해도_Action은_성공상태를_유지한다() {
        AutomationSession session =
                createSession();

        BrowserAction action =
                createClickAction(
                        "#next"
                );

        BrowserActionExecutionResult executionResult =
                BrowserActionExecutionResult.executed(
                        BrowserActionType.CLICK
                );

        when(
                actionExecutor.execute(
                        session.getSessionId(),
                        action
                )
        ).thenReturn(
                executionResult
        );

        when(
                browserFrameCaptureService.capture(
                        session.getSessionId()
                )
        ).thenReturn(
                FrameCaptureAttempt.captured(
                        capturedFrame
                )
        );

        doThrow(
                new IllegalStateException(
                        "viewer send failed"
                )
        ).when(
                frameWebSocketHandler
        ).sendLatest(
                session.getSessionId()
        );

        BrowserActionExecutionResult result =
                service.execute(
                        session.getSessionId(),
                        action
                );

        assertThat(
                result
        ).isSameAs(
                executionResult
        );

        assertSessionStatus(
                session.getSessionId(),
                WorkflowStatus.PAGE_LOADING
        );

        /*
         * 전송 전 Store 갱신까지는 정상 수행됨.
         */
        verify(
                browserFrameStore
        ).publishAfterAction(
                session.getSessionId(),
                capturedFrame
        );

        verify(
                frameWebSocketHandler
        ).sendLatest(
                session.getSessionId()
        );
    }

    @Test
    void 실행기가_예외를_발생시키면_ERROR_상태를_저장하고_전송한다() {
        AutomationSession session =
                createSession();

        BrowserAction action =
                createClickAction(
                        "#missing-button"
                );

        when(
                actionExecutor.execute(
                        session.getSessionId(),
                        action
                )
        ).thenThrow(
                new IllegalStateException(
                        "브라우저 행동 실행 실패"
                )
        );

        assertThatThrownBy(
                () ->
                        service.execute(
                                session.getSessionId(),
                                action
                        )
        )
                .isInstanceOf(
                        IllegalStateException.class
                )
                .hasMessage(
                        "브라우저 행동 실행 실패"
                );

        assertSessionStatus(
                session.getSessionId(),
                WorkflowStatus.ERROR
        );

        verify(
                statusEventPublisher
        ).publish(
                session.getSessionId(),
                WorkflowStatus.ERROR,
                "브라우저 행동 실행 중 오류가 발생했습니다."
        );

        /*
         * Action 자체가 실패했으므로
         * Frame 갱신은 시도하지 않는다.
         */
        verifyNoInteractions(
                browserFrameCaptureService,
                browserFrameStore,
                frameWebSocketHandler
        );
    }

    @Test
    void ERROR_이벤트_발행에_실패해도_원래_실행_예외를_유지한다() {
        AutomationSession session =
                createSession();

        BrowserAction action =
                createClickAction(
                        "#missing-button"
                );

        IllegalArgumentException originalException =
                new IllegalArgumentException(
                        "원래 실행 예외"
                );

        when(
                actionExecutor.execute(
                        session.getSessionId(),
                        action
                )
        ).thenThrow(
                originalException
        );

        doThrow(
                new IllegalStateException(
                        "WebSocket 발행 실패"
                )
        ).when(
                statusEventPublisher
        ).publish(
                session.getSessionId(),
                WorkflowStatus.ERROR,
                "브라우저 행동 실행 중 오류가 발생했습니다."
        );

        assertThatThrownBy(
                () ->
                        service.execute(
                                session.getSessionId(),
                                action
                        )
        ).isSameAs(
                originalException
        );

        assertSessionStatus(
                session.getSessionId(),
                WorkflowStatus.ERROR
        );

        verifyNoInteractions(
                browserFrameCaptureService,
                browserFrameStore,
                frameWebSocketHandler
        );
    }

    @Test
    void 존재하지_않는_세션이면_브라우저_행동을_실행하지_않는다() {
        BrowserAction action =
                createClickAction(
                        "#btn-next"
                );

        assertThatThrownBy(
                () ->
                        service.execute(
                                "not-found-session",
                                action
                        )
        )
                .isInstanceOf(
                        SessionNotFoundException.class
                );

        verifyNoInteractions(
                actionExecutor,
                statusEventPublisher,
                browserFrameCaptureService,
                browserFrameStore,
                frameWebSocketHandler
        );
    }

    private AutomationSession createSession() {
        AutomationSession session =
                AutomationSession.create(
                        "예금 가입을 도와 줘"
                );

        return sessionRepository.save(
                session
        );
    }

    private BrowserAction createClickAction(
            String targetElementId
    ) {
        return new BrowserAction(
                BrowserActionType.CLICK,
                targetElementId,
                null,
                null,
                null,
                null
        );
    }

    private void assertSessionStatus(
            String sessionId,
            WorkflowStatus expectedStatus
    ) {
        AutomationSession savedSession =
                sessionRepository
                        .findById(
                                sessionId
                        )
                        .orElseThrow();

        assertThat(
                savedSession.getStatus()
        ).isEqualTo(
                expectedStatus
        );
    }
}
