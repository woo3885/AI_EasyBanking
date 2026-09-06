package com.ddd.backend.service;

import com.ddd.backend.automation.session.BrowserSessionManager;
import com.ddd.backend.common.exception.SessionNotFoundException;
import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.domain.session.WorkflowStatus;
import com.ddd.backend.frame.BrowserFramePayload;
import com.ddd.backend.frame.BrowserFrameStore;
import com.ddd.backend.infrastructure.session.InMemoryAutomationSessionRepository;
import com.ddd.backend.security.capture.BrowserFrameCaptureService;
import com.ddd.backend.security.capture.CapturedBrowserFrame;
import com.ddd.backend.security.capture.FrameCaptureAttempt;
import com.ddd.backend.security.capture.FrameCaptureDecision;
import com.ddd.backend.security.navigation.DemoNavigationPolicy;
import com.ddd.backend.security.navigation.DemoNavigationTarget;
import com.ddd.backend.websocket.publisher.AutomationStatusEventPublisher;
import com.ddd.backend.ai.AgentLoopService;
import com.ddd.backend.automation.dom.SanitizedDomSnapshotService;
import com.ddd.backend.service.action.PublicBrowserActionSessionState;
import com.ddd.backend.service.decision.UserDecisionSessionState;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AutomationSessionServiceTest {

    private static final String DEMO_SITE_ID =
            "demo-bank";

    private static final String ACCOUNTS_PATH =
            "/transfer/accounts";

    private static final String ACCOUNTS_URL =
            "http://127.0.0.1:5190/transfer/accounts";

    private InMemoryAutomationSessionRepository repository;

    private AutomationSessionService sessionService;

    private BrowserSessionManager browserSessionManager;

    private AutomationStatusEventPublisher statusEventPublisher;

    private DemoNavigationPolicy demoNavigationPolicy;

    private BrowserFrameCaptureService browserFrameCaptureService;

    private BrowserFrameStore browserFrameStore;

    private DemoNavigationTarget navigationTarget;

    private CapturedBrowserFrame capturedFrame;

    @BeforeEach
    void setUp() {
        repository =
                new InMemoryAutomationSessionRepository();

        browserSessionManager =
                mock(
                        BrowserSessionManager.class
                );

        statusEventPublisher =
                mock(
                        AutomationStatusEventPublisher.class
                );

        demoNavigationPolicy =
                mock(
                        DemoNavigationPolicy.class
                );

        browserFrameCaptureService =
                mock(
                        BrowserFrameCaptureService.class
                );

        /*
         * FrameStore는 실제 객체를 사용한다.
         */
        browserFrameStore =
                new BrowserFrameStore();

        navigationTarget =
                new DemoNavigationTarget(
                        DEMO_SITE_ID,
                        ACCOUNTS_PATH,
                        URI.create(
                                ACCOUNTS_URL
                        )
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

        sessionService =
                new AutomationSessionService(
                        repository,
                        browserSessionManager,
                        statusEventPublisher,
                        demoNavigationPolicy,
                        browserFrameCaptureService,
                        browserFrameStore
                );
    }

    /*
     * 기존 createSession(String) 회귀 테스트 +
     * D7 lastAccessedAt 초기화 검증.
     */
    @Test
    void 자동화_세션을_생성한다() {
        AutomationSession session =
                sessionService.createSession(
                        "적금 상품을 비교해 줘"
                );

        assertNotNull(
                session.getSessionId()
        );

        assertEquals(
                "적금 상품을 비교해 줘",
                session.getUserRequest()
        );

        assertEquals(
                WorkflowStatus.SESSION_CREATED,
                session.getStatus()
        );

        assertNotNull(
                session.getCreatedAt()
        );

        assertNotNull(
                session.getUpdatedAt()
        );

        /*
         * D7
         */
        assertNotNull(
                session.getLastAccessedAt()
        );

        /*
         * 기존 호환 생성에서는
         * 실제 navigation을 하지 않으므로 null.
         */
        assertNull(
                session.getCurrentUrl()
        );

        verify(
                browserSessionManager
        ).createSession(
                session.getSessionId()
        );

        verify(
                statusEventPublisher
        ).publish(
                session.getSessionId(),
                WorkflowStatus.SESSION_CREATED,
                "자동화 세션이 생성되었습니다."
        );

        verify(
                browserFrameCaptureService,
                never()
        ).capture(
                anyString()
        );
    }

    /*
     * D17 + D7 핵심.
     *
     * 페이지 이동 후:
     * - 실제 final URL 저장
     * - lastAccessedAt 갱신
     * - 첫 Frame sequence=1 저장
     */
    @Test
    void D17_세션_생성시_URL과_최초_Frame을_저장한다() {
        when(
                demoNavigationPolicy.resolve(
                        DEMO_SITE_ID,
                        ACCOUNTS_PATH
                )
        ).thenReturn(
                navigationTarget
        );

        when(
                browserSessionManager.navigate(
                        anyString(),
                        eq(
                                navigationTarget.targetUri()
                        )
                )
        ).thenReturn(
                ACCOUNTS_URL
        );

        when(
                browserFrameCaptureService.capture(
                        anyString()
                )
        ).thenReturn(
                FrameCaptureAttempt.captured(
                        capturedFrame
                )
        );

        AutomationSession session =
                sessionService.createSession(
                        "계좌 선택 화면을 확인합니다.",
                        DEMO_SITE_ID,
                        ACCOUNTS_PATH
                );

        assertNotNull(
                session.getSessionId()
        );

        assertEquals(
                WorkflowStatus.SESSION_CREATED,
                session.getStatus()
        );

        /*
         * D7
         * 실제 navigation 완료 URL이
         * 세션에 기록되어야 한다.
         */
        assertEquals(
                ACCOUNTS_URL,
                session.getCurrentUrl()
        );

        assertNotNull(
                session.getLastAccessedAt()
        );

        assertFalse(
                session.getLastAccessedAt()
                        .isBefore(
                                session.getCreatedAt()
                        )
        );

        verify(
                demoNavigationPolicy
        ).resolve(
                DEMO_SITE_ID,
                ACCOUNTS_PATH
        );

        verify(
                browserSessionManager
        ).createSession(
                session.getSessionId()
        );

        verify(
                browserSessionManager
        ).navigate(
                session.getSessionId(),
                navigationTarget.targetUri()
        );

        verify(
                demoNavigationPolicy
        ).validateNavigatedTarget(
                navigationTarget,
                ACCOUNTS_URL
        );

        verify(
                browserFrameCaptureService
        ).capture(
                session.getSessionId()
        );

        assertTrue(
                browserFrameStore.containsSession(
                        session.getSessionId()
                )
        );

        BrowserFramePayload firstFrame =
                browserFrameStore.latest(
                                session.getSessionId()
                        )
                        .orElseThrow();

        assertEquals(
                1L,
                firstFrame.metadata()
                        .sequence()
        );

        assertEquals(
                session.getSessionId(),
                firstFrame.metadata()
                        .sessionId()
        );

        assertEquals(
                "BROWSER_FRAME",
                firstFrame.metadata()
                        .type()
        );

        assertEquals(
                1280,
                firstFrame.metadata()
                        .width()
        );

        assertEquals(
                720,
                firstFrame.metadata()
                        .height()
        );

        assertEquals(
                "image/png",
                firstFrame.metadata()
                        .mimeType()
        );

        assertEquals(
                capturedFrame.byteLength(),
                firstFrame.metadata()
                        .byteLength()
        );

        verify(
                statusEventPublisher
        ).publish(
                session.getSessionId(),
                WorkflowStatus.SESSION_CREATED,
                "자동화 세션이 생성되었습니다."
        );
    }

    @Test
    void D25_첫_Frame과_Snapshot_준비후에만_최초_AI를_예약한다() {
        SanitizedDomSnapshotService snapshotService =
                mock(SanitizedDomSnapshotService.class);
        AgentLoopService agentLoopService = mock(AgentLoopService.class);
        AutomationSessionService d25Service = new AutomationSessionService(
                repository, browserSessionManager, statusEventPublisher,
                demoNavigationPolicy, browserFrameCaptureService, browserFrameStore,
                null, mock(PublicBrowserActionSessionState.class),
                mock(UserDecisionSessionState.class), snapshotService,
                agentLoopService);
        when(demoNavigationPolicy.resolve(DEMO_SITE_ID, ACCOUNTS_PATH))
                .thenReturn(navigationTarget);
        when(browserSessionManager.navigate(anyString(), eq(navigationTarget.targetUri())))
                .thenReturn(ACCOUNTS_URL);
        when(browserFrameCaptureService.capture(anyString()))
                .thenReturn(FrameCaptureAttempt.captured(capturedFrame));
        when(agentLoopService.start(anyString())).thenReturn(true);

        AutomationSession session = d25Service.createSession(
                "100만 원을 12개월 정기예금 상품에 가입하고 싶다",
                DEMO_SITE_ID, ACCOUNTS_PATH);

        verify(snapshotService).createSnapshot(session.getSessionId());
        assertTrue(browserFrameStore.latest(session.getSessionId()).isPresent());
        assertTrue(d25Service.startInitialAi(session.getSessionId()));
        verify(agentLoopService).start(session.getSessionId());
    }

    /*
     * D7
     *
     * Repository에 저장된 세션을 조회하면
     * lastAccessedAt이 갱신되어야 한다.
     */
    @Test
    void 세션을_조회하면_lastAccessedAt을_갱신한다() {
        AutomationSession created =
                sessionService.createSession(
                        "예금 상품을 찾아 줘"
                );

        Instant beforeAccess =
                created.getLastAccessedAt();

        AutomationSession found =
                sessionService.getSession(
                        created.getSessionId()
                );

        assertEquals(
                created.getSessionId(),
                found.getSessionId()
        );

        assertNotNull(
                found.getLastAccessedAt()
        );

        assertFalse(
                found.getLastAccessedAt()
                        .isBefore(
                                beforeAccess
                        )
        );

        /*
         * touch 후 다시 Repository에 저장되었는지 확인.
         */
        AutomationSession stored =
                repository.findById(
                                created.getSessionId()
                        )
                        .orElseThrow();

        assertEquals(
                found.getLastAccessedAt(),
                stored.getLastAccessedAt()
        );
    }

    /*
     * URL 정책 단계에서 차단되면
     * BrowserContext 자체를 만들지 않는다.
     */
    @Test
    void 허용되지_않은_경로면_브라우저를_생성하지_않는다() {
        when(
                demoNavigationPolicy.resolve(
                        DEMO_SITE_ID,
                        "/evil"
                )
        ).thenThrow(
                new IllegalArgumentException(
                        "허용되지 않은 데모 경로입니다."
                )
        );

        assertThrows(
                IllegalArgumentException.class,
                () ->
                        sessionService.createSession(
                                "잘못된 페이지 요청",
                                DEMO_SITE_ID,
                                "/evil"
                        )
        );

        verify(
                browserSessionManager,
                never()
        ).createSession(
                anyString()
        );

        verify(
                browserFrameCaptureService,
                never()
        ).capture(
                anyString()
        );

        assertEquals(
                0,
                browserFrameStore.activeSessionCount()
        );
    }

    @Test
    void navigation_실패시_브라우저와_Frame을_정리한다() {
        when(
                demoNavigationPolicy.resolve(
                        DEMO_SITE_ID,
                        ACCOUNTS_PATH
                )
        ).thenReturn(
                navigationTarget
        );

        when(
                browserSessionManager.navigate(
                        anyString(),
                        eq(
                                navigationTarget.targetUri()
                        )
                )
        ).thenThrow(
                new IllegalStateException(
                        "navigation failed"
                )
        );

        when(
                browserSessionManager.exists(
                        anyString()
                )
        ).thenReturn(
                true
        );

        assertThrows(
                IllegalStateException.class,
                () ->
                        sessionService.createSession(
                                "계좌 페이지 이동",
                                DEMO_SITE_ID,
                                ACCOUNTS_PATH
                        )
        );

        verify(
                browserSessionManager,
                times(1)
        ).closeSession(
                anyString()
        );

        verify(
                browserFrameCaptureService,
                never()
        ).capture(
                anyString()
        );

        assertEquals(
                0,
                browserFrameStore.activeSessionCount()
        );
    }

    @Test
    void 이동후_URL_검증_실패시_Frame을_만들지_않고_정리한다() {
        String redirectedUrl =
                "http://evil.example/transfer/accounts";

        when(
                demoNavigationPolicy.resolve(
                        DEMO_SITE_ID,
                        ACCOUNTS_PATH
                )
        ).thenReturn(
                navigationTarget
        );

        when(
                browserSessionManager.navigate(
                        anyString(),
                        eq(
                                navigationTarget.targetUri()
                        )
                )
        ).thenReturn(
                redirectedUrl
        );

        doThrow(
                new IllegalStateException(
                        "탐색 중 host가 변경되었습니다."
                )
        ).when(
                demoNavigationPolicy
        ).validateNavigatedTarget(
                navigationTarget,
                redirectedUrl
        );

        when(
                browserSessionManager.exists(
                        anyString()
                )
        ).thenReturn(
                true
        );

        assertThrows(
                IllegalStateException.class,
                () ->
                        sessionService.createSession(
                                "계좌 페이지 이동",
                                DEMO_SITE_ID,
                                ACCOUNTS_PATH
                        )
        );

        verify(
                browserFrameCaptureService,
                never()
        ).capture(
                anyString()
        );

        verify(
                browserSessionManager,
                times(1)
        ).closeSession(
                anyString()
        );

        assertEquals(
                0,
                browserFrameStore.activeSessionCount()
        );
    }

    @Test
    void secure_input_화면이면_세션_생성을_중단하고_정리한다() {
        when(
                demoNavigationPolicy.resolve(
                        DEMO_SITE_ID,
                        ACCOUNTS_PATH
                )
        ).thenReturn(
                navigationTarget
        );

        when(
                browserSessionManager.navigate(
                        anyString(),
                        eq(
                                navigationTarget.targetUri()
                        )
                )
        ).thenReturn(
                ACCOUNTS_URL
        );

        when(
                browserFrameCaptureService.capture(
                        anyString()
                )
        ).thenReturn(
                FrameCaptureAttempt.blocked(
                        FrameCaptureDecision
                                .SECURE_INPUT_BLOCKED
                )
        );

        when(
                browserSessionManager.exists(
                        anyString()
                )
        ).thenReturn(
                true
        );

        IllegalStateException exception =
                assertThrows(
                        IllegalStateException.class,
                        () ->
                                sessionService.createSession(
                                        "보안 화면",
                                        DEMO_SITE_ID,
                                        ACCOUNTS_PATH
                                )
                );

        assertTrue(
                exception.getMessage()
                        .contains(
                                "초기 Browser Frame"
                        )
        );

        verify(
                browserSessionManager,
                times(1)
        ).closeSession(
                anyString()
        );

        assertEquals(
                0,
                browserFrameStore.activeSessionCount()
        );
    }

    @Test
    void 생성한_세션을_조회한다() {
        AutomationSession created =
                sessionService.createSession(
                        "예금 상품을 찾아 줘"
                );

        AutomationSession found =
                sessionService.getSession(
                        created.getSessionId()
                );

        assertEquals(
                created.getSessionId(),
                found.getSessionId()
        );

        assertEquals(
                "예금 상품을 찾아 줘",
                found.getUserRequest()
        );
    }

    @Test
    void 자동화_세션을_취소하면_브라우저_세션도_종료한다() {
        AutomationSession created =
                sessionService.createSession(
                        "송금 절차를 안내해 줘"
                );

        when(
                browserSessionManager.exists(
                        created.getSessionId()
                )
        ).thenReturn(
                true
        );

        AutomationSession cancelled =
                sessionService.cancelSession(
                        created.getSessionId()
                );

        assertEquals(
                WorkflowStatus.CANCELLED,
                cancelled.getStatus()
        );

        assertNotNull(
                cancelled.getLastAccessedAt()
        );

        verify(
                browserSessionManager
        ).closeSession(
                created.getSessionId()
        );

        verify(
                statusEventPublisher
        ).publish(
                cancelled.getSessionId(),
                WorkflowStatus.CANCELLED,
                "자동화 세션이 취소되었습니다."
        );
    }

    @Test
    void 세션취소는_active_secure_latch를_정리한다() {
        AutomationSession created = sessionService.createSession("보안 입력 취소");
        var registry = new com.ddd.backend.security.secureinput.SecureInputRegistry();
        registry.activate(created.getSessionId(),
                com.ddd.backend.security.secureinput.SecureInputType.ACCOUNT_PASSWORD,
                "frm-001", 1L, "https://demo/secure");
        sessionService.setSecureInputRegistry(registry);

        sessionService.cancelSession(created.getSessionId());

        assertFalse(registry.isActive(created.getSessionId()));
    }

    @Test
    void D17_세션을_취소하면_저장된_Frame도_삭제한다() {
        when(
                demoNavigationPolicy.resolve(
                        DEMO_SITE_ID,
                        ACCOUNTS_PATH
                )
        ).thenReturn(
                navigationTarget
        );

        when(
                browserSessionManager.navigate(
                        anyString(),
                        eq(
                                navigationTarget.targetUri()
                        )
                )
        ).thenReturn(
                ACCOUNTS_URL
        );

        when(
                browserFrameCaptureService.capture(
                        anyString()
                )
        ).thenReturn(
                FrameCaptureAttempt.captured(
                        capturedFrame
                )
        );

        AutomationSession created =
                sessionService.createSession(
                        "계좌 선택",
                        DEMO_SITE_ID,
                        ACCOUNTS_PATH
                );

        assertTrue(
                browserFrameStore.containsSession(
                        created.getSessionId()
                )
        );

        when(
                browserSessionManager.exists(
                        created.getSessionId()
                )
        ).thenReturn(
                true
        );

        sessionService.cancelSession(
                created.getSessionId()
        );

        assertFalse(
                browserFrameStore.containsSession(
                        created.getSessionId()
                )
        );

        verify(
                browserSessionManager
        ).closeSession(
                created.getSessionId()
        );
    }

    @Test
    void 브라우저_세션이_없어도_자동화_세션을_취소한다() {
        AutomationSession created =
                sessionService.createSession(
                        "계좌 조회를 도와 줘"
                );

        when(
                browserSessionManager.exists(
                        created.getSessionId()
                )
        ).thenReturn(
                false
        );

        AutomationSession cancelled =
                sessionService.cancelSession(
                        created.getSessionId()
                );

        assertEquals(
                WorkflowStatus.CANCELLED,
                cancelled.getStatus()
        );

        verify(
                browserSessionManager,
                never()
        ).closeSession(
                created.getSessionId()
        );
    }

    @Test
    void 존재하지_않는_세션을_조회하면_예외가_발생한다() {
        assertThrows(
                SessionNotFoundException.class,
                () ->
                        sessionService.getSession(
                                "not-found-session"
                        )
        );
    }

    @Test
    void 취소된_세션을_다시_취소하면_브라우저는_한번만_종료한다() {
        AutomationSession created =
                sessionService.createSession(
                        "적금 가입을 도와 줘"
                );

        when(
                browserSessionManager.exists(
                        created.getSessionId()
                )
        ).thenReturn(
                true
        );

        sessionService.cancelSession(
                created.getSessionId()
        );

        assertThrows(
                IllegalStateException.class,
                () ->
                        sessionService.cancelSession(
                                created.getSessionId()
                        )
        );

        verify(
                browserSessionManager,
                times(1)
        ).closeSession(
                created.getSessionId()
        );

        verify(
                statusEventPublisher,
                times(1)
        ).publish(
                created.getSessionId(),
                WorkflowStatus.CANCELLED,
                "자동화 세션이 취소되었습니다."
        );
    }

    @Test
    void 잘못된_사용자_요청이면_브라우저_세션을_생성하지_않는다() {
        assertThrows(
                IllegalArgumentException.class,
                () ->
                        sessionService.createSession(
                                " "
                        )
        );

        verify(
                browserSessionManager,
                never()
        ).createSession(
                anyString()
        );
    }
}
