package com.ddd.backend.service.action;

import com.ddd.backend.api.dto.action.BrowserActionRequest;
import com.ddd.backend.api.dto.action.BrowserActionResponse;
import com.ddd.backend.api.dto.action.PublicBrowserActionSource;
import com.ddd.backend.automation.BrowserActionExecutionResult;
import com.ddd.backend.automation.BrowserActionExecutionStatus;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PublicBrowserCoordinateActionServiceTest {

    private static final String SESSION_ID =
            "session-coordinate";

    private AutomationSessionService
            automationSessionService;

    private BrowserFrameStore
            browserFrameStore;

    private BrowserActionExecutionService
            actionExecutionService;

    private PublicBrowserActionSessionState
            sessionState;

    private PublicBrowserActionService service;

    private AutomationSession session;

    @BeforeEach
    void setUp() {
        automationSessionService =
                mock(
                        AutomationSessionService.class
                );

        browserFrameStore =
                mock(
                        BrowserFrameStore.class
                );

        actionExecutionService =
                mock(
                        BrowserActionExecutionService.class
                );

        BrowserActionRequestRegistry registry =
                new BrowserActionRequestRegistry();

        sessionState =
                new PublicBrowserActionSessionState(
                        registry
                );

        service =
                new PublicBrowserActionService(
                        automationSessionService,
                        browserFrameStore,
                        actionExecutionService,
                        sessionState
                );

        session =
                AutomationSession.create(
                        "Viewer Action 테스트"
                );

        when(
                automationSessionService
                        .getSession(
                                SESSION_ID
                        )
        ).thenReturn(
                session
        );
    }

    @Test
    void 정상_좌표_CLICK을_실행하고_새_Frame을_반환한다() {
        BrowserFramePayload before =
                frame(
                        "frm-before",
                        10L
                );

        BrowserFramePayload after =
                frame(
                        "frm-after",
                        11L
                );

        when(
                browserFrameStore.latest(
                        SESSION_ID
                )
        ).thenReturn(
                Optional.of(
                        before
                ),
                Optional.of(
                        after
                )
        );

        when(
                actionExecutionService
                        .executeViewerCoordinateClick(
                                SESSION_ID,
                                320,
                                240
                        )
        ).thenReturn(
                BrowserActionExecutionResult
                        .executed(
                                BrowserActionType.CLICK
                        )
        );

        BrowserActionResponse response =
                service.execute(
                        SESSION_ID,
                        clickRequest(
                                "click-001",
                                320,
                                240,
                                before
                        )
                );

        assertThat(
                response.status()
        ).isEqualTo(
                BrowserActionExecutionStatus.EXECUTED
        );

        assertThat(
                response.frameAdvanced()
        ).isTrue();

        assertThat(
                response.frameId()
        ).isEqualTo(
                "frm-after"
        );

        assertThat(
                response.sequence()
        ).isEqualTo(
                11L
        );

        verify(
                actionExecutionService
        ).executeViewerCoordinateClick(
                SESSION_ID,
                320,
                240
        );
    }

    @Test
    void 정상_세로_SCROLL을_실행한다() {
        BrowserFramePayload before =
                frame(
                        "frm-before",
                        20L
                );

        BrowserFramePayload after =
                frame(
                        "frm-after",
                        21L
                );

        when(
                browserFrameStore.latest(
                        SESSION_ID
                )
        ).thenReturn(
                Optional.of(
                        before
                ),
                Optional.of(
                        after
                )
        );

        when(
                actionExecutionService
                        .executeViewerCoordinateScroll(
                                SESSION_ID,
                                320,
                                240,
                                0,
                                480
                        )
        ).thenReturn(
                BrowserActionExecutionResult
                        .executed(
                                BrowserActionType.SCROLL
                        )
        );

        BrowserActionResponse response =
                service.execute(
                        SESSION_ID,
                        scrollRequest(
                                "scroll-y",
                                320,
                                240,
                                0,
                                480,
                                before
                        )
                );

        assertThat(
                response.status()
        ).isEqualTo(
                BrowserActionExecutionStatus.EXECUTED
        );

        assertThat(
                response.sequence()
        ).isEqualTo(
                21L
        );
    }

    @Test
    void 정상_가로_SCROLL을_실행한다() {
        BrowserFramePayload before =
                frame(
                        "frm-before",
                        30L
                );

        BrowserFramePayload after =
                frame(
                        "frm-after",
                        31L
                );

        when(
                browserFrameStore.latest(
                        SESSION_ID
                )
        ).thenReturn(
                Optional.of(
                        before
                ),
                Optional.of(
                        after
                )
        );

        when(
                actionExecutionService
                        .executeViewerCoordinateScroll(
                                SESSION_ID,
                                400,
                                300,
                                500,
                                0
                        )
        ).thenReturn(
                BrowserActionExecutionResult
                        .executed(
                                BrowserActionType.SCROLL
                        )
        );

        service.execute(
                SESSION_ID,
                scrollRequest(
                        "scroll-x",
                        400,
                        300,
                        500,
                        0,
                        before
                )
        );

        verify(
                actionExecutionService
        ).executeViewerCoordinateScroll(
                SESSION_ID,
                400,
                300,
                500,
                0
        );
    }

    @Test
    void 범위밖_좌표_CLICK은_실행하지_않는다() {
        BrowserActionRequest request =
                new BrowserActionRequest(
                        "click-outside",
                        BrowserActionType.CLICK,
                        PublicBrowserActionSource.USER_VIEWER,
                        null,
                        1280,
                        100,
                        null,
                        null,
                        "frm-any",
                        1L
                );

        assertThatThrownBy(
                () ->
                        service.execute(
                                SESSION_ID,
                                request
                        )
        )
                .isInstanceOf(
                        IllegalArgumentException.class
                );

        verify(
                actionExecutionService,
                never()
        ).executeViewerCoordinateClick(
                SESSION_ID,
                1280,
                100
        );
    }

    @Test
    void SCROLL_delta가_둘다_0이면_거부한다() {
        BrowserActionRequest request =
                new BrowserActionRequest(
                        "scroll-zero",
                        BrowserActionType.SCROLL,
                        PublicBrowserActionSource.USER_VIEWER,
                        null,
                        320,
                        240,
                        0,
                        0,
                        "frm-any",
                        1L
                );

        assertThatThrownBy(
                () ->
                        service.execute(
                                SESSION_ID,
                                request
                        )
        )
                .isInstanceOf(
                        IllegalArgumentException.class
                );
    }

    @Test
    void SCROLL_delta가_3000을_초과하면_거부한다() {
        BrowserActionRequest request =
                new BrowserActionRequest(
                        "scroll-too-large",
                        BrowserActionType.SCROLL,
                        PublicBrowserActionSource.USER_VIEWER,
                        null,
                        320,
                        240,
                        0,
                        3001,
                        "frm-any",
                        1L
                );

        assertThatThrownBy(
                () ->
                        service.execute(
                                SESSION_ID,
                                request
                        )
        )
                .isInstanceOf(
                        IllegalArgumentException.class
                );
    }

    @Test
    void stale_Frame의_좌표_CLICK은_실행하지_않는다() {
        BrowserFramePayload current =
                frame(
                        "frm-current",
                        50L
                );

        when(
                browserFrameStore.latest(
                        SESSION_ID
                )
        ).thenReturn(
                Optional.of(
                        current
                )
        );

        BrowserActionRequest request =
                new BrowserActionRequest(
                        "click-stale",
                        BrowserActionType.CLICK,
                        PublicBrowserActionSource.USER_VIEWER,
                        null,
                        320,
                        240,
                        null,
                        null,
                        "frm-old",
                        49L
                );

        assertThatThrownBy(
                () ->
                        service.execute(
                                SESSION_ID,
                                request
                        )
        )
                .isInstanceOf(
                        BrowserActionRequestException.class
                )
                .satisfies(
                        throwable -> {

                            BrowserActionRequestException exception =
                                    (BrowserActionRequestException)
                                            throwable;

                            assertThat(
                                    exception.getErrorCode()
                            ).isEqualTo(
                                    ErrorCode.ACTION_STALE_FRAME
                            );
                        }
                );

        verify(
                actionExecutionService,
                never()
        ).executeViewerCoordinateClick(
                SESSION_ID,
                320,
                240
        );
    }

    @Test
    void 동일_requestId는_좌표_Action도_재실행하지_않는다() {
        sessionState.reserveRequest(
                SESSION_ID,
                "duplicate-coordinate"
        );

        BrowserActionRequest request =
                new BrowserActionRequest(
                        "duplicate-coordinate",
                        BrowserActionType.CLICK,
                        PublicBrowserActionSource.USER_VIEWER,
                        null,
                        320,
                        240,
                        null,
                        null,
                        "frm-any",
                        1L
                );

        assertThatThrownBy(
                () ->
                        service.execute(
                                SESSION_ID,
                                request
                        )
        )
                .isInstanceOf(
                        BrowserActionRequestException.class
                )
                .satisfies(
                        throwable -> {

                            BrowserActionRequestException exception =
                                    (BrowserActionRequestException)
                                            throwable;

                            assertThat(
                                    exception.getErrorCode()
                            ).isEqualTo(
                                    ErrorCode
                                            .ACTION_DUPLICATE_REQUEST
                            );
                        }
                );
    }

    @Test
    void RISK_WARNING에서는_일반_Viewer_Action을_차단한다() {
        session.transitionTo(
                WorkflowStatus.RISK_WARNING
        );

        BrowserActionRequest request =
                new BrowserActionRequest(
                        "risk-click",
                        BrowserActionType.CLICK,
                        PublicBrowserActionSource.USER_VIEWER,
                        null,
                        320,
                        240,
                        null,
                        null,
                        "frm-any",
                        1L
                );

        assertThatThrownBy(
                () ->
                        service.execute(
                                SESSION_ID,
                                request
                        )
        )
                .isInstanceOf(
                        BrowserActionRequestException.class
                )
                .satisfies(
                        throwable -> {

                            BrowserActionRequestException exception =
                                    (BrowserActionRequestException)
                                            throwable;

                            assertThat(
                                    exception.getErrorCode()
                            ).isEqualTo(
                                    ErrorCode.INVALID_SESSION_STATE
                            );
                        }
                );

        verify(
                actionExecutionService,
                never()
        ).executeViewerCoordinateClick(
                SESSION_ID,
                320,
                240
        );
    }

    private BrowserActionRequest clickRequest(
            String requestId,
            int x,
            int y,
            BrowserFramePayload frame
    ) {
        return new BrowserActionRequest(
                requestId,
                BrowserActionType.CLICK,
                PublicBrowserActionSource.USER_VIEWER,
                null,
                x,
                y,
                null,
                null,
                frame.metadata().frameId(),
                frame.metadata().sequence()
        );
    }

    private BrowserActionRequest scrollRequest(
            String requestId,
            int x,
            int y,
            int deltaX,
            int deltaY,
            BrowserFramePayload frame
    ) {
        return new BrowserActionRequest(
                requestId,
                BrowserActionType.SCROLL,
                PublicBrowserActionSource.USER_VIEWER,
                null,
                x,
                y,
                deltaX,
                deltaY,
                frame.metadata().frameId(),
                frame.metadata().sequence()
        );
    }

    private BrowserFramePayload frame(
            String frameId,
            long sequence
    ) {
        byte[] bytes =
                new byte[]{
                        1,
                        2,
                        3
                };

        BrowserFrameMetadata metadata =
                new BrowserFrameMetadata(
                        BrowserFrameMetadata.FRAME_TYPE,
                        SESSION_ID,
                        frameId,
                        sequence,
                        System.currentTimeMillis(),
                        1280,
                        720,
                        "image/png",
                        bytes.length
                );

        return new BrowserFramePayload(
                metadata,
                bytes
        );
    }
}