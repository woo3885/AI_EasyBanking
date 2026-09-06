package com.ddd.backend.websocket.publisher;

import com.ddd.backend.automation.dom.ElementLocatorResolver;
import com.ddd.backend.automation.dom.SanitizedDomSnapshot;
import com.ddd.backend.frame.BrowserFramePayload;
import com.ddd.backend.frame.BrowserFrameStore;
import com.ddd.backend.websocket.dto.AutomationTarget;
import com.microsoft.playwright.options.BoundingBox;
import org.springframework.stereotype.Service;

import java.util.Objects;

@Service
public final class AutomationTargetEventService {

    private final ElementLocatorResolver locatorResolver;
    private final BrowserFrameStore frameStore;
    private final AutomationStatusEventPublisher eventPublisher;

    public AutomationTargetEventService(
            ElementLocatorResolver locatorResolver,
            BrowserFrameStore frameStore,
            AutomationStatusEventPublisher eventPublisher
    ) {
        this.locatorResolver = Objects.requireNonNull(locatorResolver);
        this.frameStore = Objects.requireNonNull(frameStore);
        this.eventPublisher = Objects.requireNonNull(eventPublisher);
    }

    public void publishCurrentTarget(
            String sessionId,
            SanitizedDomSnapshot snapshot,
            String elementId
    ) {
        if (elementId == null || elementId.isBlank()) {
            eventPublisher.publishTargetClear(sessionId, "표시할 대상이 없습니다.");
            return;
        }

        SanitizedDomSnapshot.ElementSnapshot element = snapshot.elements().stream()
                .filter(candidate -> elementId.equals(candidate.elementId()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException(
                        "현재 Snapshot에 Target elementId가 없습니다."));

        BrowserFramePayload frame = frameStore.latest(sessionId)
                .orElseThrow(() -> new IllegalStateException(
                        "Target과 연결할 Viewer Frame이 없습니다."));

        BoundingBox box = locatorResolver.withLocator(
                sessionId,
                elementId,
                locator -> locator.boundingBox()
        );

        if (box == null || box.width <= 0 || box.height <= 0) {
            throw new IllegalStateException("현재 DOM Target 좌표를 확인할 수 없습니다.");
        }

        AutomationTarget target = new AutomationTarget(
                elementId,
                safeLabel(element),
                box.x,
                box.y,
                box.width,
                box.height,
                frame.metadata().frameId(),
                frame.metadata().sequence(),
                snapshot.snapshotId()
        );

        eventPublisher.publishTarget(sessionId, target, target.label());
    }

    public void clearSafely(String sessionId, String message) {
        try {
            eventPublisher.publishTargetClear(sessionId, message);
        } catch (RuntimeException ignored) {
            // Target event failure must never trigger or retry a Browser Action.
        }
    }

    private String safeLabel(SanitizedDomSnapshot.ElementSnapshot element) {
        String[] candidates = {
                element.ariaLabel(), element.text(), element.placeholder(),
                element.role(), element.tag()
        };
        for (String candidate : candidates) {
            if (candidate != null && !candidate.isBlank()) {
                return candidate.trim().substring(0, Math.min(candidate.trim().length(), 120));
            }
        }
        return "선택 대상";
    }
}
