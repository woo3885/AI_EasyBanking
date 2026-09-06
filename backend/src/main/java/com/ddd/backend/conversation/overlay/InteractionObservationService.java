package com.ddd.backend.conversation.overlay;

import com.ddd.backend.api.dto.conversation.InteractionObservationAcceptedResponse;
import com.ddd.backend.api.dto.conversation.InteractionObservationRequest;
import com.ddd.backend.automation.dom.ElementRegistry;
import com.ddd.backend.automation.dom.SanitizedDomSnapshot;
import com.ddd.backend.automation.dom.SanitizedDomSnapshotService;
import com.ddd.backend.automation.session.BrowserSessionManager;
import com.ddd.backend.conversation.bridge.UserBrowserBridgeBinding;
import com.ddd.backend.conversation.bridge.UserBrowserBridgeRegistry;
import com.ddd.backend.conversation.event.ConversationEventPublisher;
import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.domain.session.AutomationSessionRepository;
import com.ddd.backend.domain.session.WorkflowStatus;
import com.microsoft.playwright.Locator;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static com.ddd.backend.conversation.overlay.OverlayTargetError.*;
import com.ddd.backend.conversation.gate.ConversationProtectedGateRegistry;
import org.springframework.beans.factory.annotation.Autowired;

@Service
public final class InteractionObservationService {
    private static final Duration TIMEOUT = Duration.ofSeconds(10);
    private static final double RECTANGLE_TOLERANCE = 2.0;
    private static final Set<WorkflowStatus> BLOCKED = Set.of(
            WorkflowStatus.SECURE_INPUT_REQUIRED, WorkflowStatus.RISK_WARNING,
            WorkflowStatus.FINAL_CONFIRMATION_REQUIRED, WorkflowStatus.COMPLETED,
            WorkflowStatus.CANCELLED, WorkflowStatus.ERROR, WorkflowStatus.TERMINATED);
    private final UserBrowserBridgeRegistry bridges;
    private final OverlayTargetStore targets;
    private final BrowserSessionManager browsers;
    private final ElementRegistry elements;
    private final SanitizedDomSnapshotService snapshots;
    private final AutomationSessionRepository sessions;
    private final ConversationEventPublisher events;
    private final ObjectProvider<ConversationObservationResumePort> resumePort;
    private ConversationProtectedGateRegistry protectedGates;

    public InteractionObservationService(UserBrowserBridgeRegistry bridges, OverlayTargetStore targets,
            BrowserSessionManager browsers, ElementRegistry elements, SanitizedDomSnapshotService snapshots,
            AutomationSessionRepository sessions, ConversationEventPublisher events,
            ObjectProvider<ConversationObservationResumePort> resumePort) {
        this.bridges = bridges; this.targets = targets; this.browsers = browsers; this.elements = elements;
        this.snapshots = snapshots; this.sessions = sessions; this.events = events; this.resumePort = resumePort;
    }

    @Autowired(required = false)
    void setProtectedGates(ConversationProtectedGateRegistry protectedGates) {
        this.protectedGates = protectedGates;
    }

    public InteractionObservationAcceptedResponse observe(String sessionId, String bridgeToken,
            String browserBindingId, String pageIdentity, String origin, InteractionObservationRequest request) {
        UserBrowserBridgeBinding binding = authenticate(
                sessionId, bridgeToken, browserBindingId, pageIdentity, origin);
        AutomationSession session = sessions.findById(sessionId)
                .orElseThrow(() -> new OverlayTargetException(TARGET_NOT_FOUND));
        if (BLOCKED.contains(session.getStatus())
                || protectedGates != null && protectedGates.blocksAutomation(sessionId)) {
            throw new OverlayTargetException(TARGET_NOT_INTERACTABLE);
        }
        OverlayTargetStore.ClaimedTarget claimed = targets.claim(sessionId, request.requestId(),
                request.targetId(), pageIdentity, request.sourceSnapshotId());
        try {
            validateObservationIdentity(request, claimed.target());
            validateCurrentElement(sessionId, claimed);
        } catch (RuntimeException invalid) {
            targets.clear(sessionId, OverlayClearReason.TARGET_INVALID);
            throw invalid;
        }
        PublicOverlayTarget consumed = targets.consume(sessionId, request.targetId());
        SanitizedDomSnapshot resulting = snapshots.createSnapshot(sessionId);
        if (consumed.materializationMode() == OverlayMaterializationMode.BACKEND_VIEWPORT_RECT
                && claimed.sourceFingerprint().equals(DomSnapshotFingerprint.of(resulting))) {
            throw new OverlayTargetException(OBSERVATION_DOM_NOT_CHANGED);
        }
        session.transitionTo(WorkflowStatus.AI_EXECUTING);
        sessions.save(session);
        Instant acceptedAt = Instant.now();
        events.userActionObserved(consumed, "observation-" + UUID.randomUUID(),
                request.requestId(), resulting.snapshotId(), acceptedAt);
        ConversationObservationResumePort port = resumePort.getIfAvailable();
        if (port != null) port.resumeOnce(sessionId, request.requestId(), consumed, resulting);
        return new InteractionObservationAcceptedResponse(sessionId, request.requestId(),
                request.targetId(), binding.pageIdentity(), request.sourceSnapshotId(),
                "OBSERVATION_ACCEPTED", acceptedAt);
    }

    private UserBrowserBridgeBinding authenticate(String sessionId, String token,
            String browserBindingId, String pageIdentity, String origin) {
        UserBrowserBridgeBinding binding = bridges.find(sessionId)
                .orElseThrow(() -> new OverlayTargetException(BRIDGE_TOKEN_INVALID));
        if (!constantTimeEquals(binding.bridgeToken(), token)) throw new OverlayTargetException(BRIDGE_TOKEN_INVALID);
        if (!binding.allowedOrigin().equals(origin)) throw new OverlayTargetException(BRIDGE_ORIGIN_NOT_ALLOWED);
        if (!binding.browserBindingId().equals(browserBindingId)) throw new OverlayTargetException(BRIDGE_TOKEN_INVALID);
        if (!binding.pageIdentity().equals(pageIdentity)) throw new OverlayTargetException(TARGET_STALE_PAGE);
        return binding;
    }

    private void validateCurrentElement(String sessionId, OverlayTargetStore.ClaimedTarget claimed) {
        browsers.execute(sessionId, TIMEOUT, page -> {
            Locator locator;
            try { locator = elements.resolveLocator(page, sessionId, claimed.internalElementId()); }
            catch (RuntimeException stale) { throw new OverlayTargetException(TARGET_NOT_INTERACTABLE); }
            if (!locator.isVisible() || !locator.isEnabled()) throw new OverlayTargetException(TARGET_NOT_INTERACTABLE);
            if (claimed.target().materializationMode() == OverlayMaterializationMode.USER_DOM_PUBLIC_TARGET) {
                PublicTargetLocator expected = claimed.target().locator();
                if (!expected.publicTargetKey().equals(locator.getAttribute("data-ddd-public-target"))
                        || !expected.accessibleName().equals(locator.getAttribute("aria-label"))) {
                    throw new OverlayTargetException(PUBLIC_TARGET_KEY_MISMATCH);
                }
                return null;
            }
            Map<?, ?> rect = (Map<?, ?>) locator.evaluate("element => { const r=element.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; }");
            var expected = claimed.target().rectangle();
            if (!near(expected.x(), rect, "x") || !near(expected.y(), rect, "y")
                    || !near(expected.width(), rect, "width") || !near(expected.height(), rect, "height")) {
                throw new OverlayTargetException(TARGET_NOT_INTERACTABLE);
            }
            return null;
        });
    }
    private void validateObservationIdentity(InteractionObservationRequest request, PublicOverlayTarget target) {
        if (target.materializationMode() != OverlayMaterializationMode.USER_DOM_PUBLIC_TARGET) return;
        PublicTargetLocator locator = target.locator();
        if (locator == null || !locator.publicTargetKey().equals(request.publicTargetKey())
                || !locator.role().equals(request.role()) || request.actionMode() != target.actionMode()) {
            throw new OverlayTargetException(PUBLIC_TARGET_KEY_MISMATCH);
        }
        var rectangle = request.localRectangle();
        var click = request.clickPosition();
        if (rectangle == null || click == null || !finite(rectangle.x(), rectangle.y(),
                rectangle.width(), rectangle.height(), click.clientX(), click.clientY())
                || rectangle.width() <= 0 || rectangle.height() <= 0
                || click.clientX() < rectangle.x() || click.clientX() > rectangle.x() + rectangle.width()
                || click.clientY() < rectangle.y() || click.clientY() > rectangle.y() + rectangle.height()) {
            throw new OverlayTargetException(OBSERVATION_CLICK_OUTSIDE);
        }
    }
    private boolean finite(double... values) {
        for (double value : values) if (!Double.isFinite(value)) return false;
        return true;
    }
    private boolean near(double expected, Map<?, ?> values, String key) {
        Object raw = values.get(key);
        return raw instanceof Number number && Math.abs(expected - number.doubleValue()) <= RECTANGLE_TOLERANCE;
    }
    private boolean constantTimeEquals(String expected, String actual) {
        if (expected == null || actual == null) return false;
        return MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), actual.getBytes(StandardCharsets.UTF_8));
    }
}
