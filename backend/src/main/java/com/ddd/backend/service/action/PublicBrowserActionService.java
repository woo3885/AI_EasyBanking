package com.ddd.backend.service.action;

import com.ddd.backend.api.dto.action.BrowserActionRequest;
import com.ddd.backend.api.dto.action.BrowserActionResponse;
import com.ddd.backend.api.dto.action.PublicBrowserActionSource;
import com.ddd.backend.automation.BrowserActionExecutionResult;
import com.ddd.backend.automation.BrowserActionType;
import com.ddd.backend.common.exception.BrowserActionRequestException;
import com.ddd.backend.common.exception.ErrorCode;
import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.domain.session.WorkflowStatus;
import com.ddd.backend.frame.BrowserFrameMetadata;
import com.ddd.backend.frame.BrowserFramePayload;
import com.ddd.backend.frame.BrowserFrameStore;
import com.ddd.backend.service.AutomationSessionService;
import com.ddd.backend.service.BrowserActionExecutionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Objects;
import java.util.concurrent.locks.ReentrantLock;

@Service
public final class PublicBrowserActionService {

    public static final int VIEWPORT_WIDTH =
            1280;

    public static final int VIEWPORT_HEIGHT =
            720;

    public static final int MAX_SCROLL_DELTA =
            3000;

    private final AutomationSessionService
            automationSessionService;

    private final BrowserFrameStore
            browserFrameStore;

    private final BrowserActionExecutionService
            actionExecutionService;

    private final PublicBrowserActionSessionState
            sessionState;

    @Autowired
    public PublicBrowserActionService(
            AutomationSessionService
                    automationSessionService,
            BrowserFrameStore browserFrameStore,
            BrowserActionExecutionService
                    actionExecutionService,
            PublicBrowserActionSessionState
                    sessionState
    ) {
        this.automationSessionService =
                Objects.requireNonNull(
                        automationSessionService,
                        "AutomationSessionService는 필수입니다."
                );

        this.browserFrameStore =
                Objects.requireNonNull(
                        browserFrameStore,
                        "BrowserFrameStore는 필수입니다."
                );

        this.actionExecutionService =
                Objects.requireNonNull(
                        actionExecutionService,
                        "BrowserActionExecutionService는 필수입니다."
                );

        this.sessionState =
                Objects.requireNonNull(
                        sessionState,
                        "PublicBrowserActionSessionState는 필수입니다."
                );
    }

    /*
     * 기존 테스트 호환 생성자.
     */
    public PublicBrowserActionService(
            AutomationSessionService
                    automationSessionService,
            BrowserFrameStore browserFrameStore,
            BrowserActionExecutionService
                    actionExecutionService,
            BrowserActionRequestRegistry
                    requestRegistry
    ) {
        this(
                automationSessionService,
                browserFrameStore,
                actionExecutionService,
                new PublicBrowserActionSessionState(
                        requestRegistry
                )
        );
    }

    public BrowserActionResponse execute(
            String sessionId,
            BrowserActionRequest request
    ) {
        validateSessionId(
                sessionId
        );

        Objects.requireNonNull(
                request,
                "Browser Action 요청은 필수입니다."
        );

        validateRequestContract(
                request
        );

        ReentrantLock sessionLock =
                sessionState.lockFor(
                        sessionId
                );

        /*
         * Public Viewer Action은
         * Queue로 계속 쌓지 않는다.
         *
         * Session당 단일 in-flight.
         */
        if (!sessionLock.tryLock()) {

            throw new BrowserActionRequestException(
                    ErrorCode.ACTION_BUSY,
                    "현재 같은 Session에서 "
                            + "다른 Browser Action을 처리 중입니다."
            );
        }

        try {
            /*
             * idempotency.
             */
            if (sessionState.containsRequest(
                    sessionId,
                    request.requestId()
            )) {

                throw duplicateRequest();
            }

            /*
             * Action 직전 현재 WorkflowStatus를 다시 확인.
             */
            AutomationSession automationSession =
                    automationSessionService
                            .getSession(
                                    sessionId
                            );

            validateWorkflowStatus(
                    automationSession
            );

            BrowserFramePayload beforePayload =
                    currentFrame(
                            sessionId
                    );

            BrowserFrameMetadata beforeFrame =
                    beforePayload.metadata();

            /*
             * Frontend가 실제 보고 있는 Frame과
             * Backend latest Frame이 완전히 같은 경우만 실행.
             */
            validateExpectedFrame(
                    request,
                    beforeFrame
            );

            /*
             * Trackpad 고빈도 요청 제한.
             *
             * rate-limit 요청은 reserve하지 않기 때문에
             * 새 Frame 기준으로 다시 요청할 수 있다.
             */
            if (request.actionType()
                    == BrowserActionType.SCROLL
                    && !sessionState.allowScrollNow(
                    sessionId
            )) {

                throw new BrowserActionRequestException(
                        ErrorCode.ACTION_RATE_LIMITED,
                        "SCROLL 요청 간격이 너무 짧습니다."
                );
            }

            /*
             * 이 지점부터는 side effect 가능성이 있으므로
             * requestId를 예약한다.
             *
             * 이후 실패해도 같은 requestId로
             * 자동 재실행하지 않는다.
             */
            boolean reserved =
                    sessionState.reserveRequest(
                            sessionId,
                            request.requestId()
                    );

            if (!reserved) {
                throw duplicateRequest();
            }

            BrowserActionExecutionResult result =
                    executeAction(
                            sessionId,
                            request
                    );

            /*
             * 실행 성공이면 ExecutionService가
             * Capture → FrameStore.publish →
             * WebSocket sendLatest까지 수행한다.
             *
             * 보안 차단이면 기존 Frame 유지.
             */
            BrowserFramePayload afterPayload =
                    browserFrameStore
                            .latest(
                                    sessionId
                            )
                            .orElse(
                                    beforePayload
                            );

            return BrowserActionResponse.from(
                    request.requestId(),
                    result,
                    beforeFrame,
                    afterPayload.metadata()
            );

        } finally {

            sessionLock.unlock();
        }
    }

    public void removeSession(
            String sessionId
    ) {
        sessionState.removeSession(
                sessionId
        );
    }

    private BrowserActionExecutionResult executeAction(
            String sessionId,
            BrowserActionRequest request
    ) {
        return switch (
                request.actionType()
                ) {

            case CLICK -> {

                if (hasElementId(
                        request
                )) {

                    yield actionExecutionService
                            .executeElementClick(
                                    sessionId,
                                    request.elementId()
                            );
                }

                yield actionExecutionService
                        .executeViewerCoordinateClick(
                                sessionId,
                                request.x(),
                                request.y()
                        );
            }

            case SCROLL ->
                    actionExecutionService
                            .executeViewerCoordinateScroll(
                                    sessionId,
                                    request.x(),
                                    request.y(),
                                    request.deltaX(),
                                    request.deltaY()
                            );

            default ->
                    throw new IllegalArgumentException(
                            "Public Browser Action API는 "
                                    + "CLICK과 SCROLL만 지원합니다."
                    );
        };
    }

    private void validateRequestContract(
            BrowserActionRequest request
    ) {
        if (request.source()
                != PublicBrowserActionSource
                .USER_VIEWER) {

            throw new IllegalArgumentException(
                    "Public Browser Action source는 "
                            + "USER_VIEWER만 허용합니다."
            );
        }

        switch (
                request.actionType()
        ) {

            case CLICK ->
                    validateClickContract(
                            request
                    );

            case SCROLL ->
                    validateScrollContract(
                            request
                    );

            default ->
                    throw new IllegalArgumentException(
                            "Public Browser Action API는 "
                                    + "CLICK과 SCROLL만 지원합니다."
                    );
        }
    }

    private void validateClickContract(
            BrowserActionRequest request
    ) {
        boolean elementClick =
                hasElementId(
                        request
                );

        boolean hasX =
                request.x()
                        != null;

        boolean hasY =
                request.y()
                        != null;

        if (hasX != hasY) {

            throw new IllegalArgumentException(
                    "좌표 CLICK에는 x와 y가 모두 필요합니다."
            );
        }

        boolean coordinateClick =
                hasX
                        && hasY;

        /*
         * elementId와 좌표 중 하나만 사용.
         */
        if (elementClick
                == coordinateClick) {

            throw new IllegalArgumentException(
                    "CLICK은 elementId 또는 "
                            + "x/y 좌표 중 하나만 사용해야 합니다."
            );
        }

        if (request.deltaX() != null
                || request.deltaY() != null) {

            throw new IllegalArgumentException(
                    "CLICK에는 scroll delta를 사용할 수 없습니다."
            );
        }

        if (coordinateClick) {

            validateCoordinates(
                    request.x(),
                    request.y()
            );
        }
    }

    private void validateScrollContract(
            BrowserActionRequest request
    ) {
        if (hasElementId(
                request
        )) {

            throw new IllegalArgumentException(
                    "SCROLL에는 elementId를 사용할 수 없습니다."
            );
        }

        if (request.x() == null
                || request.y() == null) {

            throw new IllegalArgumentException(
                    "SCROLL에는 x와 y 좌표가 필요합니다."
            );
        }

        validateCoordinates(
                request.x(),
                request.y()
        );

        if (request.deltaX() == null
                || request.deltaY() == null) {

            throw new IllegalArgumentException(
                    "SCROLL에는 deltaX와 deltaY가 필요합니다."
            );
        }

        if (request.deltaX() == 0
                && request.deltaY() == 0) {

            throw new IllegalArgumentException(
                    "SCROLL deltaX와 deltaY가 "
                            + "모두 0일 수 없습니다."
            );
        }

        if (Math.abs(
                (long) request.deltaX()
        ) > MAX_SCROLL_DELTA
                || Math.abs(
                (long) request.deltaY()
        ) > MAX_SCROLL_DELTA) {

            throw new IllegalArgumentException(
                    "SCROLL delta 절댓값은 "
                            + MAX_SCROLL_DELTA
                            + " 이하여야 합니다."
            );
        }
    }

    private void validateCoordinates(
            int x,
            int y
    ) {
        if (x < 0
                || x >= VIEWPORT_WIDTH
                || y < 0
                || y >= VIEWPORT_HEIGHT) {

            throw new IllegalArgumentException(
                    "Viewer 좌표는 "
                            + VIEWPORT_WIDTH
                            + "x"
                            + VIEWPORT_HEIGHT
                            + " CSS viewport 범위 안이어야 합니다."
            );
        }
    }

    private void validateWorkflowStatus(
            AutomationSession session
    ) {
        WorkflowStatus status =
                session.getStatus();

        boolean blocked =
                status
                        == WorkflowStatus
                        .SECURE_INPUT_REQUIRED
                        || status
                        == WorkflowStatus
                        .FINAL_CONFIRMATION_REQUIRED
                        || status
                        == WorkflowStatus
                        .RISK_WARNING
                        || status
                        == WorkflowStatus
                        .COMPLETED
                        || status
                        == WorkflowStatus
                        .CANCELLED
                        || status
                        == WorkflowStatus
                        .ERROR
                        || status
                        == WorkflowStatus
                        .TERMINATED;

        if (blocked) {

            throw new BrowserActionRequestException(
                    ErrorCode.INVALID_SESSION_STATE,
                    "현재 WorkflowStatus에서는 "
                            + "일반 Viewer Action을 실행할 수 없습니다."
            );
        }
    }

    private BrowserFramePayload currentFrame(
            String sessionId
    ) {
        return browserFrameStore
                .latest(
                        sessionId
                )
                .orElseThrow(
                        () ->
                                new BrowserActionRequestException(
                                        ErrorCode
                                                .ACTION_FRAME_NOT_READY,
                                        "현재 Viewer Frame이 "
                                                + "준비되지 않았습니다."
                                )
                );
    }

    private void validateExpectedFrame(
            BrowserActionRequest request,
            BrowserFrameMetadata currentFrame
    ) {
        boolean sameFrameId =
                Objects.equals(
                        request.expectedFrameId(),
                        currentFrame.frameId()
                );

        boolean sameSequence =
                request
                        .expectedSequence()
                        .longValue()
                        == currentFrame.sequence();

        if (!sameFrameId
                || !sameSequence) {

            throw new BrowserActionRequestException(
                    ErrorCode.ACTION_STALE_FRAME,
                    "Viewer가 표시한 Frame이 이미 변경되었습니다. "
                            + "최신 Frame으로 다시 시도해 주세요."
            );
        }
    }

    private boolean hasElementId(
            BrowserActionRequest request
    ) {
        return request.elementId()
                != null
                && !request.elementId()
                .isBlank();
    }

    private BrowserActionRequestException
    duplicateRequest() {

        return new BrowserActionRequestException(
                ErrorCode
                        .ACTION_DUPLICATE_REQUEST,
                "이미 처리된 Browser Action requestId입니다."
        );
    }

    private void validateSessionId(
            String sessionId
    ) {
        if (sessionId == null
                || sessionId.isBlank()) {

            throw new IllegalArgumentException(
                    "세션 ID는 비어 있을 수 없습니다."
            );
        }
    }
}