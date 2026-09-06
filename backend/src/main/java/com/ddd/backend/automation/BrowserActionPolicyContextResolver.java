package com.ddd.backend.automation;

import com.ddd.backend.automation.session.BrowserSessionManager;
import com.microsoft.playwright.Locator;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Locale;
import java.util.Objects;

@Component
public final class BrowserActionPolicyContextResolver {

    private static final Duration RESOLVE_TIMEOUT =
            Duration.ofSeconds(5);

    private static final String POLICY_ATTRIBUTE =
            "data-ddd-policy";

    private final BrowserSessionManager browserSessionManager;

    public BrowserActionPolicyContextResolver(
            BrowserSessionManager browserSessionManager
    ) {
        this.browserSessionManager =
                Objects.requireNonNull(
                        browserSessionManager,
                        "BrowserSessionManager는 필수입니다."
                );
    }

    public BrowserActionPolicyContext resolve(
            String sessionId,
            BrowserAction action
    ) {
        validateSessionId(
                sessionId
        );

        Objects.requireNonNull(
                action,
                "브라우저 행동 명령은 필수입니다."
        );

        if (!requiresElementInspection(
                action
        )) {
            return BrowserActionPolicyContext.normal();
        }

        ElementPolicySnapshot snapshot =
                browserSessionManager.execute(
                        sessionId,
                        RESOLVE_TIMEOUT,
                        page ->
                                inspectElement(
                                        page.locator(
                                                action.selector()
                                        ).first()
                                )
                );

        if (!snapshot.found()) {
            return BrowserActionPolicyContext.normal();
        }

        return resolveSnapshot(
                snapshot,
                action.type()
        );
    }

    /*
     * D15
     *
     * Sanitized DOM에서도
     * Browser Action과 정확히 같은
     * 보안 정책 판정 규칙을 재사용한다.
     */
    public BrowserActionPolicyContext resolveMetadata(
            String explicitPolicy,
            String type,
            String id,
            String name,
            String autocomplete,
            String ariaLabel,
            String text,
            BrowserActionType actionType
    ) {
        Objects.requireNonNull(
                actionType,
                "브라우저 행동 유형은 필수입니다."
        );

        ElementPolicySnapshot snapshot =
                new ElementPolicySnapshot(
                        true,
                        explicitPolicy,
                        type,
                        id,
                        name,
                        autocomplete,
                        ariaLabel,
                        text
                );

        return resolveSnapshot(
                snapshot,
                actionType
        );
    }

    private BrowserActionPolicyContext resolveSnapshot(
            ElementPolicySnapshot snapshot,
            BrowserActionType actionType
    ) {
        BrowserActionPolicyContext explicitContext =
                resolveExplicitPolicy(
                        snapshot.policy()
                );

        if (explicitContext != null
                && explicitContext.blockedTarget()) {

            return BrowserActionPolicyContext
                    .forBlockedTarget();
        }

        String searchableText =
                normalize(
                        snapshot.type(),
                        snapshot.id(),
                        snapshot.name(),
                        snapshot.autocomplete(),
                        snapshot.ariaLabel(),
                        snapshot.text()
                );

        if ((explicitContext != null
                && explicitContext.sensitiveInput())
                || isSensitiveInput(
                snapshot,
                searchableText
        )) {

            return BrowserActionPolicyContext
                    .forSensitiveInput();
        }

        if ((explicitContext != null
                && explicitContext.finalExecution())
                || isFinalExecution(
                searchableText
        )) {

            return BrowserActionPolicyContext
                    .forFinalExecution();
        }

        if ((explicitContext != null
                && explicitContext.optionalConsent())
                || isOptionalConsent(
                snapshot,
                searchableText
        )) {

            return BrowserActionPolicyContext
                    .forOptionalConsent();
        }

        if ((explicitContext != null
                && explicitContext.userChoice())
                || isUserChoice(
                actionType,
                searchableText
        )) {

            return BrowserActionPolicyContext
                    .forUserChoice();
        }

        return BrowserActionPolicyContext.normal();
    }

    private boolean requiresElementInspection(
            BrowserAction action
    ) {
        if (action.selector() == null
                || action.selector().isBlank()) {

            return false;
        }

        return switch (
                action.type()
                ) {
            case CLICK,
                 TYPE,
                 SELECT -> true;

            default -> false;
        };
    }

    private ElementPolicySnapshot inspectElement(
            Locator locator
    ) {
        if (locator.count() == 0) {
            return ElementPolicySnapshot.notFound();
        }

        return new ElementPolicySnapshot(
                true,
                locator.getAttribute(
                        POLICY_ATTRIBUTE
                ),
                locator.getAttribute(
                        "type"
                ),
                locator.getAttribute(
                        "id"
                ),
                locator.getAttribute(
                        "name"
                ),
                locator.getAttribute(
                        "autocomplete"
                ),
                locator.getAttribute(
                        "aria-label"
                ),
                locator.textContent()
        );
    }

    private BrowserActionPolicyContext resolveExplicitPolicy(
            String policy
    ) {
        if (policy == null
                || policy.isBlank()) {

            return null;
        }

        return switch (
                policy.trim()
                        .toLowerCase(
                                Locale.ROOT
                        )
                ) {
            case "secure-input" ->
                    BrowserActionPolicyContext
                            .forSensitiveInput();

            case "user-choice" ->
                    BrowserActionPolicyContext
                            .forUserChoice();

            case "optional-consent" ->
                    BrowserActionPolicyContext
                            .forOptionalConsent();

            case "final-confirmation" ->
                    BrowserActionPolicyContext
                            .forFinalExecution();

            case "blocked" ->
                    BrowserActionPolicyContext
                            .forBlockedTarget();

            case "normal" ->
                    BrowserActionPolicyContext
                            .normal();

            default ->
                    BrowserActionPolicyContext
                            .forBlockedTarget();
        };
    }

    private boolean isSensitiveInput(
            ElementPolicySnapshot snapshot,
            String text
    ) {
        if ("password".equalsIgnoreCase(
                snapshot.type()
        )) {
            return true;
        }

        String autocomplete =
                normalize(
                        snapshot.autocomplete()
                );

        if (containsAny(
                autocomplete,
                "current-password",
                "new-password",
                "one-time-code",
                "cc-number"
        )) {
            return true;
        }

        String inputType = normalize(snapshot.type());
        boolean inputLike = containsAny(
                inputType,
                "text", "password", "tel", "number", "email", "search"
        ) || (snapshot.autocomplete() != null && !snapshot.autocomplete().isBlank());

        return inputLike && containsAny(
                text,
                "password",
                "passwd",
                "passcode",
                "pin",
                "otp",
                "verification-code",
                "security-card",
                "card-number",
                "resident-number",
                "비밀번호",
                "인증번호",
                "일회용 비밀번호",
                "보안카드",
                "카드번호",
                "주민등록번호",
                "공동인증서",
                "계좌 인증"
        );
    }

    private boolean isFinalExecution(
            String text
    ) {
        return containsAny(
                text,
                "transfer-final",
                "final-transfer",
                "final-submit",
                "confirm-transfer",
                "confirm-payment",
                "confirm-subscription",
                "송금 실행",
                "송금하기",
                "최종 송금",
                "가입 신청",
                "가입하기",
                "결제 확정",
                "계좌 개설",
                "대출 신청",
                "자동이체 등록"
        );
    }

    private boolean isOptionalConsent(
            ElementPolicySnapshot snapshot,
            String text
    ) {
        boolean selectableInput =
                "checkbox".equalsIgnoreCase(
                        snapshot.type()
                )
                        || "radio".equalsIgnoreCase(
                        snapshot.type()
                );

        if (!selectableInput) {
            return false;
        }

        return containsAny(
                text,
                "optional",
                "marketing",
                "third-party",
                "선택 약관",
                "선택 동의",
                "마케팅",
                "광고 수신",
                "제3자 제공"
        );
    }

    private boolean isUserChoice(
            BrowserActionType actionType,
            String text
    ) {
        if (actionType
                != BrowserActionType.CLICK
                && actionType
                != BrowserActionType.SELECT) {

            return false;
        }

        return containsAny(
                text,
                "select-account",
                "account-option",
                "select-product",
                "select-deposit",
                "product-option",
                "select-recipient",
                "recipient-option",
                "checkbox-term-",
                "term-service-required",
                "term-privacy-required",
                "terms-agreement",
                "required agreement",
                "required consent",
                "필수 약관",
                "필수 동의",
                "약관별 동의",
                "계좌 선택",
                "출금 계좌",
                "상품 선택",
                "금융상품",
                "수취인 선택",
                "받는 분 선택",
                "납입 금액 선택",
                "이체 금액 선택"
        );
    }

    private String normalize(
            String... values
    ) {
        StringBuilder builder =
                new StringBuilder();

        for (String value :
                values) {

            if (value == null
                    || value.isBlank()) {

                continue;
            }

            if (!builder.isEmpty()) {
                builder.append(
                        ' '
                );
            }

            builder.append(
                    value.trim()
                            .toLowerCase(
                                    Locale.ROOT
                            )
            );
        }

        return builder.toString();
    }

    private boolean containsAny(
            String source,
            String... keywords
    ) {
        if (source == null
                || source.isBlank()) {

            return false;
        }

        for (String keyword :
                keywords) {

            if (source.contains(
                    keyword.toLowerCase(
                            Locale.ROOT
                    )
            )) {
                return true;
            }
        }

        return false;
    }

    private void validateSessionId(
            String sessionId
    ) {
        if (sessionId == null
                || sessionId.isBlank()) {

            throw new IllegalArgumentException(
                    "브라우저 세션 ID는 비어 있을 수 없습니다."
            );
        }
    }

    private record ElementPolicySnapshot(
            boolean found,
            String policy,
            String type,
            String id,
            String name,
            String autocomplete,
            String ariaLabel,
            String text
    ) {

        private static ElementPolicySnapshot notFound() {
            return new ElementPolicySnapshot(
                    false,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null
            );
        }
    }
}
