package com.ddd.backend.conversation.overlay;

import com.ddd.backend.api.dto.conversation.InteractionObservationAcceptedResponse;
import com.ddd.backend.api.dto.conversation.InteractionObservationRequest;
import com.ddd.backend.automation.dom.ElementRegistry;
import com.ddd.backend.automation.dom.SanitizedDomSnapshot;
import com.ddd.backend.automation.dom.SanitizedDomSnapshotService;
import com.ddd.backend.automation.session.BrowserSessionManager;
import com.ddd.backend.conversation.bridge.DemoAgentBridgeBinding;
import com.ddd.backend.conversation.bridge.DemoAgentBridgeRegistry;
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
    private final DemoAgentBridgeRegistry bridges;
    private final OverlayTargetStore targets;
    private final BrowserSessionManager browsers;
    private final ElementRegistry elements;
    private final SanitizedDomSnapshotService snapshots;
    private final AutomationSessionRepository sessions;
    private final ConversationEventPublisher events;
    private final ObjectProvider<ConversationObservationResumePort> resumePort;
    private ConversationProtectedGateRegistry protectedGates;

    public InteractionObservationService(DemoAgentBridgeRegistry bridges, OverlayTargetStore targets,
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
            String pageIdentity, String origin, InteractionObservationRequest request) {
        DemoAgentBridgeBinding binding = authenticate(sessionId, bridgeToken, pageIdentity, origin);
        AutomationSession session = sessions.findById(sessionId)
                .orElseThrow(() -> new OverlayTargetException(TARGET_NOT_FOUND));
        if (BLOCKED.contains(session.getStatus())
                || protectedGates != null && protectedGates.blocksAutomation(sessionId)) {
            throw new OverlayTargetException(TARGET_NOT_INTERACTABLE);
        }
        OverlayTargetStore.ClaimedTarget claimed = targets.claim(sessionId, request.requestId(),
                request.targetId(), pageIdentity, request.sourceSnapshotId());
        try {
            validateCurrentElement(sessionId, claimed);
        } catch (RuntimeException invalid) {
            targets.clear(sessionId, OverlayClearReason.TARGET_INVALID);
            throw invalid;
        }
        PublicOverlayTarget consumed = targets.consume(sessionId, request.targetId());
        SanitizedDomSnapshot resulting = snapshots.createSnapshot(sessionId);
        if (claimed.sourceFingerprint().equals(DomSnapshotFingerprint.of(resulting))) {
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

    private DemoAgentBridgeBinding authenticate(String sessionId, String token,
            String pageIdentity, String origin) {
        DemoAgentBridgeBinding binding = bridges.find(sessionId)
                .orElseThrow(() -> new OverlayTargetException(BRIDGE_TOKEN_INVALID));
        if (!constantTimeEquals(binding.bridgeToken(), token)) throw new OverlayTargetException(BRIDGE_TOKEN_INVALID);
        if (!binding.allowedOrigin().equals(origin)) throw new OverlayTargetException(BRIDGE_ORIGIN_NOT_ALLOWED);
        if (!binding.pageIdentity().equals(pageIdentity)) throw new OverlayTargetException(TARGET_STALE_PAGE);
        return binding;
    }

    private void validateCurrentElement(String sessionId, OverlayTargetStore.ClaimedTarget claimed) {
        browsers.execute(sessionId, TIMEOUT, page -> {
            Locator locator;
            try { locator = elements.resolveLocator(page, sessionId, claimed.internalElementId()); }
            catch (RuntimeException stale) { throw new OverlayTargetException(TARGET_NOT_INTERACTABLE); }
            if (!locator.isVisible() || !locator.isEnabled()) throw new OverlayTargetException(TARGET_NOT_INTERACTABLE);
            Map<?, ?> rect = (Map<?, ?>) locator.evaluate("element => { const r=element.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; }");
            var expected = claimed.target().rectangle();
            if (!near(expected.x(), rect, "x") || !near(expected.y(), rect, "y")
                    || !near(expected.width(), rect, "width") || !near(expected.height(), rect, "height")) {
                throw new OverlayTargetException(TARGET_NOT_INTERACTABLE);
            }
            return null;
        });
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
