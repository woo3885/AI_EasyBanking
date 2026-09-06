package com.ddd.backend.security.secureinput;

import com.ddd.backend.ai.AgentLoopService;
import com.ddd.backend.api.dto.session.SecureInputSubmissionResponse;
import com.ddd.backend.api.dto.session.CompleteSecureInputRequest;
import com.ddd.backend.automation.session.BrowserSessionManager;
import com.ddd.backend.common.exception.SessionNotFoundException;
import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.domain.session.AutomationSessionRepository;
import com.ddd.backend.domain.session.WorkflowStatus;
import com.ddd.backend.frame.BrowserFrameMetadata;
import com.ddd.backend.frame.BrowserFrameStore;
import com.ddd.backend.security.capture.BrowserFrameCaptureService;
import com.ddd.backend.security.capture.FrameCaptureAttempt;
import com.ddd.backend.websocket.frame.BrowserFrameWebSocketHandler;
import com.ddd.backend.websocket.publisher.AutomationStatusEventPublisher;
import com.microsoft.playwright.Locator;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.ObjectProvider;

import java.time.Duration;
import java.util.Objects;
import static com.ddd.backend.common.exception.ErrorCode.*;

@Service
public final class SecureInputService {
    private static final Duration TIMEOUT = Duration.ofSeconds(10);
    private static final String SECURE_SELECTOR = "[data-ddd-policy=\"secure-input\"]";
    private static final String COMPLETED_SELECTOR =
            "[data-ddd-secure-state=\"completed\"]";

    private final SecureInputRegistry registry;
    private final BrowserSessionManager browserSessionManager;
    private final AutomationSessionRepository sessionRepository;
    private final BrowserFrameStore frameStore;
    private final BrowserFrameCaptureService captureService;
    private final BrowserFrameWebSocketHandler frameWebSocketHandler;
    private final AutomationStatusEventPublisher eventPublisher;
    private final ObjectProvider<AgentLoopService> agentLoopProvider;

    public SecureInputService(
            SecureInputRegistry registry,
            BrowserSessionManager browserSessionManager,
            AutomationSessionRepository sessionRepository,
            BrowserFrameStore frameStore,
            BrowserFrameCaptureService captureService,
            BrowserFrameWebSocketHandler frameWebSocketHandler,
            AutomationStatusEventPublisher eventPublisher,
            ObjectProvider<AgentLoopService> agentLoopProvider
    ) {
        this.registry = registry;
        this.browserSessionManager = browserSessionManager;
        this.sessionRepository = sessionRepository;
        this.frameStore = frameStore;
        this.captureService = captureService;
        this.frameWebSocketHandler = frameWebSocketHandler;
        this.eventPublisher = eventPublisher;
        this.agentLoopProvider = agentLoopProvider;
    }

    public SecureInputRequest activate(String sessionId) {
        BrowserFrameMetadata frame = frameStore.latest(sessionId)
                .map(payload -> payload.metadata())
                .orElseThrow(() -> new IllegalStateException(
                        "보안 입력 source frame을 확인할 수 없습니다."));
        Detection detection = browserSessionManager.execute(
                sessionId, TIMEOUT, this::detect);
        SecureInputRequest request = registry.activate(
                sessionId, detection.type(), frame.frameId(), frame.sequence(),
                detection.pageUrl());
        eventPublisher.publishSecureInputRequired(sessionId, request);
        return request;
    }

    public SecureInputSubmissionResponse submit(
            String sessionId, String secureRequestId,
            CompleteSecureInputRequest submission
    ) {
        Objects.requireNonNull(submission, "보안 입력 제출 요청은 필수입니다.");
        AutomationSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new SessionNotFoundException(sessionId));
        if (isTerminal(session.getStatus())) {
            throw new SecureInputException(SECURE_SESSION_TERMINATED);
        }
        if (session.getStatus() != WorkflowStatus.SECURE_INPUT_REQUIRED) {
            throw new SecureInputException(SECURE_INVALID_WORKFLOW_STATUS);
        }

        SecureInputRequest active = registry.claim(
                sessionId, secureRequestId, submission.requestId(),
                submission.expectedFrameId(), submission.expectedSequence());

        try {
            CompletionInspection inspection = browserSessionManager.execute(
                    sessionId, TIMEOUT, page -> inspectCompletion(
                            page, registry.activePageUrl(sessionId)));
            if (inspection == CompletionInspection.PAGE_MISMATCH) {
                throw new SecureInputException(SECURE_REQUEST_MISMATCH);
            }
            if (inspection == CompletionInspection.INPUT_ACTIVE) {
                throw new SecureInputException(SECURE_INPUT_STILL_ACTIVE);
            }
            if (inspection == CompletionInspection.MARKER_MISSING) {
                throw new SecureInputException(SECURE_MARKER_MISSING);
            }

            registry.allowSingleSafeCapture(sessionId, secureRequestId);
            FrameCaptureAttempt capture;
            try {
                capture = captureService.capture(sessionId);
            } finally {
                registry.finishSafeCapture(sessionId);
            }
            if (!capture.captured() || capture.frame() == null) {
                throw new SecureInputException(SECURE_SAFE_FRAME_FAILED);
            }
            var safeFrame = frameStore.publishAfterAction(sessionId, capture.frame());
            frameWebSocketHandler.sendLatest(sessionId);
            SecureInputRequest resolved = registry.resolve(sessionId, secureRequestId);
            SecureInputRequest resolvedEvent = new SecureInputRequest(
                    resolved.secureRequestId(), resolved.secureInputType(),
                    safeFrame.metadata().frameId(), safeFrame.metadata().sequence(),
                    "보안 입력 완료 요청 이후의 안전 화면을 확인했습니다.");
            eventPublisher.publishSecureInputResolved(sessionId, resolvedEvent);
            session.transitionTo(WorkflowStatus.PAGE_LOADING);
            sessionRepository.save(session);
            eventPublisher.publish(sessionId, WorkflowStatus.PAGE_LOADING,
                    "보안 입력 완료 요청 이후의 안전 화면을 확인했습니다.");
            agentLoopProvider.getObject().start(sessionId);
            return new SecureInputSubmissionResponse(
                    sessionId, submission.requestId(), secureRequestId,
                    "COMPLETION_ACCEPTED",
                    "보안 입력 완료 여부를 확인하고 있습니다.");
        } catch (RuntimeException exception) {
            registry.releaseFailedSubmission(sessionId);
            throw exception;
        }
    }

    public void clear(String sessionId) {
        boolean active = registry.isActive(sessionId);
        registry.removeSession(sessionId);
        if (active) eventPublisher.publishSecureInputClear(sessionId);
    }

    private Detection detect(com.microsoft.playwright.Page page) {
        Locator secure = page.locator(SECURE_SELECTOR);
        if (secure.count() != 1 || !secure.first().isVisible()
                || !secure.first().isEnabled()) {
            throw new SecureInputException(SECURE_REQUEST_ABORTED);
        }
        return new Detection(detectType(secure.first()), page.url());
    }

    private SecureInputType detectType(Locator locator) {
        String id = lower(locator.getAttribute("id"));
        String autocomplete = lower(locator.getAttribute("autocomplete"));
        if (id.contains("otp") || autocomplete.contains("one-time-code")) {
            return SecureInputType.OTP;
        }
        if (id.contains("certificate") || id.contains("cert")) {
            return SecureInputType.CERTIFICATE_PASSWORD;
        }
        return SecureInputType.ACCOUNT_PASSWORD;
    }

    private CompletionInspection inspectCompletion(
            com.microsoft.playwright.Page page, String expectedPageUrl
    ) {
        if (!page.url().equals(expectedPageUrl)) return CompletionInspection.PAGE_MISMATCH;
        Locator secure = page.locator(SECURE_SELECTOR);
        if (secure.count() != 0) return CompletionInspection.INPUT_ACTIVE;
        Locator completed = page.locator(COMPLETED_SELECTOR);
        if (completed.count() != 1 || !completed.first().isVisible()) {
            return CompletionInspection.MARKER_MISSING;
        }
        return CompletionInspection.VALID;
    }

    private String lower(String attribute) {
        return attribute == null ? "" : attribute.toLowerCase(java.util.Locale.ROOT);
    }

    private boolean isTerminal(WorkflowStatus status) {
        return status == WorkflowStatus.COMPLETED
                || status == WorkflowStatus.CANCELLED
                || status == WorkflowStatus.ERROR
                || status == WorkflowStatus.TERMINATED;
    }

    private record Detection(SecureInputType type, String pageUrl) {}
    private enum CompletionInspection { VALID, PAGE_MISMATCH, INPUT_ACTIVE, MARKER_MISSING }
}
