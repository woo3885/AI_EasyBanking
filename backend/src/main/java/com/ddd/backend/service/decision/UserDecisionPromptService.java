package com.ddd.backend.service.decision;

import com.ddd.backend.automation.dom.SanitizedDomSnapshot;
import com.ddd.backend.automation.dom.ElementLocatorResolver;
import com.ddd.backend.ai.AiDecisionResponse;
import com.ddd.backend.ai.AiDecisionOption;
import com.ddd.backend.domain.session.DecisionType;
import com.ddd.backend.frame.BrowserFramePayload;
import com.ddd.backend.frame.BrowserFrameStore;
import com.ddd.backend.websocket.dto.AutomationDecisionOption;
import com.ddd.backend.websocket.dto.AutomationDecisionPrompt;
import com.ddd.backend.websocket.publisher.AutomationStatusEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
public final class UserDecisionPromptService {

    private final BrowserFrameStore frameStore;
    private final UserDecisionSessionState decisionState;
    private final AutomationStatusEventPublisher eventPublisher;
    private final ElementLocatorResolver locatorResolver;

    @Autowired
    public UserDecisionPromptService(
            BrowserFrameStore frameStore,
            UserDecisionSessionState decisionState,
            AutomationStatusEventPublisher eventPublisher,
            ElementLocatorResolver locatorResolver
    ) {
        this.frameStore = Objects.requireNonNull(frameStore);
        this.decisionState = Objects.requireNonNull(decisionState);
        this.eventPublisher = Objects.requireNonNull(eventPublisher);
        this.locatorResolver = Objects.requireNonNull(locatorResolver);
    }

    public UserDecisionPromptService(
            BrowserFrameStore frameStore,
            UserDecisionSessionState decisionState,
            AutomationStatusEventPublisher eventPublisher
    ) {
        this.frameStore = Objects.requireNonNull(frameStore);
        this.decisionState = Objects.requireNonNull(decisionState);
        this.eventPublisher = Objects.requireNonNull(eventPublisher);
        this.locatorResolver = null;
    }

    public AutomationDecisionPrompt publish(
            String sessionId,
            SanitizedDomSnapshot snapshot
    ) {
        throw new IllegalStateException(
                "AI Decision Response에 decisionType이 필요합니다.");
    }

    public AutomationDecisionPrompt publish(
            String sessionId,
            SanitizedDomSnapshot snapshot,
            AiDecisionResponse response
    ) {
        Objects.requireNonNull(response, "AI Decision Response는 필수입니다.");
        if (!java.util.Set.of(
                DecisionType.PRODUCT_SELECTION,
                DecisionType.SOURCE_ACCOUNT_SELECTION,
                DecisionType.RECIPIENT_SELECTION,
                DecisionType.TERMS_AGREEMENT).contains(response.decisionType())
                || !snapshot.snapshotId().equals(response.sourceSnapshotId())) {
            throw new IllegalStateException(
                    "검증되지 않은 Decision 유형 또는 Snapshot입니다.");
        }
        List<AiDecisionOption> richOptions = response.decisionType()
                == DecisionType.TERMS_AGREEMENT && !response.terms().isEmpty()
                ? response.terms() : response.options();
        if (response.decisionType() == null || richOptions.isEmpty()) {
            throw new IllegalStateException(
                    "AI Decision Response의 유형과 선택지가 필요합니다.");
        }
        BrowserFramePayload frame = frameStore.latest(sessionId)
                .orElseThrow(() -> new IllegalStateException(
                        "사용자 결정과 연결할 Viewer Frame이 없습니다."));
        java.util.Map<String, SanitizedDomSnapshot.ElementSnapshot> elements =
                snapshot.elements().stream().collect(java.util.stream.Collectors.toMap(
                        SanitizedDomSnapshot.ElementSnapshot::elementId,
                        java.util.function.Function.identity(), (first, ignored) -> first));
        List<AutomationDecisionOption> options = richOptions.stream().map(option -> {
            SanitizedDomSnapshot.ElementSnapshot element = elements.get(option.id());
            if (element == null) {
                throw new IllegalStateException("Snapshot에 없는 Decision Option입니다.");
            }
            boolean checked = isChecked(sessionId, option.id());
            if (response.decisionType() == DecisionType.TERMS_AGREEMENT
                    && (option.checked() == null || option.checked() != checked)) {
                throw new IllegalStateException(
                        "약관 checked 상태가 현재 DOM과 일치하지 않습니다.");
            }
            return new AutomationDecisionOption(
                    option.id(),
                    option.label() == null || option.label().isBlank()
                            ? safeLabel(element) : option.label(),
                    option.required() || isRequiredTerm(element),
                    checked,
                    !element.enabled());
        }).toList();
        AutomationDecisionPrompt prompt = new AutomationDecisionPrompt(
                "req-" + UUID.randomUUID(), "dec-" + UUID.randomUUID(),
                response.decisionType(), options, frame.metadata().frameId(),
                frame.metadata().sequence(), snapshot.snapshotId());
        decisionState.register(sessionId, prompt);
        eventPublisher.publishDecisionRequired(
                sessionId, prompt, response.message() == null
                        ? "사용자가 항목을 선택해야 합니다." : response.message());
        return prompt;
    }

    public AutomationDecisionPrompt publish(
            String sessionId,
            SanitizedDomSnapshot snapshot,
            DecisionType decisionType
    ) {
        Objects.requireNonNull(decisionType, "DecisionType은 필수입니다.");
        BrowserFramePayload frame = frameStore.latest(sessionId)
                .orElseThrow(() -> new IllegalStateException(
                        "사용자 결정과 연결할 Viewer Frame이 없습니다."
                ));

        List<AutomationDecisionOption> options = snapshot.elements().stream()
                .filter(element -> element.securityPolicy()
                        == SanitizedDomSnapshot.SecurityPolicy.USER_DECISION)
                .map(element -> new AutomationDecisionOption(
                        element.elementId(),
                        safeLabel(element),
                        isRequiredTerm(element),
                        isChecked(sessionId, element.elementId()),
                        !element.enabled()))
                .limit(20)
                .toList();

        if (options.isEmpty()) {
            throw new IllegalStateException("사용자가 선택할 수 있는 항목이 없습니다.");
        }

        AutomationDecisionPrompt prompt = new AutomationDecisionPrompt(
                "req-" + UUID.randomUUID(),
                "dec-" + UUID.randomUUID(),
                decisionType,
                options,
                frame.metadata().frameId(),
                frame.metadata().sequence(),
                snapshot.snapshotId()
        );

        decisionState.register(sessionId, prompt);
        eventPublisher.publishDecisionRequired(
                sessionId, prompt, "사용자가 항목을 선택해야 합니다."
        );
        return prompt;
    }

    private boolean isChecked(String sessionId, String elementId) {
        if (locatorResolver == null) {
            return false;
        }
        try {
            return locatorResolver.withLocator(
                    sessionId, elementId, locator -> locator.isChecked());
        } catch (RuntimeException ignored) {
            return false;
        }
    }

    private boolean isRequiredTerm(SanitizedDomSnapshot.ElementSnapshot element) {
        String label = safeLabel(element).toLowerCase(java.util.Locale.ROOT);
        return "checkbox".equalsIgnoreCase(element.inputType())
                && (label.contains("필수") || label.contains("required"));
    }

    private boolean containsTermMarker(SanitizedDomSnapshot.ElementSnapshot element) {
        String label = safeLabel(element).toLowerCase(java.util.Locale.ROOT);
        return label.contains("약관")
                || label.contains("동의")
                || label.contains("agreement")
                || label.contains("consent");
    }

    private String safeLabel(SanitizedDomSnapshot.ElementSnapshot element) {
        String[] values = {
                element.ariaLabel(), element.text(), element.placeholder(),
                element.role(), element.tag()
        };
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                String trimmed = value.trim();
                return trimmed.substring(0, Math.min(trimmed.length(), 120));
            }
        }
        return "선택 항목";
    }
}
