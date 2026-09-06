package com.ddd.backend.security.secureinput;

import com.ddd.backend.ai.AgentLoopService;
import com.ddd.backend.automation.session.BrowserSessionManager;
import com.ddd.backend.domain.session.AutomationSessionRepository;
import com.ddd.backend.domain.session.WorkflowStatus;
import com.ddd.backend.frame.BrowserFrameStore;
import com.ddd.backend.websocket.frame.BrowserFrameWebSocketHandler;
import com.ddd.backend.websocket.publisher.AutomationStatusEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** 완료 timeout 시 takeover와 session resource를 fail-closed로 정리한다. */
@Component
public final class SecureInputExpirationScheduler {
    private final SecureInputRegistry registry;
    private final AutomationSessionRepository repository;
    private final BrowserSessionManager browserSessionManager;
    private final BrowserFrameStore frameStore;
    private final BrowserFrameWebSocketHandler frameHandler;
    private final AutomationStatusEventPublisher eventPublisher;
    private final AgentLoopService agentLoopService;

    public SecureInputExpirationScheduler(
            SecureInputRegistry registry,
            AutomationSessionRepository repository,
            BrowserSessionManager browserSessionManager,
            BrowserFrameStore frameStore,
            BrowserFrameWebSocketHandler frameHandler,
            AutomationStatusEventPublisher eventPublisher,
            AgentLoopService agentLoopService
    ) {
        this.registry = registry;
        this.repository = repository;
        this.browserSessionManager = browserSessionManager;
        this.frameStore = frameStore;
        this.frameHandler = frameHandler;
        this.eventPublisher = eventPublisher;
        this.agentLoopService = agentLoopService;
    }

    @Scheduled(fixedDelayString = "${ddd.secure-takeover.cleanup-interval-ms:1000}")
    public void expire() {
        for (String sessionId : registry.removeExpired()) {
            agentLoopService.cancel(sessionId);
            repository.findById(sessionId).ifPresent(session -> {
                session.transitionTo(WorkflowStatus.ERROR);
                repository.save(session);
                eventPublisher.publish(sessionId, WorkflowStatus.ERROR,
                        "보안 입력 완료 요청 시간이 지나 세션을 안전하게 종료했습니다.");
            });
            try {
                if (browserSessionManager.exists(sessionId)) {
                    browserSessionManager.closeSession(sessionId);
                }
            } catch (RuntimeException ignored) {
                // Timeout cleanup remains best-effort after the latch is removed.
            }
            try {
                frameHandler.closeConnection(sessionId);
            } catch (RuntimeException ignored) {
                // Continue remaining cleanup.
            }
            try {
                if (frameStore.containsSession(sessionId)) frameStore.removeSession(sessionId);
            } catch (RuntimeException ignored) {
                // Continue remaining cleanup.
            }
        }
    }
}
