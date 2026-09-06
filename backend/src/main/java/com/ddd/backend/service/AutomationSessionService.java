package com.ddd.backend.service;

import com.ddd.backend.automation.session.BrowserSessionManager;
import com.ddd.backend.ai.AgentLoopService;
import com.ddd.backend.automation.dom.SanitizedDomSnapshotService;
import com.ddd.backend.common.exception.SessionNotFoundException;
import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.domain.session.AutomationSessionRepository;
import com.ddd.backend.frame.BrowserFrameStore;
import com.ddd.backend.security.capture.BrowserFrameCaptureService;
import com.ddd.backend.security.capture.FrameCaptureAttempt;
import com.ddd.backend.security.navigation.DemoNavigationPolicy;
import com.ddd.backend.security.navigation.DemoNavigationTarget;
import com.ddd.backend.service.action.PublicBrowserActionSessionState;
import com.ddd.backend.service.decision.UserDecisionSessionState;
import com.ddd.backend.websocket.frame.BrowserFrameWebSocketHandler;
import com.ddd.backend.websocket.publisher.AutomationStatusEventPublisher;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.ddd.backend.security.secureinput.SecureInputRegistry;
import com.ddd.backend.conversation.ConversationService;
import com.ddd.backend.conversation.bridge.DemoAgentBridgeService;

@Service
public class AutomationSessionService {

    private final AutomationSessionRepository
            sessionRepository;

    private final BrowserSessionManager
            browserSessionManager;

    private final AutomationStatusEventPublisher
            statusEventPublisher;

    private final DemoNavigationPolicy
            demoNavigationPolicy;

    private final BrowserFrameCaptureService
            browserFrameCaptureService;

    private final BrowserFrameStore
            browserFrameStore;

    /*
     * D20
     *
     * AutomationSession 종료 시
     * Viewer Frame WebSocket도 같이 종료한다.
     */
    private final BrowserFrameWebSocketHandler
            frameWebSocketHandler;

    /*
     * D22 Viewer Public Action lifecycle.
     *
     * Session 종료 시 아래 상태를 함께 제거한다.
     *
     * - 처리된 requestId
     * - Session Action Lock
     * - SCROLL rate-limit 상태
     */
    private final PublicBrowserActionSessionState
            publicBrowserActionSessionState;

    private final UserDecisionSessionState userDecisionSessionState;
    private final SanitizedDomSnapshotService snapshotService;
    private final AgentLoopService agentLoopService;
    private SecureInputRegistry secureInputRegistry;
    private ConversationService conversationService;
    private DemoAgentBridgeService demoAgentBridgeService;

    @Autowired
    void setSecureInputRegistry(SecureInputRegistry secureInputRegistry) {
        this.secureInputRegistry = secureInputRegistry;
    }

    @Autowired(required = false)
    void setConversationService(ConversationService conversationService) {
        this.conversationService = conversationService;
    }

    @Autowired(required = false)
    void setDemoAgentBridgeService(DemoAgentBridgeService demoAgentBridgeService) {
        this.demoAgentBridgeService = demoAgentBridgeService;
    }

    /*
     * 실제 Spring 실행용 생성자.
     */
    @Autowired
    public AutomationSessionService(
            AutomationSessionRepository sessionRepository,
            BrowserSessionManager browserSessionManager,
            AutomationStatusEventPublisher statusEventPublisher,
            DemoNavigationPolicy demoNavigationPolicy,
            BrowserFrameCaptureService browserFrameCaptureService,
            BrowserFrameStore browserFrameStore,
            BrowserFrameWebSocketHandler frameWebSocketHandler,
            PublicBrowserActionSessionState
                    publicBrowserActionSessionState,
            UserDecisionSessionState userDecisionSessionState,
            SanitizedDomSnapshotService snapshotService,
            AgentLoopService agentLoopService
    ) {
        this.sessionRepository =
                sessionRepository;

        this.browserSessionManager =
                browserSessionManager;

        this.statusEventPublisher =
                statusEventPublisher;

        this.demoNavigationPolicy =
                demoNavigationPolicy;

        this.browserFrameCaptureService =
                browserFrameCaptureService;

        this.browserFrameStore =
                browserFrameStore;

        this.frameWebSocketHandler =
                frameWebSocketHandler;

        this.publicBrowserActionSessionState =
                publicBrowserActionSessionState;

        this.userDecisionSessionState = userDecisionSessionState;
        this.snapshotService = snapshotService;
        this.agentLoopService = agentLoopService;
    }

    public AutomationSessionService(
            AutomationSessionRepository sessionRepository,
            BrowserSessionManager browserSessionManager,
            AutomationStatusEventPublisher statusEventPublisher,
            DemoNavigationPolicy demoNavigationPolicy,
            BrowserFrameCaptureService browserFrameCaptureService,
            BrowserFrameStore browserFrameStore,
            BrowserFrameWebSocketHandler frameWebSocketHandler,
            PublicBrowserActionSessionState publicBrowserActionSessionState
    ) {
        this(sessionRepository, browserSessionManager, statusEventPublisher,
                demoNavigationPolicy, browserFrameCaptureService, browserFrameStore,
                frameWebSocketHandler, publicBrowserActionSessionState, null,
                null, null);
    }

    /*
     * D20 시점 테스트 코드 호환용 생성자.
     *
     * Public Action SessionState가 없는
     * 기존 테스트에서 사용할 수 있다.
     */
    public AutomationSessionService(
            AutomationSessionRepository sessionRepository,
            BrowserSessionManager browserSessionManager,
            AutomationStatusEventPublisher statusEventPublisher,
            DemoNavigationPolicy demoNavigationPolicy,
            BrowserFrameCaptureService browserFrameCaptureService,
            BrowserFrameStore browserFrameStore,
            BrowserFrameWebSocketHandler frameWebSocketHandler
    ) {
        this(
                sessionRepository,
                browserSessionManager,
                statusEventPublisher,
                demoNavigationPolicy,
                browserFrameCaptureService,
                browserFrameStore,
                frameWebSocketHandler,
                null,
                null,
                null,
                null
        );
    }

    /*
     * 기존 D17 / D18 테스트 호환용 생성자.
     */
    public AutomationSessionService(
            AutomationSessionRepository sessionRepository,
            BrowserSessionManager browserSessionManager,
            AutomationStatusEventPublisher statusEventPublisher,
            DemoNavigationPolicy demoNavigationPolicy,
            BrowserFrameCaptureService browserFrameCaptureService,
            BrowserFrameStore browserFrameStore
    ) {
        this(
                sessionRepository,
                browserSessionManager,
                statusEventPublisher,
                demoNavigationPolicy,
                browserFrameCaptureService,
                browserFrameStore,
                null,
                null,
                null,
                null,
                null
        );
    }

    /*
     * 기존 코드 / 테스트 호환용 세션 생성.
     *
     * Demo navigation 및 Frame 생성은 하지 않는다.
     */
    public AutomationSession createSession(
            String userRequest
    ) {
        AutomationSession session =
                AutomationSession.create(
                        userRequest
                );

        String sessionId =
                session.getSessionId();

        browserSessionManager.createSession(
                sessionId
        );

        try {

            AutomationSession savedSession =
                    sessionRepository.save(
                            session
                    );

            statusEventPublisher.publish(
                    savedSession.getSessionId(),
                    savedSession.getStatus(),
                    "자동화 세션이 생성되었습니다."
            );

            return savedSession;

        } catch (RuntimeException exception) {

            cleanupBrowserResources(
                    sessionId
            );

            throw exception;
        }
    }

    /** Conversation intake creates only the authoritative session record.
     * Browser/DOM work starts after a later explicit LATEST_DOM_DECISION boundary. */
    public AutomationSession createConversationSession(String userRequest) {
        return sessionRepository.save(AutomationSession.create(userRequest));
    }

    public AutomationSession createConversationSession(
            String userRequest,
            String siteId,
            String initialPath
    ) {
        DemoNavigationTarget target = demoNavigationPolicy.resolve(siteId, initialPath);
        AutomationSession session = AutomationSession.create(userRequest);
        String sessionId = session.getSessionId();
        browserSessionManager.createSession(sessionId);
        try {
            String finalUrl = browserSessionManager.navigate(sessionId, target.targetUri());
            demoNavigationPolicy.validateNavigatedTarget(target, finalUrl);
            session.updateCurrentUrl(finalUrl);
            if (demoAgentBridgeService != null) {
                demoAgentBridgeService.bootstrap(sessionId);
            }
            return sessionRepository.save(session);
        } catch (RuntimeException exception) {
            cleanupBrowserResources(sessionId);
            throw exception;
        }
    }

    /*
     * 실제 Viewer Session 생성.
     *
     * 1. Navigation 입력 검증
     * 2. BrowserContext 생성
     * 3. 안전 URL 이동
     * 4. 최종 URL 재검증
     * 5. currentUrl 갱신
     * 6. 최초 Frame 캡처
     * 7. FrameStore 저장
     * 8. AutomationSession 저장
     */
    public AutomationSession createSession(
            String userRequest,
            String siteId,
            String initialPath
    ) {
        /*
         * Browser 생성 전에
         * 요청받은 site/path부터 검증한다.
         */
        DemoNavigationTarget navigationTarget =
                demoNavigationPolicy.resolve(
                        siteId,
                        initialPath
                );

        AutomationSession session =
                AutomationSession.create(
                        userRequest
                );

        String sessionId =
                session.getSessionId();

        browserSessionManager.createSession(
                sessionId
        );

        try {

            /*
             * 서버가 만든 안전한 URI로 이동한다.
             */
            String finalUrl =
                    browserSessionManager.navigate(
                            sessionId,
                            navigationTarget.targetUri()
                    );

            /*
             * redirect 등을 포함한
             * 실제 최종 URL을 다시 검증한다.
             */
            demoNavigationPolicy
                    .validateNavigatedTarget(
                            navigationTarget,
                            finalUrl
                    );

            statusEventPublisher.publish(
                    sessionId,
                    com.ddd.backend.domain.session.WorkflowStatus.PAGE_LOADING,
                    "자동화 화면을 불러오고 있습니다."
            );

            /*
             * 최종 Browser URL을 Session에 기록.
             *
             * updateCurrentUrl 내부에서
             * updatedAt / lastAccessedAt도 갱신된다.
             */
            session.updateCurrentUrl(
                    finalUrl
            );

            /*
             * 최초 Viewer Frame 생성.
             *
             * FrameCaptureGuard에 의해
             * secure-input 화면이면 screenshot 자체가
             * 실행되지 않는다.
             */
            FrameCaptureAttempt captureAttempt =
                    browserFrameCaptureService
                            .capture(
                                    sessionId
                            );

            if (!captureAttempt.captured()
                    || captureAttempt.frame()
                    == null) {

                throw new IllegalStateException(
                        "초기 Browser Frame을 생성할 수 없습니다. "
                                + "decision="
                                + captureAttempt.decision()
                );
            }

            /*
             * 최초 Frame.
             *
             * Action 직후 Frame이 아니므로
             * 일반 publish()를 사용한다.
             */
            browserFrameStore.publish(
                    sessionId,
                    captureAttempt.frame()
            );

            if (frameWebSocketHandler != null) {
                frameWebSocketHandler.sendLatest(sessionId);
            }

            /* 첫 Frame 이후 Snapshot/ElementRegistry가 준비돼야 AI를 예약할 수 있다. */
            if (snapshotService != null) {
                snapshotService.createSnapshot(sessionId);
            }

            AutomationSession savedSession =
                    sessionRepository.save(
                            session
                    );

            statusEventPublisher.publish(
                    savedSession.getSessionId(),
                    savedSession.getStatus(),
                    "자동화 세션이 생성되었습니다."
            );

            return savedSession;

        } catch (RuntimeException exception) {

            /*
             * 아래 실패 상황에서
             * 모든 Session resource를 정리한다.
             *
             * - navigation 실패
             * - URL 검증 실패
             * - Frame capture 실패
             * - FrameStore 실패
             * - Repository 저장 실패
             */
            cleanupBrowserResources(
                    sessionId
            );

            throw exception;
        }
    }

    public boolean startInitialAi(String sessionId) {
        if (agentLoopService == null) {
            return false;
        }
        AutomationSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new SessionNotFoundException(sessionId));
        if (session.getStatus() != com.ddd.backend.domain.session.WorkflowStatus.SESSION_CREATED
                || !browserFrameStore.latest(sessionId).isPresent()) {
            return false;
        }
        return agentLoopService.start(sessionId);
    }

    /*
     * Session 조회.
     *
     * 조회 성공 자체를 Session 접근으로 보고
     * lastAccessedAt을 갱신한다.
     */
    public AutomationSession getSession(
            String sessionId
    ) {
        validateSessionId(
                sessionId
        );

        AutomationSession session =
                sessionRepository
                        .findById(
                                sessionId
                        )
                        .orElseThrow(
                                () ->
                                        new SessionNotFoundException(
                                                sessionId
                                        )
                        );

        session.touch();

        return sessionRepository.save(
                session
        );
    }

    /*
     * 사용자가 명시적으로 Session 취소.
     */
    public AutomationSession cancelSession(
            String sessionId
    ) {
        AutomationSession session =
                getSession(
                        sessionId
                );

        session.cancel();

        AutomationSession savedSession =
                sessionRepository.save(
                        session
                );

        /*
         * D22
         *
         * Public Viewer Action 상태를 먼저 제거한다.
         *
         * - requestId
         * - Action Lock
         * - SCROLL rate-limit
         */
        cleanupPublicBrowserActionStateSafely(
                sessionId
        );
        cleanupUserDecisionStateSafely(sessionId);
        cleanupAgentLoopSafely(sessionId);
        cleanupSecureInputStateSafely(sessionId);
        cleanupConversationStateSafely(sessionId);
        cleanupDemoAgentBridgeSafely(sessionId);

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

        } catch (RuntimeException ignored) {

            /*
             * Browser cleanup 실패 때문에
             * 나머지 Session cleanup을 중단하지 않는다.
             */
        }

        /*
         * D20
         *
         * Viewer Frame WebSocket도
         * 서버에서 직접 종료한다.
         */
        closeFrameWebSocketSafely(
                sessionId
        );

        /*
         * 최신 Viewer Frame 제거.
         */
        try {

            if (browserFrameStore.containsSession(
                    sessionId
            )) {

                browserFrameStore.removeSession(
                        sessionId
                );
            }

        } catch (RuntimeException ignored) {

            /*
             * Frame cleanup 실패가
             * Session cancel 결과를 덮어쓰지 않는다.
             */
        }

        statusEventPublisher.publish(
                savedSession.getSessionId(),
                savedSession.getStatus(),
                "자동화 세션이 취소되었습니다."
        );

        statusEventPublisher.removeSession(sessionId);

        return savedSession;
    }

    /*
     * Session 생성 실패 등의 경우
     * 브라우저 관련 모든 Resource를 정리한다.
     */
    private void cleanupBrowserResources(
            String sessionId
    ) {
        /*
         * D22 Public Action 상태 제거.
         */
        cleanupPublicBrowserActionStateSafely(
                sessionId
        );
        cleanupUserDecisionStateSafely(sessionId);
        cleanupAgentLoopSafely(sessionId);
        cleanupSecureInputStateSafely(sessionId);
        cleanupConversationStateSafely(sessionId);
        cleanupDemoAgentBridgeSafely(sessionId);

        /*
         * BrowserContext / Page 종료.
         */
        try {

            if (browserSessionManager.exists(
                    sessionId
            )) {

                browserSessionManager.closeSession(
                        sessionId
                );
            }

        } catch (RuntimeException ignored) {

            /*
             * cleanup 오류가
             * 원래 발생한 예외를 덮어쓰지 않는다.
             */
        }

        /*
         * Viewer WebSocket 종료.
         */
        closeFrameWebSocketSafely(
                sessionId
        );

        /*
         * FrameStore 제거.
         */
        try {

            if (browserFrameStore.containsSession(
                    sessionId
            )) {

                browserFrameStore.removeSession(
                        sessionId
                );
            }

        } catch (RuntimeException ignored) {

            /*
             * Frame cleanup 실패 역시
             * 원래 예외를 덮어쓰지 않는다.
             */
        }

        try {
            statusEventPublisher.removeSession(sessionId);
        } catch (RuntimeException ignored) {
            // UI event cleanup failure must not hide the original failure.
        }
    }

    /*
     * D22
     *
     * Public Action 상태 cleanup.
     *
     * 기존 테스트 호환 생성자에서는
     * PublicBrowserActionSessionState가 null일 수 있다.
     */
    private void cleanupPublicBrowserActionStateSafely(
            String sessionId
    ) {
        if (publicBrowserActionSessionState
                == null) {

            return;
        }

        try {

            publicBrowserActionSessionState
                    .removeSession(
                            sessionId
                    );

        } catch (RuntimeException ignored) {

            /*
             * Public Action 상태 cleanup 실패가
             * 전체 Session cleanup을 실패시키면 안 된다.
             */
        }
    }

    private void cleanupConversationStateSafely(String sessionId) {
        try {
            if (conversationService != null) conversationService.removeSession(sessionId);
        } catch (RuntimeException ignored) {
            // Conversation cleanup failure must not block browser/session cleanup.
        }
    }

    private void cleanupDemoAgentBridgeSafely(String sessionId) {
        try {
            if (demoAgentBridgeService != null) demoAgentBridgeService.removeSession(sessionId);
        } catch (RuntimeException ignored) {
            // Bridge cleanup failure must not block session cleanup.
        }
    }

    private void cleanupUserDecisionStateSafely(String sessionId) {
        if (userDecisionSessionState == null) {
            return;
        }
        try {
            userDecisionSessionState.removeSession(sessionId);
        } catch (RuntimeException ignored) {
            // Decision cleanup failure must not stop remaining resource cleanup.
        }
    }

    private void cleanupAgentLoopSafely(String sessionId) {
        if (agentLoopService != null) {
            agentLoopService.cancel(sessionId);
        }
    }

    private void cleanupSecureInputStateSafely(String sessionId) {
        if (secureInputRegistry != null) {
            try {
                secureInputRegistry.removeSession(sessionId);
            } catch (RuntimeException ignored) {
                // Secure latch cleanup failure must not stop remaining cleanup.
            }
        }
    }

    /*
     * D20 Viewer WebSocket cleanup.
     *
     * 기존 테스트 호환 생성자에서는
     * Handler가 null일 수 있다.
     */
    private void closeFrameWebSocketSafely(
            String sessionId
    ) {
        if (frameWebSocketHandler == null) {
            return;
        }

        try {

            frameWebSocketHandler.closeConnection(
                    sessionId
            );

        } catch (RuntimeException ignored) {

            /*
             * WebSocket cleanup 실패가
             * Session cleanup 자체를 실패시키지 않는다.
             */
        }
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
