package com.ddd.backend.conversation.navigation;

import com.ddd.backend.api.dto.conversation.BrowserPageReadyRequest;
import com.ddd.backend.api.dto.conversation.BrowserPageReadyResponse;
import com.ddd.backend.conversation.bridge.UserBrowserBridgeBinding;
import com.ddd.backend.conversation.bridge.UserBrowserBridgeRegistry;
import com.ddd.backend.conversation.event.ConversationEventPublisher;
import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.domain.session.AutomationSessionRepository;
import com.ddd.backend.domain.session.WorkflowStatus;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import jakarta.annotation.PreDestroy;
import com.ddd.backend.automation.dom.ElementResolutionException;
import com.ddd.backend.conversation.overlay.OverlayTargetException;
import com.ddd.backend.conversation.overlay.OverlayTargetError;

import static com.ddd.backend.conversation.navigation.BrowserNavigationError.*;

@Service
public final class BrowserNavigationService {
    private static final Duration TTL = Duration.ofMinutes(2);
    private static final Set<WorkflowStatus> BLOCKED = Set.of(
            WorkflowStatus.SECURE_INPUT_REQUIRED, WorkflowStatus.RISK_WARNING,
            WorkflowStatus.FINAL_CONFIRMATION_REQUIRED, WorkflowStatus.COMPLETED,
            WorkflowStatus.CANCELLED, WorkflowStatus.ERROR, WorkflowStatus.TERMINATED);
    private final AutomationSessionRepository sessions;
    private final UserBrowserBridgeRegistry bindings;
    private final PendingBrowserNavigationRegistry navigations;
    private final BrowserNavigationRoutePolicy routes;
    private final ConversationEventPublisher events;
    private final ObjectProvider<BrowserPageReadyResumePort> resumePort;
    private final ExecutorService resumeExecutor = Executors.newVirtualThreadPerTaskExecutor();

    public BrowserNavigationService(AutomationSessionRepository sessions,
            UserBrowserBridgeRegistry bindings, PendingBrowserNavigationRegistry navigations,
            BrowserNavigationRoutePolicy routes, ConversationEventPublisher events,
            ObjectProvider<BrowserPageReadyResumePort> resumePort) {
        this.sessions = sessions; this.bindings = bindings; this.navigations = navigations;
        this.routes = routes; this.events = events; this.resumePort = resumePort;
        navigations.setClearListener(events::navigationClear);
    }

    public PendingBrowserNavigation requireNavigation(String sessionId, String destinationRoute,
            long routeRevision, BrowserNavigationMode mode, String guide) {
        AutomationSession session = requireSession(sessionId);
        if (BLOCKED.contains(session.getStatus())) throw new BrowserNavigationException(NAVIGATION_WORKFLOW_CONFLICT);
        UserBrowserBridgeBinding binding = bindings.find(sessionId)
                .orElseThrow(() -> new BrowserNavigationException(BROWSER_BINDING_NOT_FOUND));
        String route = routes.requireAllowed(destinationRoute);
        Instant now = Instant.now();
        PendingBrowserNavigation navigation = new PendingBrowserNavigation(
                "navigation-" + UUID.randomUUID(), sessionId, binding.browserBindingId(),
                binding.pageIdentity(), "browser-page-" + UUID.randomUUID(), route,
                routeRevision, mode, now.plus(TTL), PendingBrowserNavigation.Status.ACTIVE);
        navigations.replace(navigation);
        events.navigationRequired(navigation, safeGuide(guide), now);
        return navigation;
    }

    public BrowserPageReadyResponse pageReady(String sessionId, String token, String origin,
            String browserBindingId, String headerPageIdentity, BrowserPageReadyRequest request) {
        requireSession(sessionId);
        BrowserPageReadyResumePort port = resumePort.getIfAvailable();
        if (port == null) {
            throw new IllegalStateException("Browser page-ready resume port가 준비되지 않았습니다.");
        }
        bindings.authenticateForNavigation(
                sessionId, token, origin, browserBindingId);
        if (!request.sourcePageIdentity().equals(headerPageIdentity)) {
            throw new BrowserNavigationException(NAVIGATION_PAGE_IDENTITY_MISMATCH);
        }
        String renderedRoute = routes.requireAllowed(request.renderedRoute());
        PendingBrowserNavigation claimed = navigations.claim(
                sessionId, request.requestId(), request.navigationId(), browserBindingId,
                request.sourcePageIdentity(), request.destinationPageIdentity(),
                request.routeRevision(), renderedRoute);
        UserBrowserBridgeBinding rotated = bindings.rotatePageIdentity(
                sessionId, browserBindingId, claimed.sourcePageIdentity(),
                claimed.destinationPageIdentity(), renderedRoute);
        PendingBrowserNavigation consumed = navigations.consume(sessionId, claimed.navigationId());
        resumeExecutor.submit(() -> observeAndResume(port, consumed));
        return new BrowserPageReadyResponse(
                sessionId, request.requestId(), consumed.navigationId(), rotated.browserBindingId(),
                consumed.sourcePageIdentity(), rotated.pageIdentity(), consumed.routeRevision(),
                renderedRoute, "PAGE_READY_ACCEPTED",
                "화면 준비 상태가 접수되었습니다. AI 실행이나 금융 업무 완료를 의미하지 않습니다.");
    }

    public boolean blocksTarget(String sessionId) { return navigations.hasActive(sessionId); }
    public void removeSession(String sessionId) { navigations.removeSession(sessionId); }

    private AutomationSession requireSession(String sessionId) {
        return sessions.findById(sessionId)
                .orElseThrow(() -> new BrowserNavigationException(NAVIGATION_NOT_FOUND));
    }
    private void observeAndResume(BrowserPageReadyResumePort port, PendingBrowserNavigation navigation) {
        try {
            events.pageReadyObserved(navigation, Instant.now());
            port.resumeOnce(navigation);
        } catch (RuntimeException exception) {
            events.pageReadyResumeFailed(navigation, classifyResumeError(exception), Instant.now());
        }
    }
    private PageReadyResumeError classifyResumeError(Throwable error) {
        for (Throwable current = error; current != null; current = current.getCause()) {
            if (current instanceof PageReadyResumeException resume) return resume.error();
            if (current instanceof ElementResolutionException resolution) {
                return switch (resolution.error()) {
                    case TARGET_NOT_FOUND -> PageReadyResumeError.OVERLAY_TARGET_NOT_FOUND;
                    case TARGET_AMBIGUOUS -> PageReadyResumeError.OVERLAY_TARGET_AMBIGUOUS;
                    case STALE_SNAPSHOT -> PageReadyResumeError.OVERLAY_TARGET_STALE_SNAPSHOT;
                    case POLICY_MISMATCH -> PageReadyResumeError.OVERLAY_TARGET_POLICY_MISMATCH;
                };
            }
            if (current instanceof OverlayTargetException target) {
                if (target.error() == OverlayTargetError.TARGET_NOT_FOUND) {
                    return PageReadyResumeError.OVERLAY_TARGET_NOT_FOUND;
                }
                if (target.error() == OverlayTargetError.TARGET_STALE_SNAPSHOT
                        || target.error() == OverlayTargetError.TARGET_STALE_PAGE) {
                    return PageReadyResumeError.OVERLAY_TARGET_STALE_SNAPSHOT;
                }
                return PageReadyResumeError.OVERLAY_TARGET_POLICY_MISMATCH;
            }
        }
        return PageReadyResumeError.PAGE_READY_RESUME_FAILED;
    }
    @PreDestroy
    void closeResumeExecutor() {
        resumeExecutor.close();
    }
    private String safeGuide(String guide) {
        if (guide == null || guide.isBlank() || guide.length() > 200
                || guide.contains("<") || guide.contains(">")) {
            return "요청한 화면으로 안전하게 이동해 주세요.";
        }
        return guide;
    }
}
