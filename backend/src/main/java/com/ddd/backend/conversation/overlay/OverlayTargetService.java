package com.ddd.backend.conversation.overlay;

import com.ddd.backend.automation.dom.ElementRegistry;
import com.ddd.backend.automation.dom.SanitizedDomSnapshot;
import com.ddd.backend.automation.session.BrowserSessionManager;
import com.ddd.backend.conversation.ConversationMessagePolicy;
import com.ddd.backend.conversation.bridge.DemoAgentBridgeBinding;
import com.ddd.backend.conversation.bridge.DemoAgentBridgeRegistry;
import com.ddd.backend.conversation.event.ConversationEventPublisher;
import com.microsoft.playwright.Locator;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static com.ddd.backend.conversation.overlay.OverlayTargetError.TARGET_NOT_INTERACTABLE;

@Service
public final class OverlayTargetService {
    private static final Duration TIMEOUT = Duration.ofSeconds(10);
    private static final Set<String> ALLOWED_ROLES = Set.of("button", "link", "radio", "checkbox", "option");
    private final BrowserSessionManager browsers;
    private final ElementRegistry elements;
    private final DemoAgentBridgeRegistry bridges;
    private final OverlayTargetStore targets;
    private final ConversationEventPublisher events;
    private final ConversationMessagePolicy textPolicy;

    public OverlayTargetService(BrowserSessionManager browsers, ElementRegistry elements,
            DemoAgentBridgeRegistry bridges, OverlayTargetStore targets,
            ConversationEventPublisher events, ConversationMessagePolicy textPolicy) {
        this.browsers = browsers; this.elements = elements; this.bridges = bridges;
        this.targets = targets; this.events = events; this.textPolicy = textPolicy;
        targets.setClearListener((target, reason) -> events.overlayClear(target, reason, Instant.now()));
    }

    public PublicOverlayTarget create(String sessionId, String pageIdentity,
            SanitizedDomSnapshot snapshot, String internalElementId, String guide) {
        DemoAgentBridgeBinding bridge = bridges.find(sessionId)
                .orElseThrow(() -> new OverlayTargetException(OverlayTargetError.BRIDGE_TOKEN_INVALID));
        if (!bridge.pageIdentity().equals(pageIdentity)) throw new OverlayTargetException(OverlayTargetError.TARGET_STALE_PAGE);
        SanitizedDomSnapshot.ElementSnapshot source = snapshot.elements().stream()
                .filter(element -> element.elementId().equals(internalElementId)).findFirst()
                .orElseThrow(() -> new OverlayTargetException(OverlayTargetError.TARGET_NOT_FOUND));
        String role = safeRole(source.role(), source.tag());
        String label = safeText(source.ariaLabel() == null || source.ariaLabel().isBlank()
                ? source.text() : source.ariaLabel(), 120);
        String safeGuide = safeText(guide, 200);
        Geometry geometry = browsers.execute(sessionId, TIMEOUT, page -> {
            Locator locator = elements.resolveLocator(page, sessionId, internalElementId);
            if (!locator.isVisible() || !locator.isEnabled()) throw new OverlayTargetException(TARGET_NOT_INTERACTABLE);
            Object raw = locator.evaluate("element => { const r=element.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height,viewportWidth:window.innerWidth,viewportHeight:window.innerHeight,topLevel:window===window.top}; }");
            Map<?, ?> values = (Map<?, ?>) raw;
            if (!Boolean.TRUE.equals(values.get("topLevel"))) throw new OverlayTargetException(TARGET_NOT_INTERACTABLE);
            return new Geometry(number(values, "x"), number(values, "y"), number(values, "width"),
                    number(values, "height"), number(values, "viewportWidth"), number(values, "viewportHeight"));
        });
        Instant now = Instant.now();
        PublicOverlayTarget target = new PublicOverlayTarget(
                UUID.randomUUID().toString(), sessionId, pageIdentity, snapshot.snapshotId(),
                OverlayCoordinateSpace.VIEWPORT_CSS_PX,
                new PublicOverlayTarget.Rectangle(geometry.x, geometry.y, geometry.width, geometry.height),
                new PublicOverlayTarget.Viewport(geometry.viewportWidth, geometry.viewportHeight),
                role, label, safeGuide, OverlayActionMode.GUIDE_USER_CLICK,
                now, targets.expiresAt(), null);
        PublicOverlayTarget saved = targets.replace(
                target, internalElementId, DomSnapshotFingerprint.of(snapshot));
        events.overlayTarget(saved, now);
        return saved;
    }

    private String safeRole(String role, String tag) {
        String normalized = role == null || role.isBlank() ? tag : role;
        normalized = normalized.toLowerCase(Locale.ROOT);
        if (!ALLOWED_ROLES.contains(normalized)) throw new OverlayTargetException(TARGET_NOT_INTERACTABLE);
        return normalized;
    }
    private String safeText(String value, int maxLength) {
        String safe = textPolicy.sanitize(value);
        if (safe.length() > maxLength || safe.contains("<") || safe.contains(">")) throw new OverlayTargetException(TARGET_NOT_INTERACTABLE);
        return safe;
    }
    private double number(Map<?, ?> values, String key) {
        Object value = values.get(key);
        if (!(value instanceof Number number)) throw new OverlayTargetException(TARGET_NOT_INTERACTABLE);
        return number.doubleValue();
    }
    private record Geometry(double x, double y, double width, double height,
                            double viewportWidth, double viewportHeight) { }
}
