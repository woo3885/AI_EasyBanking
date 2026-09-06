package com.ddd.backend.infrastructure.session;

import com.ddd.backend.automation.session.BrowserSessionManager;
import com.ddd.backend.domain.session.AutomationSessionRepository;
import com.ddd.backend.frame.BrowserFrameStore;
import com.ddd.backend.service.action.PublicBrowserActionSessionState;
import com.ddd.backend.websocket.frame.BrowserFrameWebSocketHandler;
import com.ddd.backend.websocket.publisher.AutomationStatusEventPublisher;
import com.ddd.backend.service.decision.UserDecisionSessionState;
import com.ddd.backend.ai.AgentLoopService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Set;

@Component
@ConditionalOnProperty(
        prefix = "ddd.session-store",
        name = "type",
        havingValue = "redis"
)
public class SessionExpirationScheduler {

    private static final Logger log =
            LoggerFactory.getLogger(
                    SessionExpirationScheduler.class
            );

    private final AutomationSessionRepository
            sessionRepository;

    private final BrowserSessionManager
            browserSessionManager;

    private final BrowserFrameStore
            browserFrameStore;

    /*
     * D20
     *
     * Redis TTL 만료 시
     * Viewer Frame WebSocket도 함께 종료한다.
     */
    private final BrowserFrameWebSocketHandler
            frameWebSocketHandler;

    /*
     * D22
     *
     * Redis TTL로 AutomationSession이 사라질 때
     * Public Viewer Action의 메모리 상태도 제거한다.
     */
    private final PublicBrowserActionSessionState
            publicBrowserActionSessionState;

    private final AutomationStatusEventPublisher uiEventPublisher;
    private final UserDecisionSessionState userDecisionSessionState;
    private final AgentLoopService agentLoopService;

    /*
     * 실제 Spring 실행용 생성자.
     */
    @Autowired
    public SessionExpirationScheduler(
            AutomationSessionRepository sessionRepository,
            BrowserSessionManager browserSessionManager,
            BrowserFrameStore browserFrameStore,
            BrowserFrameWebSocketHandler frameWebSocketHandler,
            PublicBrowserActionSessionState
                    publicBrowserActionSessionState,
            AutomationStatusEventPublisher uiEventPublisher,
            UserDecisionSessionState userDecisionSessionState,
            AgentLoopService agentLoopService
    ) {
        this.sessionRepository =
                sessionRepository;

        this.browserSessionManager =
                browserSessionManager;

        this.browserFrameStore =
                browserFrameStore;

        this.frameWebSocketHandler =
                frameWebSocketHandler;

        this.publicBrowserActionSessionState =
                publicBrowserActionSessionState;

        this.uiEventPublisher = uiEventPublisher;
        this.userDecisionSessionState = userDecisionSessionState;
        this.agentLoopService = agentLoopService;
    }

    public SessionExpirationScheduler(
            AutomationSessionRepository sessionRepository,
            BrowserSessionManager browserSessionManager,
            BrowserFrameStore browserFrameStore,
            BrowserFrameWebSocketHandler frameWebSocketHandler,
            PublicBrowserActionSessionState publicBrowserActionSessionState,
            AutomationStatusEventPublisher uiEventPublisher
    ) {
        this(sessionRepository, browserSessionManager, browserFrameStore,
                frameWebSocketHandler, publicBrowserActionSessionState,
                uiEventPublisher, null, null);
    }

    /*
     * D20 테스트 호환용 생성자.
     */
    public SessionExpirationScheduler(
            AutomationSessionRepository sessionRepository,
            BrowserSessionManager browserSessionManager,
            BrowserFrameStore browserFrameStore,
            BrowserFrameWebSocketHandler frameWebSocketHandler
    ) {
        this(
                sessionRepository,
                browserSessionManager,
                browserFrameStore,
                frameWebSocketHandler,
                null,
                null,
                null,
                null
        );
    }

    /*
     * 기존 D8 테스트 호환용 생성자.
     */
    public SessionExpirationScheduler(
            AutomationSessionRepository sessionRepository,
            BrowserSessionManager browserSessionManager,
            BrowserFrameStore browserFrameStore
    ) {
        this(
                sessionRepository,
                browserSessionManager,
                browserFrameStore,
                null,
                null,
                null,
                null,
                null
        );
    }

    /*
     * Redis TTL에 의해 Session Key가 삭제되었지만
     * Playwright BrowserSessionManager에
     * BrowserContext가 남아 있는지 주기적으로 검사한다.
     *
     * 기본 실행 주기:
     * 5초.
     */
    @Scheduled(
            fixedDelayString =
                    "${ddd.session-store.cleanup-interval-ms:5000}"
    )
    public void cleanupExpiredSessions() {

        Set<String> activeSessionIds =
                browserSessionManager
                        .activeSessionIds();

        for (String sessionId :
                activeSessionIds) {

            boolean sessionExists;

            try {

                /*
                 * Redis Key가 TTL 만료로 삭제됐으면
                 * Optional.empty().
                 */
                sessionExists =
                        sessionRepository
                                .findById(
                                        sessionId
                                )
                                .isPresent();

            } catch (RuntimeException exception) {

                /*
                 * Redis 자체 장애를
                 * Session TTL 만료로 판단해서는 안 된다.
                 *
                 * Redis 장애 때문에
                 * 정상 BrowserContext를 닫지 않는다.
                 */
                log.warn(
                        "세션 만료 검사 중 저장소 조회 실패. "
                                + "exceptionType={}",
                        exception
                                .getClass()
                                .getSimpleName()
                );

                continue;
            }

            if (sessionExists) {
                continue;
            }

            cleanupExpiredSession(
                    sessionId
            );
        }
    }

    /*
     * TTL 만료 Session 전체 Resource cleanup.
     */
    private void cleanupExpiredSession(
            String sessionId
    ) {
        /*
         * D22
         *
         * Public Viewer Action 상태 정리.
         *
         * - requestId Registry
         * - Session Lock
         * - SCROLL rate-limit 상태
         */
        try {

            if (publicBrowserActionSessionState
                    != null) {

                publicBrowserActionSessionState
                        .removeSession(
                                sessionId
                        );
            }

        } catch (RuntimeException exception) {

            /*
             * Scheduler는 하나의 cleanup 실패 때문에
             * 전체 만료 정리 주기가 중단되면 안 된다.
             */
            log.warn(
                    "만료 Public Browser Action 상태 "
                            + "정리 실패. "
                            + "exceptionType={}",
                    exception
                            .getClass()
                            .getSimpleName()
            );
        }

        /*
         * Playwright BrowserContext / Page 종료.
         */
        try {

            if (browserSessionManager.exists(
                    sessionId
            )) {

                browserSessionManager.closeSession(
                        sessionId
                );
            }

        } catch (RuntimeException exception) {

            log.warn(
                    "만료 BrowserSession 정리 실패. "
                            + "exceptionType={}",
                    exception
                            .getClass()
                            .getSimpleName()
            );
        }

        /*
         * D20
         *
         * TTL 만료 시 Viewer WebSocket도
         * 서버에서 즉시 종료한다.
         */
        try {

            if (frameWebSocketHandler
                    != null) {

                frameWebSocketHandler
                        .closeConnection(
                                sessionId
                        );
            }

        } catch (RuntimeException exception) {

            log.warn(
                    "만료 Browser Viewer 연결 "
                            + "정리 실패. "
                            + "exceptionType={}",
                    exception
                            .getClass()
                            .getSimpleName()
            );
        }

        /*
         * Viewer 최신 Frame 제거.
         */
        try {

            if (browserFrameStore.containsSession(
                    sessionId
            )) {

                browserFrameStore.removeSession(
                        sessionId
                );
            }

        } catch (RuntimeException exception) {

            log.warn(
                    "만료 Browser Frame 정리 실패. "
                            + "exceptionType={}",
                    exception
                            .getClass()
                            .getSimpleName()
            );
        }

        try {
            if (uiEventPublisher != null) {
                uiEventPublisher.removeSession(sessionId);
            }
        } catch (RuntimeException exception) {
            log.warn(
                    "만료 UI Event 상태 정리 실패. exceptionType={}",
                    exception.getClass().getSimpleName()
            );
        }

        try {
            if (agentLoopService != null) {
                agentLoopService.cancel(sessionId);
            }
        } catch (RuntimeException exception) {
            log.warn("만료 Agent loop 정리 실패. exceptionType={}",
                    exception.getClass().getSimpleName());
        }

        try {
            if (userDecisionSessionState != null) {
                userDecisionSessionState.removeSession(sessionId);
            }
        } catch (RuntimeException exception) {
            log.warn(
                    "만료 User Decision 상태 정리 실패. exceptionType={}",
                    exception.getClass().getSimpleName()
            );
        }
    }
}
