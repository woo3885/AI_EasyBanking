package com.ddd.backend.security.secureinput;

import com.ddd.backend.ai.AgentLoopService;
import com.ddd.backend.api.dto.session.CompleteSecureInputRequest;
import com.ddd.backend.automation.session.BrowserSessionManager;
import com.ddd.backend.automation.worker.PlaywrightWorker;
import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.domain.session.AutomationSessionRepository;
import com.ddd.backend.domain.session.WorkflowStatus;
import com.ddd.backend.frame.BrowserFrameStore;
import com.ddd.backend.security.capture.BrowserFrameCaptureService;
import com.ddd.backend.security.capture.CapturedBrowserFrame;
import com.ddd.backend.security.capture.FrameCaptureAttempt;
import com.ddd.backend.websocket.frame.BrowserFrameWebSocketHandler;
import com.ddd.backend.websocket.publisher.AutomationStatusEventPublisher;
import com.microsoft.playwright.Route;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

import java.time.Duration;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class SecureInputServiceTest {
    private PlaywrightWorker worker;
    private BrowserSessionManager manager;
    private BrowserFrameStore frameStore;
    private SecureInputRegistry registry;
    private AutomationSessionRepository repository;
    private BrowserFrameCaptureService captureService;
    private BrowserFrameWebSocketHandler frameHandler;
    private AutomationStatusEventPublisher publisher;
    private AgentLoopService agentLoop;
    private ObjectProvider<AgentLoopService> agentLoopProvider;
    private SecureInputService service;
    private AutomationSession session;

    @BeforeEach
    void setUp() {
        worker = new PlaywrightWorker();
        manager = new BrowserSessionManager(worker);
        frameStore = new BrowserFrameStore();
        registry = new SecureInputRegistry();
        repository = mock(AutomationSessionRepository.class);
        captureService = mock(BrowserFrameCaptureService.class);
        frameHandler = mock(BrowserFrameWebSocketHandler.class);
        publisher = mock(AutomationStatusEventPublisher.class);
        agentLoop = mock(AgentLoopService.class);
        agentLoopProvider = mock(ObjectProvider.class);
        when(agentLoopProvider.getObject()).thenReturn(agentLoop);
        service = new SecureInputService(registry, manager, repository, frameStore,
                captureService, frameHandler, publisher, agentLoopProvider);

        session = AutomationSession.create("데모 보안 입력");
        session.transitionTo(WorkflowStatus.SECURE_INPUT_REQUIRED);
        manager.createSession(session.getSessionId());
        when(repository.findById(session.getSessionId())).thenReturn(Optional.of(session));
        when(repository.save(session)).thenReturn(session);
        when(agentLoop.start(session.getSessionId())).thenReturn(true);
        frameStore.publish(session.getSessionId(), frame((byte) 1));
    }

    @AfterEach
    void tearDown() {
        manager.close();
        worker.close();
    }

    @Test
    void 사용자직접완료_marker를_검증하고_안전Frame후_한번_재개한다() {
        navigate(true);
        SecureInputRequest active = service.activate(session.getSessionId());
        completeAsUser();
        when(captureService.capture(session.getSessionId()))
                .thenReturn(FrameCaptureAttempt.captured(frame((byte) 2)));

        var response = service.submit(session.getSessionId(), active.secureRequestId(),
                new CompleteSecureInputRequest("req-001",
                        active.frameId(), active.frameSequence()));

        assertThat(response.sessionId()).isEqualTo(session.getSessionId());
        assertThat(response.status()).isEqualTo("COMPLETION_ACCEPTED");
        assertThat(registry.active(session.getSessionId())).isEmpty();
        assertThat(session.getStatus()).isEqualTo(WorkflowStatus.PAGE_LOADING);
        assertThat(frameStore.latest(session.getSessionId()).orElseThrow()
                .metadata().sequence()).isEqualTo(2L);
        int secureElementCount = manager.execute(
                session.getSessionId(), Duration.ofSeconds(5),
                page -> page.locator("[data-ddd-policy=secure-input]").count());
        assertThat(secureElementCount).isZero();
        verify(agentLoop, times(1)).start(session.getSessionId());

        assertThatThrownBy(() -> service.submit(
                session.getSessionId(), active.secureRequestId(),
                new CompleteSecureInputRequest("req-001",
                        active.frameId(), active.frameSequence())))
                .isInstanceOf(IllegalStateException.class);
        verify(agentLoop, times(1)).start(session.getSessionId());
    }

    @Test
    void secure_element가_남으면_Frame과_AI재개를_금지하고_latch를_유지한다() {
        navigate(false);
        SecureInputRequest active = service.activate(session.getSessionId());

        assertThatThrownBy(() -> service.submit(
                session.getSessionId(), active.secureRequestId(),
                new CompleteSecureInputRequest("req-001",
                        active.frameId(), active.frameSequence())))
                .isInstanceOf(SecureInputException.class)
                .extracting("errorCode")
                .isEqualTo(com.ddd.backend.common.exception.ErrorCode.SECURE_INPUT_STILL_ACTIVE);

        assertThat(registry.active(session.getSessionId())).contains(active);
        verify(captureService, never()).capture(anyString());
        verify(agentLoop, never()).start(anyString());
    }

    @Test
    void 안전Frame_생성에_실패하면_latch를_해제하거나_AI를_재개하지_않는다() {
        navigate(true);
        SecureInputRequest active = service.activate(session.getSessionId());
        completeAsUser();
        when(captureService.capture(session.getSessionId()))
                .thenReturn(FrameCaptureAttempt.blocked(
                        com.ddd.backend.security.capture.FrameCaptureDecision.INSPECTION_FAILED_BLOCKED));

        assertThatThrownBy(() -> service.submit(
                session.getSessionId(), active.secureRequestId(),
                new CompleteSecureInputRequest("req-001",
                        active.frameId(), active.frameSequence())))
                .isInstanceOf(SecureInputException.class);

        assertThat(registry.active(session.getSessionId())).contains(active);
        assertThat(frameStore.latest(session.getSessionId()).orElseThrow()
                .metadata().sequence()).isEqualTo(1L);
        verify(agentLoop, never()).start(anyString());
    }

    @Test
    void marker없이_secure_input만_사라지면_완료로_처리하지_않는다() {
        navigateOtp();
        SecureInputRequest active = service.activate(session.getSessionId());
        manager.execute(session.getSessionId(), Duration.ofSeconds(5), page -> {
            page.locator("[data-ddd-policy=secure-input]").evaluate("element => element.remove()");
            return null;
        });

        assertThatThrownBy(() -> service.submit(
                session.getSessionId(), active.secureRequestId(),
                new CompleteSecureInputRequest("req-001",
                        active.frameId(), active.frameSequence())))
                .isInstanceOf(SecureInputException.class)
                .extracting("errorCode")
                .isEqualTo(com.ddd.backend.common.exception.ErrorCode.SECURE_MARKER_MISSING);
        verify(captureService, never()).capture(anyString());
    }

    @Test
    void 다른_Page의_이전_completed_marker를_재사용할수_없다() {
        navigate(false);
        SecureInputRequest active = service.activate(session.getSessionId());
        navigateHtmlAt("http://127.0.0.1:5190/deposit/secure/password/deposit-preferred", """
                <p data-ddd-secure-state="completed">이전 완료 marker</p>
                """);

        assertThatThrownBy(() -> service.submit(
                session.getSessionId(), active.secureRequestId(),
                new CompleteSecureInputRequest("req-001",
                        active.frameId(), active.frameSequence())))
                .isInstanceOf(SecureInputException.class)
                .extracting("errorCode")
                .isEqualTo(com.ddd.backend.common.exception.ErrorCode.SECURE_REQUEST_MISMATCH);
        verify(captureService, never()).capture(anyString());
    }

    @Test
    void production_완료_DTO에는_raw_value_필드가_없다() {
        assertThat(java.util.Arrays.stream(CompleteSecureInputRequest.class
                        .getRecordComponents()).map(java.lang.reflect.RecordComponent::getName))
                .containsExactly("requestId", "expectedFrameId", "expectedSequence");
    }

    private void navigate(boolean removeSecureInput) {
        String script = removeSecureInput
                ? "document.querySelector('[data-ddd-policy=secure-input]').remove();"
                + "const marker=document.createElement('p');"
                + "marker.setAttribute('data-ddd-secure-state','completed');"
                + "marker.textContent='완료 요청됨';document.body.appendChild(marker)"
                : "void 0";
        navigateHtml("""
                <input id="input-account-password" type="password"
                       data-ddd-policy="secure-input">
                <button id="btn-secure-input-complete"
                        onclick="%s">입력 완료</button>
                """.formatted(script));
    }

    private void navigateOtp() {
        navigateHtml("""
                <input id="input-otp" autocomplete="one-time-code"
                       data-ddd-policy="secure-input">
                <button id="btn-secure-input-complete">입력 완료</button>
                """);
    }

    private void completeAsUser() {
        manager.execute(session.getSessionId(), Duration.ofSeconds(5), page -> {
            page.locator("[data-ddd-policy=secure-input]").fill("test-fixture-only");
            page.locator("#btn-secure-input-complete").click();
            return null;
        });
    }

    private void navigateHtml(String html) {
        navigateHtmlAt(
                "http://127.0.0.1:5190/deposit/secure/password/deposit-12m", html);
    }

    private void navigateHtmlAt(String url, String html) {
        manager.execute(session.getSessionId(), Duration.ofSeconds(5), page -> {
            page.route("**/*", route -> route.fulfill(
                    new Route.FulfillOptions().setStatus(200)
                            .setContentType("text/html; charset=utf-8")
                            .setBody(html)));
            page.navigate(url);
            return null;
        });
    }

    private CapturedBrowserFrame frame(byte value) {
        return new CapturedBrowserFrame(new byte[]{value}, 1280, 720, "image/png");
    }
}
