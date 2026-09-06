package com.ddd.backend.infrastructure.session;

import com.ddd.backend.automation.session.BrowserSessionManager;
import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.domain.session.AutomationSessionRepository;
import com.ddd.backend.frame.BrowserFrameStore;
import com.ddd.backend.websocket.publisher.AutomationStatusEventPublisher;
import com.ddd.backend.ai.AgentLoopService;
import com.ddd.backend.service.action.PublicBrowserActionSessionState;
import com.ddd.backend.service.decision.UserDecisionSessionState;
import com.ddd.backend.websocket.frame.BrowserFrameWebSocketHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.Set;

import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class SessionExpirationSchedulerTest {

    private AutomationSessionRepository sessionRepository;

    private BrowserSessionManager browserSessionManager;

    private BrowserFrameStore browserFrameStore;

    private SessionExpirationScheduler scheduler;

    @BeforeEach
    void setUp() {
        sessionRepository =
                mock(
                        AutomationSessionRepository.class
                );

        browserSessionManager =
                mock(
                        BrowserSessionManager.class
                );

        browserFrameStore =
                mock(
                        BrowserFrameStore.class
                );

        scheduler =
                new SessionExpirationScheduler(
                        sessionRepository,
                        browserSessionManager,
                        browserFrameStore
                );
    }

    /*
     * D8 핵심.
     *
     * BrowserSession은 살아 있지만
     * Redis 세션 Key가 TTL로 사라진 경우:
     *
     * BrowserContext / Page 종료
     * + FrameStore 제거
     */
    @Test
    void Redis에서_만료된_세션의_Browser와_Frame을_정리한다() {
        String sessionId =
                "expired-session";

        when(
                browserSessionManager.activeSessionIds()
        ).thenReturn(
                Set.of(
                        sessionId
                )
        );

        when(
                sessionRepository.findById(
                        sessionId
                )
        ).thenReturn(
                Optional.empty()
        );

        when(
                browserSessionManager.exists(
                        sessionId
                )
        ).thenReturn(
                true
        );

        when(
                browserFrameStore.containsSession(
                        sessionId
                )
        ).thenReturn(
                true
        );

        scheduler.cleanupExpiredSessions();

        verify(
                browserSessionManager
        ).closeSession(
                sessionId
        );

        verify(
                browserFrameStore
        ).removeSession(
                sessionId
        );
    }

    @Test
    void Redis_TTL_만료시_Agent_loop도_정리한다() {
        String sessionId = "expired-agent-loop";
        AgentLoopService agentLoopService = mock(AgentLoopService.class);
        SessionExpirationScheduler d25Scheduler = new SessionExpirationScheduler(
                sessionRepository, browserSessionManager, browserFrameStore,
                mock(BrowserFrameWebSocketHandler.class),
                mock(PublicBrowserActionSessionState.class),
                mock(AutomationStatusEventPublisher.class),
                mock(UserDecisionSessionState.class), agentLoopService);
        when(browserSessionManager.activeSessionIds()).thenReturn(Set.of(sessionId));
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.empty());

        d25Scheduler.cleanupExpiredSessions();

        verify(agentLoopService).cancel(sessionId);
    }

    /*
     * Redis에 세션이 아직 존재하면
     * 만료되지 않은 정상 세션이다.
     */
    @Test
    void Redis에_세션이_존재하면_정리하지_않는다() {
        String sessionId =
                "active-session";

        AutomationSession session =
                AutomationSession.create(
                        "정상 세션"
                );

        when(
                browserSessionManager.activeSessionIds()
        ).thenReturn(
                Set.of(
                        sessionId
                )
        );

        when(
                sessionRepository.findById(
                        sessionId
                )
        ).thenReturn(
                Optional.of(
                        session
                )
        );

        scheduler.cleanupExpiredSessions();

        verify(
                browserSessionManager,
                never()
        ).closeSession(
                sessionId
        );

        verify(
                browserFrameStore,
                never()
        ).removeSession(
                sessionId
        );
    }

    /*
     * Redis 자체가 장애난 경우에는
     * "TTL 만료"라고 오판하면 안 된다.
     *
     * Redis 장애 때문에 모든 BrowserContext를
     * 종료하는 사고를 방지한다.
     */
    @Test
    void Redis_조회_오류가_발생하면_Browser를_종료하지_않는다() {
        String sessionId =
                "redis-error-session";

        when(
                browserSessionManager.activeSessionIds()
        ).thenReturn(
                Set.of(
                        sessionId
                )
        );

        when(
                sessionRepository.findById(
                        sessionId
                )
        ).thenThrow(
                new IllegalStateException(
                        "Redis unavailable"
                )
        );

        scheduler.cleanupExpiredSessions();

        verify(
                browserSessionManager,
                never()
        ).closeSession(
                sessionId
        );

        verify(
                browserFrameStore,
                never()
        ).removeSession(
                sessionId
        );
    }

    /*
     * BrowserSession은 이미 없어졌지만
     * Frame만 남아 있는 경우에도
     * FrameStore는 정리한다.
     */
    @Test
    void Browser가_이미_없어도_남은_Frame은_정리한다() {
        String sessionId =
                "frame-only-session";

        when(
                browserSessionManager.activeSessionIds()
        ).thenReturn(
                Set.of(
                        sessionId
                )
        );

        when(
                sessionRepository.findById(
                        sessionId
                )
        ).thenReturn(
                Optional.empty()
        );

        when(
                browserSessionManager.exists(
                        sessionId
                )
        ).thenReturn(
                false
        );

        when(
                browserFrameStore.containsSession(
                        sessionId
                )
        ).thenReturn(
                true
        );

        scheduler.cleanupExpiredSessions();

        verify(
                browserSessionManager,
                never()
        ).closeSession(
                sessionId
        );

        verify(
                browserFrameStore
        ).removeSession(
                sessionId
        );
    }

    /*
     * BrowserContext 종료 중 오류가 발생해도
     * Frame cleanup은 계속 수행해야 한다.
     */
    @Test
    void Browser_정리_실패가_발생해도_Frame은_계속_정리한다() {
        String sessionId =
                "browser-cleanup-error";

        when(
                browserSessionManager.activeSessionIds()
        ).thenReturn(
                Set.of(
                        sessionId
                )
        );

        when(
                sessionRepository.findById(
                        sessionId
                )
        ).thenReturn(
                Optional.empty()
        );

        when(
                browserSessionManager.exists(
                        sessionId
                )
        ).thenReturn(
                true
        );

        doThrow(
                new IllegalStateException(
                        "Browser close failed"
                )
        ).when(
                browserSessionManager
        ).closeSession(
                sessionId
        );

        when(
                browserFrameStore.containsSession(
                        sessionId
                )
        ).thenReturn(
                true
        );

        scheduler.cleanupExpiredSessions();

        verify(
                browserSessionManager
        ).closeSession(
                sessionId
        );

        /*
         * Browser cleanup 오류와 관계없이
         * Frame cleanup까지 진행되어야 한다.
         */
        verify(
                browserFrameStore
        ).removeSession(
                sessionId
        );
    }

    /*
     * 활성 BrowserSession 자체가 없다면
     * Scheduler가 할 일이 없다.
     */
    @Test
    void 활성_BrowserSession이_없으면_아무것도_하지_않는다() {
        when(
                browserSessionManager.activeSessionIds()
        ).thenReturn(
                Set.of()
        );

        scheduler.cleanupExpiredSessions();

        verifyNoInteractions(
                sessionRepository,
                browserFrameStore
        );
    }

    @Test
    void Redis에서_만료되면_UI_Event_상태도_정리한다() {
        String sessionId = "expired-ui-session";
        AutomationStatusEventPublisher eventPublisher =
                mock(AutomationStatusEventPublisher.class);
        SessionExpirationScheduler schedulerWithUiEvents =
                new SessionExpirationScheduler(
                        sessionRepository,
                        browserSessionManager,
                        browserFrameStore,
                        null,
                        null,
                        eventPublisher
                );

        when(browserSessionManager.activeSessionIds()).thenReturn(Set.of(sessionId));
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.empty());
        when(browserSessionManager.exists(sessionId)).thenReturn(false);
        when(browserFrameStore.containsSession(sessionId)).thenReturn(false);

        schedulerWithUiEvents.cleanupExpiredSessions();

        verify(eventPublisher).removeSession(sessionId);
    }
}
