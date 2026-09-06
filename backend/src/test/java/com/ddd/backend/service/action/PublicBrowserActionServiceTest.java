package com.ddd.backend.service.action;

import com.ddd.backend.api.dto.action.BrowserActionRequest;
import com.ddd.backend.api.dto.action.BrowserActionResponse;
import com.ddd.backend.automation.BrowserActionExecutionResult;
import com.ddd.backend.automation.BrowserActionExecutionStatus;
import com.ddd.backend.automation.BrowserActionType;
import com.ddd.backend.common.exception.BrowserActionRequestException;
import com.ddd.backend.common.exception.ErrorCode;
import com.ddd.backend.domain.session.AutomationSession;
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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class PublicBrowserActionServiceTest {

    private static final String SESSION_ID =
            "session-public-action";

    private static final String ELEMENT_ID =
            "el-a1b2c3d4-001";

    private AutomationSessionService
            automationSessionService;

    private BrowserFrameStore
            browserFrameStore;

    private BrowserActionExecutionService
            actionExecutionService;

    private BrowserActionRequestRegistry
            requestRegistry;

    private PublicBrowserActionService service;

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

        requestRegistry =
                new BrowserActionRequestRegistry();

        service =
                new PublicBrowserActionService(
                        automationSessionService,
                        browserFrameStore,
                        actionExecutionService,
                        requestRegistry
                );

        when(
                automationSessionService
                        .getSession(
                                SESSION_ID
                        )
        ).thenReturn(
                AutomationSession.create(
                        "테스트 사용자 요청"
                )
        );
    }

    @Test
    void 최신_Frame의_CLICK을_실행하고_새_Frame정보를_반환한다() {
        BrowserFramePayload before =
                frame(
                        "frm-00000000-0000-0000-0000-000000000001",
                        1L
                );

        BrowserFramePayload after =
                frame(
                        "frm-00000000-0000-0000-0000-000000000002",
                        2L
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
                        .executeElementClick(
                                SESSION_ID,
                                ELEMENT_ID
                        )
        ).thenReturn(
                BrowserActionExecutionResult
                        .executed(
                                BrowserActionType.CLICK
                        )
        );

        BrowserActionRequest request =
                request(
                        "request-001",
                        before
                );

        BrowserActionResponse response =
                service.execute(
                        SESSION_ID,
                        request
                );

        assertThat(
                response.status()
        ).isEqualTo(
                BrowserActionExecutionStatus.EXECUTED
        );

        assertThat(
                response.sequence()
        ).isEqualTo(
                2L
        );

        assertThat(
                response.frameAdvanced()
        ).isTrue();

        assertThat(
                response.frameId()
        ).isEqualTo(
                after
                        .metadata()
                        .frameId()
        );

        verify(
                actionExecutionService
        ).executeElementClick(
                SESSION_ID,
                ELEMENT_ID
        );
    }

    @Test
    void 오래된_Frame요청은_CLICK전에_차단한다() {
        BrowserFramePayload current =
                frame(
                        "frm-00000000-0000-0000-0000-000000000010",
                        10L
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

        BrowserActionRequest staleRequest =
                new BrowserActionRequest(
                        "request-stale",
                        BrowserActionType.CLICK,
                        ELEMENT_ID,
                        "frm-00000000-0000-0000-0000-000000000009",
                        9L
                );

        assertThatThrownBy(
                () ->
                        service.execute(
                                SESSION_ID,
                                staleRequest
                        )
        )
                .isInstanceOf(
                        BrowserActionRequestException.class
                )
                .satisfies(
                        throwable -> {

                            BrowserActionRequestException
                                    exception =
                                    (BrowserActionRequestException)
                                            throwable;

                            assertThat(
                                    exception.getErrorCode()
                            ).isEqualTo(
                                    ErrorCode
                                            .ACTION_STALE_FRAME
                            );
                        }
                );

        verifyNoInteractions(
                actionExecutionService
        );
    }

    @Test
    void 같은_requestId는_중복실행하지_않는다() {
        requestRegistry.reserve(
                SESSION_ID,
                "request-duplicate"
        );

        BrowserActionRequest request =
                new BrowserActionRequest(
                        "request-duplicate",
                        BrowserActionType.CLICK,
                        ELEMENT_ID,
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

                            BrowserActionRequestException
                                    exception =
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

        verifyNoInteractions(
                actionExecutionService
        );
    }

    @Test
    void Frame이_없으면_Action을_실행하지_않는다() {
        when(
                browserFrameStore.latest(
                        SESSION_ID
                )
        ).thenReturn(
                Optional.empty()
        );

        BrowserActionRequest request =
                new BrowserActionRequest(
                        "request-no-frame",
                        BrowserActionType.CLICK,
                        ELEMENT_ID,
                        "frm-none",
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

                            BrowserActionRequestException
                                    exception =
                                    (BrowserActionRequestException)
                                            throwable;

                            assertThat(
                                    exception.getErrorCode()
                            ).isEqualTo(
                                    ErrorCode
                                            .ACTION_FRAME_NOT_READY
                            );
                        }
                );

        verifyNoInteractions(
                actionExecutionService
        );
    }

    @Test
    void Public_API는_CLICK외_Action을_허용하지_않는다() {
        BrowserActionRequest request =
                new BrowserActionRequest(
                        "request-type",
                        BrowserActionType.TYPE,
                        ELEMENT_ID,
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

        verifyNoInteractions(
                actionExecutionService
        );
    }

    @Test
    void 보안정책으로_Action이_중단되면_Frame은_증가하지_않는다() {
        BrowserFramePayload current =
                frame(
                        "frm-00000000-0000-0000-0000-000000000020",
                        20L
                );

        when(
                browserFrameStore.latest(
                        SESSION_ID
                )
        ).thenReturn(
                Optional.of(
                        current
                ),
                Optional.of(
                        current
                )
        );

        when(
                actionExecutionService
                        .executeElementClick(
                                SESSION_ID,
                                ELEMENT_ID
                        )
        ).thenReturn(
                BrowserActionExecutionResult
                        .finalConfirmationRequired(
                                BrowserActionType.CLICK
                        )
        );

        BrowserActionResponse response =
                service.execute(
                        SESSION_ID,
                        request(
                                "request-final",
                                current
                        )
                );

        assertThat(
                response.status()
        ).isEqualTo(
                BrowserActionExecutionStatus
                        .FINAL_CONFIRMATION_REQUIRED
        );

        assertThat(
                response.sequence()
        ).isEqualTo(
                20L
        );

        assertThat(
                response.frameAdvanced()
        ).isFalse();
    }

    private BrowserActionRequest request(
            String requestId,
            BrowserFramePayload frame
    ) {
        return new BrowserActionRequest(
                requestId,
                BrowserActionType.CLICK,
                ELEMENT_ID,
                frame
                        .metadata()
                        .frameId(),
                frame
                        .metadata()
                        .sequence()
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
                        BrowserFrameMetadata
                                .FRAME_TYPE,
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