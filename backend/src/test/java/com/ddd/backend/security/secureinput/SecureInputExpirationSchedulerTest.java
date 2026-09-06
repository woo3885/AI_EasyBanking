package com.ddd.backend.security.secureinput;

import com.ddd.backend.ai.AgentLoopService;
import com.ddd.backend.automation.session.BrowserSessionManager;
import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.domain.session.AutomationSessionRepository;
import com.ddd.backend.domain.session.WorkflowStatus;
import com.ddd.backend.frame.BrowserFrameStore;
import com.ddd.backend.websocket.frame.BrowserFrameWebSocketHandler;
import com.ddd.backend.websocket.publisher.AutomationStatusEventPublisher;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class SecureInputExpirationSchedulerTest {
    @Test
    void timeout은_latch_lock_BrowserContext_Frame을_정리하고_AI를_재개하지_않는다()
            throws Exception {
        SecureInputRegistry registry = new SecureInputRegistry(Duration.ZERO);
        AutomationSessionRepository repository = mock(AutomationSessionRepository.class);
        BrowserSessionManager manager = mock(BrowserSessionManager.class);
        BrowserFrameStore frames = mock(BrowserFrameStore.class);
        BrowserFrameWebSocketHandler handler = mock(BrowserFrameWebSocketHandler.class);
        AutomationStatusEventPublisher publisher = mock(AutomationStatusEventPublisher.class);
        AgentLoopService agentLoop = mock(AgentLoopService.class);
        AutomationSession session = AutomationSession.create("timeout");
        session.transitionTo(WorkflowStatus.SECURE_INPUT_REQUIRED);
        when(repository.findById(session.getSessionId())).thenReturn(Optional.of(session));
        when(repository.save(session)).thenReturn(session);
        when(manager.exists(session.getSessionId())).thenReturn(true);
        when(frames.containsSession(session.getSessionId())).thenReturn(true);
        registry.activate(session.getSessionId(), SecureInputType.ACCOUNT_PASSWORD,
                "frm-1", 1L, "https://demo/secure");
        Thread.sleep(2L);
        SecureInputExpirationScheduler scheduler = new SecureInputExpirationScheduler(
                registry, repository, manager, frames, handler, publisher, agentLoop);

        scheduler.expire();

        assertThat(registry.active(session.getSessionId())).isEmpty();
        assertThat(session.getStatus()).isEqualTo(WorkflowStatus.ERROR);
        verify(agentLoop).cancel(session.getSessionId());
        verify(agentLoop, never()).start(anyString());
        verify(manager).closeSession(session.getSessionId());
        verify(handler).closeConnection(session.getSessionId());
        verify(frames).removeSession(session.getSessionId());
    }
}
