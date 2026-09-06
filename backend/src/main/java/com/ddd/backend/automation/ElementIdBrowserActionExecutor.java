package com.ddd.backend.automation;

import com.ddd.backend.automation.dom.ElementLocatorResolver;
import com.microsoft.playwright.Locator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Objects;

@Service
public final class ElementIdBrowserActionExecutor {

    private static final Logger log =
            LoggerFactory.getLogger(
                    ElementIdBrowserActionExecutor.class
            );

    private final ElementLocatorResolver
            elementLocatorResolver;

    private final BrowserActionPolicyContextResolver
            policyContextResolver;

    public ElementIdBrowserActionExecutor(
            ElementLocatorResolver elementLocatorResolver,
            BrowserActionPolicyContextResolver
                    policyContextResolver
    ) {
        this.elementLocatorResolver =
                Objects.requireNonNull(
                        elementLocatorResolver,
                        "ElementLocatorResolver는 필수입니다."
                );

        this.policyContextResolver =
                Objects.requireNonNull(
                        policyContextResolver,
                        "BrowserActionPolicyContextResolver는 필수입니다."
                );
    }

    /*
     * 기존 Public Viewer CLICK 호환 메서드.
     *
     * Frontend 사용자가 Viewer에서 직접 클릭한 경우다.
     */
    public BrowserActionExecutionResult executeClick(
            String sessionId,
            String elementId
    ) {
        return executeUserClick(
                sessionId,
                elementId
        );
    }

    public BrowserActionExecutionResult executeConfirmedFinalClick(
            String sessionId, String elementId
    ) {
        validateText(sessionId, "sessionId");
        validateText(elementId, "elementId");
        try {
            return elementLocatorResolver.withLocator(sessionId, elementId, locator -> {
                if (!isInteractable(locator)) {
                    return BrowserActionExecutionResult.blocked(BrowserActionType.CLICK);
                }
                BrowserActionPolicyContext context = resolveCurrentPolicy(
                        locator, BrowserActionType.CLICK);
                if (!context.finalExecution() || context.blockedTarget()
                        || context.sensitiveInput()) {
                    return BrowserActionExecutionResult.blocked(BrowserActionType.CLICK);
                }
                locator.click();
                return BrowserActionExecutionResult.executed(BrowserActionType.CLICK);
            });
        } catch (RuntimeException exception) {
            return BrowserActionExecutionResult.blocked(BrowserActionType.CLICK);
        }
    }

    /*
     * 사용자가 Viewer에서 직접 선택한 CLICK.
     *
     * userChoice / optionalConsent는
     * 실제 사용자 행동이므로 실행할 수 있다.
     *
     * 단:
     *
     * - blocked
     * - sensitive
     * - final execution
     *
     * 은 여전히 실행하지 않는다.
     */
    public BrowserActionExecutionResult executeUserClick(
            String sessionId,
            String elementId
    ) {
        validateText(
                sessionId,
                "sessionId"
        );

        validateText(
                elementId,
                "elementId"
        );

        try {
            return elementLocatorResolver
                    .withLocator(
                            sessionId,
                            elementId,
                            this::executeResolvedUserClick
                    );

        } catch (RuntimeException exception) {

            /*
             * stale elementId
             * 다른 Page
             * fingerprint 불일치
             * Element 재탐색 실패
             *
             * 등의 경우 Selector fallback을 하지 않는다.
             */
            log.debug(
                    "Viewer elementId Action 차단. "
                            + "exceptionType={}",
                    exception
                            .getClass()
                            .getSimpleName()
            );

            return BrowserActionExecutionResult
                    .blocked(
                            BrowserActionType.CLICK
                    );
        }
    }

    /*
     * AI Engine이 반환한 elementId Action 실행.
     *
     * 지원:
     *
     * CLICK
     * TYPE
     * SELECT
     *
     * AI는 userChoice / optionalConsent를
     * 자동으로 조작할 수 없다.
     */
    public BrowserActionExecutionResult executeAiAction(
            String sessionId,
            BrowserActionType actionType,
            String elementId,
            String value
    ) {
        validateText(
                sessionId,
                "sessionId"
        );

        Objects.requireNonNull(
                actionType,
                "BrowserActionType은 필수입니다."
        );

        validateText(
                elementId,
                "elementId"
        );

        if (actionType
                != BrowserActionType.CLICK
                && actionType
                != BrowserActionType.TYPE
                && actionType
                != BrowserActionType.SELECT) {

            throw new IllegalArgumentException(
                    "elementId 기반 AI Action은 "
                            + "CLICK, TYPE, SELECT만 지원합니다."
            );
        }

        if ((actionType == BrowserActionType.TYPE
                || actionType == BrowserActionType.SELECT)
                && (value == null
                || value.isBlank())) {

            throw new IllegalArgumentException(
                    actionType
                            + " Action에는 value가 필요합니다."
            );
        }

        try {
            return elementLocatorResolver
                    .withLocator(
                            sessionId,
                            elementId,
                            locator ->
                                    executeResolvedAiAction(
                                            locator,
                                            actionType,
                                            value
                                    )
                    );

        } catch (RuntimeException exception) {

            /*
             * AI가 받은 elementId가 Snapshot 이후
             * 더 이상 유효하지 않으면 실행하지 않는다.
             *
             * Selector fallback 금지.
             */
            log.debug(
                    "AI elementId Action 차단. "
                            + "actionType={}, "
                            + "exceptionType={}",
                    actionType,
                    exception
                            .getClass()
                            .getSimpleName()
            );

            return BrowserActionExecutionResult
                    .blocked(
                            actionType
                    );
        }
    }

    /*
     * ElementLocatorResolver 내부의
     * PlaywrightWorker Thread에서 실행된다.
     */
    private BrowserActionExecutionResult
    executeResolvedUserClick(
            Locator locator
    ) {
        Objects.requireNonNull(
                locator,
                "Locator는 필수입니다."
        );

        if (!isInteractable(
                locator
        )) {

            return BrowserActionExecutionResult
                    .blocked(
                            BrowserActionType.CLICK
                    );
        }

        BrowserActionPolicyContext context =
                resolveCurrentPolicy(
                        locator,
                        BrowserActionType.CLICK
                );

        if (context.blockedTarget()) {

            return BrowserActionExecutionResult
                    .blocked(
                            BrowserActionType.CLICK
                    );
        }

        if (context.sensitiveInput()) {

            return BrowserActionExecutionResult
                    .secureInputRequired(
                            BrowserActionType.CLICK
                    );
        }

        if (context.finalExecution()) {

            return BrowserActionExecutionResult
                    .finalConfirmationRequired(
                            BrowserActionType.CLICK
                    );
        }

        /*
         * userChoice / optionalConsent는
         * 사용자가 직접 Viewer에서 보낸 요청이므로 허용.
         */
        locator.click();

        return BrowserActionExecutionResult
                .executed(
                        BrowserActionType.CLICK
                );
    }

    /*
     * AI Action 실행.
     *
     * Snapshot 정책 검사를 통과했더라도
     * 실제 실행 직전 현재 DOM으로 다시 검사한다.
     */
    private BrowserActionExecutionResult
    executeResolvedAiAction(
            Locator locator,
            BrowserActionType actionType,
            String value
    ) {
        Objects.requireNonNull(
                locator,
                "Locator는 필수입니다."
        );

        if (!isInteractable(
                locator
        )) {

            return BrowserActionExecutionResult
                    .blocked(
                            actionType
                    );
        }

        BrowserActionPolicyContext context =
                resolveCurrentPolicy(
                        locator,
                        actionType
                );

        if (context.blockedTarget()) {

            return BrowserActionExecutionResult
                    .blocked(
                            actionType
                    );
        }

        if (context.sensitiveInput()) {

            return BrowserActionExecutionResult
                    .secureInputRequired(
                            actionType
                    );
        }

        if (context.finalExecution()) {

            return BrowserActionExecutionResult
                    .finalConfirmationRequired(
                            actionType
                    );
        }

        /*
         * AI는 사용자가 직접 판단해야 하는
         * 선택사항을 자동 실행하지 않는다.
         */
        if (context.userChoice()
                || context.optionalConsent()) {

            return BrowserActionExecutionResult
                    .userActionRequired(
                            actionType
                    );
        }

        switch (actionType) {

            case CLICK ->
                    locator.click();

            case TYPE ->
                    locator.fill(
                            value
                    );

            case SELECT ->
                    locator.selectOption(
                            value
                    );

            default ->
                    throw new IllegalStateException(
                            "지원하지 않는 elementId Action입니다."
                    );
        }

        return BrowserActionExecutionResult
                .executed(
                        actionType
                );
    }

    private BrowserActionPolicyContext
    resolveCurrentPolicy(
            Locator locator,
            BrowserActionType actionType
    ) {
        return policyContextResolver
                .resolveMetadata(
                        locator.getAttribute(
                                "data-ddd-policy"
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
                        locator.textContent(),
                        actionType
                );
    }

    private boolean isInteractable(
            Locator locator
    ) {
        return locator.isVisible()
                && locator.isEnabled();
    }

    private void validateText(
            String value,
            String fieldName
    ) {
        if (value == null
                || value.isBlank()) {

            throw new IllegalArgumentException(
                    fieldName
                            + "은 비어 있을 수 없습니다."
            );
        }
    }
}
