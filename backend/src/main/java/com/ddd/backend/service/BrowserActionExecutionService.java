package com.ddd.backend.service;

import com.ddd.backend.automation.BrowserAction;
import com.ddd.backend.automation.BrowserActionExecutionResult;
import com.ddd.backend.automation.BrowserActionExecutionStatus;
import com.ddd.backend.automation.BrowserActionExecutor;
import com.ddd.backend.automation.BrowserActionType;
import com.ddd.backend.automation.ElementIdBrowserActionExecutor;
import com.ddd.backend.automation.ViewerCoordinateActionExecutor;
import com.ddd.backend.common.exception.SessionNotFoundException;
import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.domain.session.AutomationSessionRepository;
import com.ddd.backend.domain.session.WorkflowStatus;
import com.ddd.backend.frame.BrowserFrameStore;
import com.ddd.backend.security.capture.BrowserFrameCaptureService;
import com.ddd.backend.security.capture.FrameCaptureAttempt;
import com.ddd.backend.websocket.frame.BrowserFrameWebSocketHandler;
import com.ddd.backend.websocket.mapper.BrowserActionStatusEventMapper;
import com.ddd.backend.websocket.publisher.AutomationStatusEventPublisher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Objects;
import java.util.function.Supplier;
import com.ddd.backend.security.secureinput.SecureInputRegistry;
import com.ddd.backend.service.confirmation.ConfirmationException;
import com.ddd.backend.common.exception.ErrorCode;

@Service
public final class BrowserActionExecutionService {

    private static final Logger log =
            LoggerFactory.getLogger(
                    BrowserActionExecutionService.class
            );

    private static final String
            EXECUTION_ERROR_MESSAGE =
            "브라우저 행동 실행 중 오류가 발생했습니다.";

    private final BrowserActionExecutor
            actionExecutor;

    private final BrowserActionStatusEventMapper
            statusEventMapper;

    private final AutomationSessionRepository
            sessionRepository;

    private final AutomationStatusEventPublisher
            statusEventPublisher;

    private final BrowserFrameCaptureService
            browserFrameCaptureService;

    private final BrowserFrameStore
            browserFrameStore;

    private final BrowserFrameWebSocketHandler
            frameWebSocketHandler;

    private final ElementIdBrowserActionExecutor
            elementIdActionExecutor;

    private final ViewerCoordinateActionExecutor
            coordinateActionExecutor;
    private SecureInputRegistry secureInputRegistry;

    @Autowired
    void setSecureInputRegistry(SecureInputRegistry secureInputRegistry) {
        this.secureInputRegistry = secureInputRegistry;
    }

    @Autowired
    public BrowserActionExecutionService(
            BrowserActionExecutor actionExecutor,
            BrowserActionStatusEventMapper statusEventMapper,
            AutomationSessionRepository sessionRepository,
            AutomationStatusEventPublisher statusEventPublisher,
            BrowserFrameCaptureService browserFrameCaptureService,
            BrowserFrameStore browserFrameStore,
            BrowserFrameWebSocketHandler frameWebSocketHandler,
            ElementIdBrowserActionExecutor
                    elementIdActionExecutor,
            ViewerCoordinateActionExecutor
                    coordinateActionExecutor
    ) {
        this(
                actionExecutor,
                statusEventMapper,
                sessionRepository,
                statusEventPublisher,
                browserFrameCaptureService,
                browserFrameStore,
                frameWebSocketHandler,
                elementIdActionExecutor,
                coordinateActionExecutor,
                false
        );
    }

    /*
     * 기존 D19 테스트 호환 생성자.
     */
    public BrowserActionExecutionService(
            BrowserActionExecutor actionExecutor,
            BrowserActionStatusEventMapper statusEventMapper,
            AutomationSessionRepository sessionRepository,
            AutomationStatusEventPublisher statusEventPublisher,
            BrowserFrameCaptureService browserFrameCaptureService,
            BrowserFrameStore browserFrameStore,
            BrowserFrameWebSocketHandler frameWebSocketHandler,
            ElementIdBrowserActionExecutor
                    elementIdActionExecutor
    ) {
        this(
                actionExecutor,
                statusEventMapper,
                sessionRepository,
                statusEventPublisher,
                browserFrameCaptureService,
                browserFrameStore,
                frameWebSocketHandler,
                elementIdActionExecutor,
                null,
                true
        );
    }

    /*
     * 더 오래된 테스트 호환 생성자.
     */
    public BrowserActionExecutionService(
            BrowserActionExecutor actionExecutor,
            BrowserActionStatusEventMapper statusEventMapper,
            AutomationSessionRepository sessionRepository,
            AutomationStatusEventPublisher statusEventPublisher,
            BrowserFrameCaptureService browserFrameCaptureService,
            BrowserFrameStore browserFrameStore,
            BrowserFrameWebSocketHandler frameWebSocketHandler
    ) {
        this(
                actionExecutor,
                statusEventMapper,
                sessionRepository,
                statusEventPublisher,
                browserFrameCaptureService,
                browserFrameStore,
                frameWebSocketHandler,
                null,
                null,
                true
        );
    }

    private BrowserActionExecutionService(
            BrowserActionExecutor actionExecutor,
            BrowserActionStatusEventMapper statusEventMapper,
            AutomationSessionRepository sessionRepository,
            AutomationStatusEventPublisher statusEventPublisher,
            BrowserFrameCaptureService browserFrameCaptureService,
            BrowserFrameStore browserFrameStore,
            BrowserFrameWebSocketHandler frameWebSocketHandler,
            ElementIdBrowserActionExecutor
                    elementIdActionExecutor,
            ViewerCoordinateActionExecutor
                    coordinateActionExecutor,
            boolean allowMissingPublicExecutors
    ) {
        this.actionExecutor =
                Objects.requireNonNull(
                        actionExecutor,
                        "BrowserActionExecutor는 필수입니다."
                );

        this.statusEventMapper =
                Objects.requireNonNull(
                        statusEventMapper,
                        "BrowserActionStatusEventMapper는 필수입니다."
                );

        this.sessionRepository =
                Objects.requireNonNull(
                        sessionRepository,
                        "AutomationSessionRepository는 필수입니다."
                );

        this.statusEventPublisher =
                Objects.requireNonNull(
                        statusEventPublisher,
                        "AutomationStatusEventPublisher는 필수입니다."
                );

        this.browserFrameCaptureService =
                Objects.requireNonNull(
                        browserFrameCaptureService,
                        "BrowserFrameCaptureService는 필수입니다."
                );

        this.browserFrameStore =
                Objects.requireNonNull(
                        browserFrameStore,
                        "BrowserFrameStore는 필수입니다."
                );

        this.frameWebSocketHandler =
                Objects.requireNonNull(
                        frameWebSocketHandler,
                        "BrowserFrameWebSocketHandler는 필수입니다."
                );

        if (allowMissingPublicExecutors) {

            this.elementIdActionExecutor =
                    elementIdActionExecutor;

            this.coordinateActionExecutor =
                    coordinateActionExecutor;

        } else {

            this.elementIdActionExecutor =
                    Objects.requireNonNull(
                            elementIdActionExecutor,
                            "ElementIdBrowserActionExecutor는 필수입니다."
                    );

            this.coordinateActionExecutor =
                    Objects.requireNonNull(
                            coordinateActionExecutor,
                            "ViewerCoordinateActionExecutor는 필수입니다."
                    );
        }
    }

    public BrowserActionExecutionResult execute(
            String sessionId,
            BrowserAction action
    ) {
        return executeInternal(
                sessionId,
                () ->
                        actionExecutor.execute(
                                sessionId,
                                action
                        )
        );
    }

    public BrowserActionExecutionResult
    executeElementClick(
            String sessionId,
            String elementId
    ) {
        requireElementIdExecutor();

        return executeInternal(
                sessionId,
                () ->
                        elementIdActionExecutor
                                .executeUserClick(
                                        sessionId,
                                        elementId
                                )
        );
    }

    public BrowserActionExecutionResult executeConfirmedFinalClick(
            String sessionId, String elementId
    ) {
        requireElementIdExecutor();
        return executeInternal(sessionId, () -> elementIdActionExecutor
                .executeConfirmedFinalClick(sessionId, elementId), true);
    }

    public BrowserActionExecutionResult
    executeViewerCoordinateClick(
            String sessionId,
            int x,
            int y
    ) {
        requireCoordinateExecutor();

        return executeInternal(
                sessionId,
                () ->
                        coordinateActionExecutor
                                .executeClick(
                                        sessionId,
                                        x,
                                        y
                                )
        );
    }

    public BrowserActionExecutionResult
    executeViewerCoordinateScroll(
            String sessionId,
            int x,
            int y,
            int deltaX,
            int deltaY
    ) {
        requireCoordinateExecutor();

        return executeInternal(
                sessionId,
                () ->
                        coordinateActionExecutor
                                .executeScroll(
                                        sessionId,
                                        x,
                                        y,
                                        deltaX,
                                        deltaY
                                )
        );
    }

    public BrowserActionExecutionResult
    executeAiElementAction(
            String sessionId,
            BrowserActionType actionType,
            String elementId,
            String value
    ) {
        requireElementIdExecutor();

        return executeInternal(
                sessionId,
                () ->
                        elementIdActionExecutor
                                .executeAiAction(
                                        sessionId,
                                        actionType,
                                        elementId,
                                        value
                                )
        );
    }

    private BrowserActionExecutionResult
    executeInternal(
            String sessionId,
            Supplier<BrowserActionExecutionResult>
                    execution
    ) {
        return executeInternal(sessionId, execution, false);
    }

    private BrowserActionExecutionResult executeInternal(
            String sessionId,
            Supplier<BrowserActionExecutionResult> execution,
            boolean requireFreshFrame
    ) {
        Objects.requireNonNull(
                execution,
                "Browser Action 실행 작업은 필수입니다."
        );

        if (secureInputRegistry != null && secureInputRegistry.isActive(sessionId)) {
            throw new IllegalStateException("보안 입력 중에는 일반 Browser Action을 실행할 수 없습니다.");
        }

        AutomationSession session =
                getSession(
                        sessionId
                );

        BrowserActionExecutionResult result;

        try {
            result =
                    execution.get();

        } catch (RuntimeException executionException) {
            if (!requireFreshFrame) {
                updateExecutionErrorStatusSafely(session);
                publishExecutionErrorSafely(sessionId);
            }

            throw executionException;
        }

        Objects.requireNonNull(
                result,
                "브라우저 행동 실행 결과는 필수입니다."
        );

        WorkflowStatus workflowStatus =
                statusEventMapper
                        .toWorkflowStatus(
                                result.status()
                        );

        String message =
                statusEventMapper
                        .message(
                                result.status()
                        );

        if (result.status() == BrowserActionExecutionStatus.EXECUTED) {
            session.transitionTo(WorkflowStatus.PAGE_LOADING);
            sessionRepository.save(session);
            statusEventPublisher.publish(sessionId, WorkflowStatus.PAGE_LOADING,
                    "변경된 화면을 안전하게 확인하고 있습니다.");
            boolean frameReady = refreshFrameAfterExecutedActionSafely(sessionId, result);
            if (requireFreshFrame && !frameReady) {
                throw new ConfirmationException(
                        ErrorCode.CONFIRMATION_FRAME_CAPTURE_FAILED);
            }
            return result;
        }

        if (requireFreshFrame) {
            return result;
        }

        session.transitionTo(workflowStatus);

        sessionRepository.save(
                session
        );

        statusEventPublisher.publish(
                sessionId,
                workflowStatus,
                message
        );

        return result;
    }

    private boolean
    refreshFrameAfterExecutedActionSafely(
            String sessionId,
            BrowserActionExecutionResult result
    ) {
        if (result.status()
                != BrowserActionExecutionStatus
                .EXECUTED) {

            return false;
        }

        try {
            FrameCaptureAttempt captureAttempt =
                    browserFrameCaptureService
                            .capture(
                                    sessionId
                            );

            if (!captureAttempt.captured()
                    || captureAttempt.frame()
                    == null) {

                return false;
            }

            browserFrameStore.publishAfterAction(
                    sessionId,
                    captureAttempt.frame()
            );

            frameWebSocketHandler.sendLatest(
                    sessionId
            );
            return true;

        } catch (RuntimeException frameException) {

            /*
             * Action 자체는 이미 실행됐다.
             *
             * Frame 전송 실패 때문에
             * CLICK/SCROLL을 다시 실행하면 안 된다.
             */
            log.warn(
                    "Browser Viewer Frame 갱신 실패. "
                            + "exceptionType={}",
                    frameException
                            .getClass()
                            .getSimpleName()
            );
            return false;
        }
    }

    private void requireElementIdExecutor() {
        if (elementIdActionExecutor == null) {

            throw new IllegalStateException(
                    "elementId Action 실행기가 구성되지 않았습니다."
            );
        }
    }

    private void requireCoordinateExecutor() {
        if (coordinateActionExecutor == null) {

            throw new IllegalStateException(
                    "좌표 Browser Action 실행기가 구성되지 않았습니다."
            );
        }
    }

    private AutomationSession getSession(
            String sessionId
    ) {
        if (sessionId == null
                || sessionId.isBlank()) {

            throw new IllegalArgumentException(
                    "세션 ID는 비어 있을 수 없습니다."
            );
        }

        return sessionRepository
                .findById(
                        sessionId
                )
                .orElseThrow(
                        () ->
                                new SessionNotFoundException(
                                        sessionId
                                )
                );
    }

    private void
    updateExecutionErrorStatusSafely(
            AutomationSession session
    ) {
        try {
            session.transitionTo(
                    WorkflowStatus.ERROR
            );

            sessionRepository.save(
                    session
            );

        } catch (RuntimeException updateException) {

            log.warn(
                    "브라우저 실행 오류 상태 저장 실패. "
                            + "sessionId={}, "
                            + "exceptionType={}",
                    session.getSessionId(),
                    updateException
                            .getClass()
                            .getSimpleName()
            );
        }
    }

    private void
    publishExecutionErrorSafely(
            String sessionId
    ) {
        try {
            statusEventPublisher.publish(
                    sessionId,
                    WorkflowStatus.ERROR,
                    EXECUTION_ERROR_MESSAGE
            );

        } catch (RuntimeException publishException) {

            log.warn(
                    "WebSocket 오류 상태 이벤트 발행 실패. "
                            + "sessionId={}, "
                            + "exceptionType={}",
                    sessionId,
                    publishException
                            .getClass()
                            .getSimpleName()
            );
        }
    }
}
