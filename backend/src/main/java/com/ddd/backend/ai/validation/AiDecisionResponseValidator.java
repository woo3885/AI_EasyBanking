package com.ddd.backend.ai.validation;

import com.ddd.backend.ai.AiDecisionResponse;
import com.ddd.backend.ai.AiDecisionOption;
import com.ddd.backend.automation.BrowserActionType;
import com.ddd.backend.automation.dom.SanitizedDomSnapshot;
import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.Objects;
import java.util.Set;

@Component
public final class AiDecisionResponseValidator {

    private static final int MAX_VALUE_LENGTH =
            2_000;

    private static final int MAX_WAIT_MILLIS =
            10_000;

    private static final int MAX_SCROLL_DISTANCE =
            3_000;

    private static final Set<String> SAFE_KEYS =
            Set.of(
                    "ENTER",
                    "TAB",
                    "ESCAPE",
                    "ARROWUP",
                    "ARROWDOWN",
                    "ARROWLEFT",
                    "ARROWRIGHT",
                    "PAGEUP",
                    "PAGEDOWN",
                    "HOME",
                    "END",
                    "SPACE",
                    "BACKSPACE",
                    "DELETE"
            );

    public AiDecisionResponse validate(
            AiDecisionResponse response,
            SanitizedDomSnapshot snapshot
    ) {

        Objects.requireNonNull(
                response,
                "AiDecisionResponse는 필수입니다."
        );

        Objects.requireNonNull(
                snapshot,
                "SanitizedDomSnapshot은 필수입니다."
        );

        BrowserActionType actionType =
                Objects.requireNonNull(
                        response.actionType(),
                        "actionType은 필수입니다."
                );

        if (actionType != BrowserActionType.REQUEST_FINAL_CONFIRMATION
                && (response.confirmationType() != null
                || response.confirmationTargetElementId() != null)) {
            throw invalidPayload("일반 Action에는 최종 확인 payload를 사용할 수 없습니다.");
        }

        validateDecisionPayload(response, snapshot);

        switch (actionType) {

            case CLICK ->
                    validateClick(
                            response,
                            snapshot
                    );

            case TYPE, SELECT ->
                    validateValueElementAction(
                            response,
                            snapshot
                    );

            case SCROLL ->
                    validateScroll(
                            response
                    );

            case PRESS_KEY ->
                    validatePressKey(
                            response
                    );

            case WAIT ->
                    validateWait(
                            response
                    );

            case REQUEST_FINAL_CONFIRMATION ->
                    validateFinalConfirmation(response, snapshot);

            case NONE,
                 GO_BACK,
                 REFRESH,
                 WAIT_FOR_USER,
                 PAUSE_FOR_SECURE_INPUT,
                 STOP ->
                    requireNoPayload(
                            response
                    );
        }

        return response;
    }

    private void validateFinalConfirmation(
            AiDecisionResponse response, SanitizedDomSnapshot snapshot
    ) {
        requireNoPayload(response);
        if (response.confirmationType()
                != com.ddd.backend.domain.session.ConfirmationType.DEPOSIT_SUBSCRIPTION
                || response.confirmationTargetElementId() == null
                || response.sourceSnapshotId() == null
                || !response.sourceSnapshotId().equals(snapshot.snapshotId())
                || !"FINAL_CONFIRMATION_REQUIRED".equals(response.status())
                || !Boolean.TRUE.equals(response.requiresUserAction())
                || !Boolean.TRUE.equals(response.executionBlocked())) {
            throw invalidPayload("최종 확인 응답 계약이 올바르지 않습니다.");
        }
        SanitizedDomSnapshot.ElementSnapshot target = snapshot.elements().stream()
                .filter(element -> response.confirmationTargetElementId()
                        .equals(element.elementId()))
                .findFirst()
                .orElseThrow(() -> invalidPayload("최종 확인 대상이 Snapshot에 없습니다."));
        if (!target.visible() || !target.enabled()
                || target.securityPolicy()
                != SanitizedDomSnapshot.SecurityPolicy.FINAL_CONFIRMATION) {
            throw invalidPayload("최종 확인 대상을 안전하게 실행할 수 없습니다.");
        }
    }

    private void validateDecisionPayload(
            AiDecisionResponse response,
            SanitizedDomSnapshot snapshot
    ) {
        java.util.List<AiDecisionOption> choices = response.decisionType()
                == com.ddd.backend.domain.session.DecisionType.TERMS_AGREEMENT
                && !response.terms().isEmpty()
                ? response.terms() : response.options();
        boolean hasDecision = response.decisionType() != null
                || !response.options().isEmpty() || !response.terms().isEmpty();
        if (!hasDecision && response.actionType() != BrowserActionType.WAIT_FOR_USER) {
            return;
        }
        Set<com.ddd.backend.domain.session.DecisionType> supportedTypes = Set.of(
                com.ddd.backend.domain.session.DecisionType.PRODUCT_SELECTION,
                com.ddd.backend.domain.session.DecisionType.SOURCE_ACCOUNT_SELECTION,
                com.ddd.backend.domain.session.DecisionType.RECIPIENT_SELECTION,
                com.ddd.backend.domain.session.DecisionType.TERMS_AGREEMENT);
        if (response.decisionType() == null || choices.isEmpty()
                || !supportedTypes.contains(response.decisionType())
                || response.actionType() != BrowserActionType.WAIT_FOR_USER
                || !"USER_DECISION_REQUIRED".equals(response.status())
                || !Boolean.TRUE.equals(response.requiresUserAction())
                || !Boolean.TRUE.equals(response.executionBlocked())
                || response.sourceSnapshotId() == null
                || !response.sourceSnapshotId().equals(snapshot.snapshotId())) {
            throw invalidPayload("사용자 결정 응답 계약이 올바르지 않습니다.");
        }
        Set<String> ids = new java.util.HashSet<>();
        for (AiDecisionOption choice : choices) {
            if (choice == null || choice.id() == null
                    || !ids.add(choice.id())) {
                throw invalidPayload("결정 Option ID가 비어 있거나 중복됩니다.");
            }
            SanitizedDomSnapshot.ElementSnapshot element = snapshot.elements().stream()
                    .filter(candidate -> choice.id().equals(candidate.elementId()))
                    .findFirst()
                    .orElseThrow(() -> new AiDecisionValidationException(
                            AiDecisionValidationException.Code.UNKNOWN_ELEMENT_ID,
                            "현재 Snapshot에 없는 Decision Option입니다."));
            if (!element.visible() || !element.enabled()
                    || element.securityPolicy()
                    != SanitizedDomSnapshot.SecurityPolicy.USER_DECISION) {
                throw new AiDecisionValidationException(
                        AiDecisionValidationException.Code.ELEMENT_NOT_INTERACTABLE,
                        "안전하게 선택할 수 없는 Decision Option입니다.");
            }
            String sourceLabel = java.util.stream.Stream.of(
                            element.ariaLabel(), element.text(), element.placeholder())
                    .filter(java.util.Objects::nonNull)
                    .map(String::toLowerCase)
                    .reduce("", (left, right) -> left + " " + right);
            if (response.decisionType()
                    == com.ddd.backend.domain.session.DecisionType.TERMS_AGREEMENT
                    && (choice.checked() == null || element.checked() == null
                    || !choice.checked().equals(element.checked()))) {
                throw invalidPayload("약관 checked 상태가 필요합니다.");
            }
            if (response.decisionType()
                    == com.ddd.backend.domain.session.DecisionType.TERMS_AGREEMENT
                    && (sourceLabel.contains("필수") || sourceLabel.contains("required"))
                    && !choice.required()) {
                throw invalidPayload("필수 약관 정보가 Snapshot과 일치하지 않습니다.");
            }
        }
    }

    private void validateClick(
            AiDecisionResponse response,
            SanitizedDomSnapshot snapshot
    ) {

        SanitizedDomSnapshot.ElementSnapshot element =
                requireSafeElement(
                        response.elementId(),
                        snapshot
                );

        requireNoValue(
                response
        );

        requireNoScroll(
                response
        );

        requireNoWait(
                response
        );

        validateElementSecurityPolicy(
                element
        );
    }

    private void validateValueElementAction(
            AiDecisionResponse response,
            SanitizedDomSnapshot snapshot
    ) {

        SanitizedDomSnapshot.ElementSnapshot element =
                requireSafeElement(
                        response.elementId(),
                        snapshot
                );

        String value =
                response.value();

        if (value == null
                || value.isBlank()) {

            throw invalidPayload(
                    "TYPE/SELECT Action에는 value가 필요합니다."
            );
        }

        if (value.length()
                > MAX_VALUE_LENGTH) {

            throw invalidPayload(
                    "AI Action value 길이가 허용 범위를 초과했습니다."
            );
        }

        requireNoScroll(
                response
        );

        requireNoWait(
                response
        );

        validateElementSecurityPolicy(
                element
        );
    }

    private SanitizedDomSnapshot.ElementSnapshot
    requireSafeElement(
            String elementId,
            SanitizedDomSnapshot snapshot
    ) {

        if (elementId == null
                || elementId.isBlank()) {

            throw new AiDecisionValidationException(
                    AiDecisionValidationException
                            .Code
                            .MISSING_ELEMENT_ID,
                    "해당 Action에는 elementId가 필요합니다."
            );
        }

        if (!elementId.startsWith(
                "el-"
        )) {

            throw new AiDecisionValidationException(
                    AiDecisionValidationException
                            .Code
                            .UNKNOWN_ELEMENT_ID,
                    "허용되지 않은 elementId 형식입니다."
            );
        }

        SanitizedDomSnapshot.ElementSnapshot element =
                snapshot.elements()
                        .stream()
                        .filter(
                                candidate ->
                                        elementId.equals(
                                                candidate
                                                        .elementId()
                                        )
                        )
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        new AiDecisionValidationException(
                                                AiDecisionValidationException
                                                        .Code
                                                        .UNKNOWN_ELEMENT_ID,
                                                "현재 Snapshot에 없는 elementId입니다."
                                        )
                        );

        if (!element.visible()
                || !element.enabled()) {

            throw new AiDecisionValidationException(
                    AiDecisionValidationException
                            .Code
                            .ELEMENT_NOT_INTERACTABLE,
                    "현재 조작할 수 없는 Element입니다."
            );
        }

        return element;
    }

    private void validateElementSecurityPolicy(
            SanitizedDomSnapshot.ElementSnapshot element
    ) {

        SanitizedDomSnapshot.SecurityPolicy policy =
                element.securityPolicy();

        if (policy == null) {

            throw new AiDecisionValidationException(
                    AiDecisionValidationException
                            .Code
                            .BLOCKED_ELEMENT,
                    "Element Security Policy가 없습니다."
            );
        }

        switch (policy) {

            case NORMAL -> {
                return;
            }

            case USER_DECISION ->
                    throw new AiDecisionValidationException(
                            AiDecisionValidationException
                                    .Code
                                    .USER_DECISION_REQUIRED,
                            "사용자 선택이 필요한 Element입니다."
                    );

            case SECURE_INPUT ->
                    throw new AiDecisionValidationException(
                            AiDecisionValidationException
                                    .Code
                                    .SECURE_INPUT_REQUIRED,
                            "보안 입력 대상 Element는 AI가 조작할 수 없습니다."
                    );

            case FINAL_CONFIRMATION ->
                    throw new AiDecisionValidationException(
                            AiDecisionValidationException
                                    .Code
                                    .FINAL_CONFIRMATION_REQUIRED,
                            "최종 승인 대상 Element는 AI가 조작할 수 없습니다."
                    );

            case BLOCKED ->
                    throw new AiDecisionValidationException(
                            AiDecisionValidationException
                                    .Code
                                    .BLOCKED_ELEMENT,
                            "차단된 Element입니다."
                    );
        }
    }

    private void validatePressKey(
            AiDecisionResponse response
    ) {

        requireNoElement(
                response
        );

        requireNoScroll(
                response
        );

        requireNoWait(
                response
        );

        String value =
                response.value();

        if (value == null
                || value.isBlank()) {

            throw invalidPayload(
                    "PRESS_KEY Action에는 key value가 필요합니다."
            );
        }

        /*
         * Control+L, Meta+R 같은
         * 조합키를 AI가 임의 실행하지 못하게 한다.
         */
        if (value.contains(
                "+"
        )) {

            throw new AiDecisionValidationException(
                    AiDecisionValidationException
                            .Code
                            .UNSAFE_KEY,
                    "조합키 Action은 허용되지 않습니다."
            );
        }

        String normalized =
                value
                        .trim()
                        .toUpperCase(
                                Locale.ROOT
                        );

        if (!SAFE_KEYS.contains(
                normalized
        )) {

            throw new AiDecisionValidationException(
                    AiDecisionValidationException
                            .Code
                            .UNSAFE_KEY,
                    "허용되지 않은 Keyboard Action입니다."
            );
        }
    }

    private void validateScroll(
            AiDecisionResponse response
    ) {

        requireNoElement(
                response
        );

        requireNoValue(
                response
        );

        requireNoWait(
                response
        );

        Integer scrollX =
                response.scrollX();

        Integer scrollY =
                response.scrollY();

        if (scrollX == null
                && scrollY == null) {

            throw new AiDecisionValidationException(
                    AiDecisionValidationException
                            .Code
                            .INVALID_SCROLL,
                    "SCROLL Action에는 scrollX 또는 scrollY가 필요합니다."
            );
        }

        int x =
                scrollX == null
                        ? 0
                        : scrollX;

        int y =
                scrollY == null
                        ? 0
                        : scrollY;

        if (x == 0
                && y == 0) {

            throw new AiDecisionValidationException(
                    AiDecisionValidationException
                            .Code
                            .INVALID_SCROLL,
                    "이동 거리가 0인 SCROLL Action은 허용되지 않습니다."
            );
        }

        if (Math.abs(
                x
        ) > MAX_SCROLL_DISTANCE
                || Math.abs(
                y
        ) > MAX_SCROLL_DISTANCE) {

            throw new AiDecisionValidationException(
                    AiDecisionValidationException
                            .Code
                            .INVALID_SCROLL,
                    "SCROLL 거리가 허용 범위를 초과했습니다."
            );
        }
    }

    private void validateWait(
            AiDecisionResponse response
    ) {

        requireNoElement(
                response
        );

        requireNoValue(
                response
        );

        requireNoScroll(
                response
        );

        Integer waitMillis =
                response.waitMillis();

        if (waitMillis == null
                || waitMillis <= 0
                || waitMillis > MAX_WAIT_MILLIS) {

            throw new AiDecisionValidationException(
                    AiDecisionValidationException
                            .Code
                            .INVALID_WAIT,
                    "WAIT 시간은 1~10000ms 범위여야 합니다."
            );
        }
    }

    private void requireNoPayload(
            AiDecisionResponse response
    ) {

        if (response.elementId() != null
                || response.value() != null
                || response.scrollX() != null
                || response.scrollY() != null
                || response.waitMillis() != null) {

            throw invalidPayload(
                    response.actionType()
                            + " Action에는 추가 payload를 사용할 수 없습니다."
            );
        }
    }

    private void requireNoElement(
            AiDecisionResponse response
    ) {

        if (response.elementId() != null) {

            throw invalidPayload(
                    "해당 Action에는 elementId를 사용할 수 없습니다."
            );
        }
    }

    private void requireNoValue(
            AiDecisionResponse response
    ) {

        if (response.value() != null) {

            throw invalidPayload(
                    "해당 Action에는 value를 사용할 수 없습니다."
            );
        }
    }

    private void requireNoScroll(
            AiDecisionResponse response
    ) {

        if (response.scrollX() != null
                || response.scrollY() != null) {

            throw invalidPayload(
                    "해당 Action에는 scroll 값을 사용할 수 없습니다."
            );
        }
    }

    private void requireNoWait(
            AiDecisionResponse response
    ) {

        if (response.waitMillis() != null) {

            throw invalidPayload(
                    "해당 Action에는 waitMillis를 사용할 수 없습니다."
            );
        }
    }

    private AiDecisionValidationException
    invalidPayload(
            String message
    ) {

        return new AiDecisionValidationException(
                AiDecisionValidationException
                        .Code
                        .INVALID_PAYLOAD,
                message
        );
    }
}
