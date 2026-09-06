package com.ddd.backend.automation;

import com.ddd.backend.automation.session.BrowserSessionManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Objects;

@Service
public final class BrowserActionExecutor {

    private static final Logger log =
            LoggerFactory.getLogger(
                    BrowserActionExecutor.class
            );

    private static final Duration ACTION_TIMEOUT =
            Duration.ofSeconds(15);

    /*
     * D12
     *
     * 일반 Action은 1회만 실행한다.
     *
     * 안전하게 반복 가능한 Action만
     * 최초 실행 + 재시도 1회,
     * 총 최대 2회 허용한다.
     */
    private static final int DEFAULT_MAX_ATTEMPTS =
            1;

    private static final int SAFE_RETRY_MAX_ATTEMPTS =
            2;

    private final BrowserSessionManager browserSessionManager;

    private final BrowserActionValidator actionValidator;

    private final BrowserActionPolicyContextResolver contextResolver;

    private final BrowserActionPolicyEvaluator policyEvaluator;

    public BrowserActionExecutor(
            BrowserSessionManager browserSessionManager,
            BrowserActionValidator actionValidator,
            BrowserActionPolicyContextResolver contextResolver,
            BrowserActionPolicyEvaluator policyEvaluator
    ) {
        this.browserSessionManager =
                Objects.requireNonNull(
                        browserSessionManager,
                        "BrowserSessionManager는 필수입니다."
                );

        this.actionValidator =
                Objects.requireNonNull(
                        actionValidator,
                        "BrowserActionValidator는 필수입니다."
                );

        this.contextResolver =
                Objects.requireNonNull(
                        contextResolver,
                        "BrowserActionPolicyContextResolver는 필수입니다."
                );

        this.policyEvaluator =
                Objects.requireNonNull(
                        policyEvaluator,
                        "BrowserActionPolicyEvaluator는 필수입니다."
                );
    }

    public BrowserActionExecutionResult execute(
            String sessionId,
            BrowserAction action
    ) {
        validateSessionId(
                sessionId
        );

        actionValidator.validate(
                action
        );

        /*
         * 보안 정책은 Action 실행 전에
         * 딱 한 번 먼저 평가한다.
         *
         * Retry가 정책 검사를 우회하는 구조가
         * 되어서는 안 된다.
         */
        BrowserActionPolicyContext context =
                contextResolver.resolve(
                        sessionId,
                        action
                );

        BrowserActionPolicyResult policyResult =
                policyEvaluator.evaluate(
                        action,
                        context
                );

        return switch (
                policyResult.decision()
                ) {
            case ALLOW ->
                    executeAllowedAction(
                            sessionId,
                            action
                    );

            case USER_ACTION_REQUIRED ->
                    BrowserActionExecutionResult
                            .userActionRequired(
                                    action.type()
                            );

            case SECURE_INPUT_REQUIRED ->
                    BrowserActionExecutionResult
                            .secureInputRequired(
                                    action.type()
                            );

            case FINAL_CONFIRMATION_REQUIRED ->
                    BrowserActionExecutionResult
                            .finalConfirmationRequired(
                                    action.type()
                            );

            case BLOCKED -> {
                if (action.type()
                        == BrowserActionType.STOP) {

                    yield BrowserActionExecutionResult
                            .stopped();
                }

                yield BrowserActionExecutionResult
                        .blocked(
                                action.type()
                        );
            }
        };
    }

    private BrowserActionExecutionResult executeAllowedAction(
            String sessionId,
            BrowserAction action
    ) {
        return switch (
                action.type()
                ) {
            case NONE ->
                    BrowserActionExecutionResult
                            .noAction();

            case CLICK,
                 TYPE,
                 SELECT,
                 SCROLL,
                 PRESS_KEY,
                 GO_BACK,
                 REFRESH,
                 WAIT ->
                    executePageAction(
                            sessionId,
                            action
                    );

            case WAIT_FOR_USER ->
                    BrowserActionExecutionResult
                            .userActionRequired(
                                    action.type()
                            );

            case PAUSE_FOR_SECURE_INPUT ->
                    BrowserActionExecutionResult
                            .secureInputRequired(
                                    action.type()
                            );

            case REQUEST_FINAL_CONFIRMATION ->
                    BrowserActionExecutionResult
                            .finalConfirmationRequired(
                                    action.type()
                            );

            case STOP ->
                    BrowserActionExecutionResult
                            .stopped();
        };
    }

    /*
     * D12
     *
     * Action 종류에 따라 최대 실행 횟수를 결정하고,
     * 반드시 제한된 횟수 안에서만 실행한다.
     *
     * while(true) 같은 무한 Retry 구조는 사용하지 않는다.
     */
    private BrowserActionExecutionResult executePageAction(
            String sessionId,
            BrowserAction action
    ) {
        int maxAttempts =
                maxAttemptsFor(
                        action.type()
                );

        RuntimeException lastException =
                null;

        for (int attempt = 1;
             attempt <= maxAttempts;
             attempt++) {

            try {
                return executePageActionOnce(
                        sessionId,
                        action
                );

            } catch (RuntimeException exception) {

                lastException =
                        exception;

                if (!shouldRetry(
                        sessionId,
                        action.type(),
                        attempt,
                        maxAttempts
                )) {

                    throw exception;
                }

                /*
                 * selector, value, sessionId는
                 * 로그에 남기지 않는다.
                 *
                 * 민감정보/세션정보 노출 방지.
                 */
                log.debug(
                        "Browser Action 재시도. "
                                + "actionType={}, "
                                + "nextAttempt={}",
                        action.type(),
                        attempt + 1
                );
            }
        }

        /*
         * for-loop 구조상 정상적으로는
         * 도달할 수 없는 방어 코드.
         */
        if (lastException != null) {
            throw lastException;
        }

        throw new IllegalStateException(
                "브라우저 행동을 실행할 수 없습니다."
        );
    }

    /*
     * 실제 Action 1회 실행.
     *
     * Retry 시 이 메서드를 다시 호출하므로
     * browserSessionManager.execute()가
     * 최신 Page를 다시 가져오고,
     * page.locator(selector)도 새로 생성한다.
     *
     * 즉 stale Locator 객체를 보관하지 않는다.
     */
    private BrowserActionExecutionResult executePageActionOnce(
            String sessionId,
            BrowserAction action
    ) {
        return browserSessionManager.execute(
                sessionId,
                ACTION_TIMEOUT,
                page -> {

                    switch (
                            action.type()
                    ) {
                        case CLICK ->
                            /*
                             * CLICK은 중복 실행 위험 때문에
                             * maxAttemptsFor()에서 Retry 대상이 아니다.
                             */
                                page.locator(
                                        action.selector()
                                ).click();

                        case TYPE ->
                            /*
                             * fill()은 기존 값을 같은 값으로
                             * 다시 채우는 방식이라
                             * 제한적 Retry 허용.
                             */
                                page.locator(
                                        action.selector()
                                ).fill(
                                        action.value()
                                );

                        case SELECT ->
                            /*
                             * 동일 option 선택은
                             * 제한적 Retry 허용.
                             */
                                page.locator(
                                        action.selector()
                                ).selectOption(
                                        action.value()
                                );

                        case SCROLL ->
                            /*
                             * 상대 이동이므로 재시도하면
                             * 스크롤량이 중복될 수 있다.
                             */
                                page.mouse().wheel(
                                        scrollX(
                                                action
                                        ),
                                        scrollY(
                                                action
                                        )
                                );

                        case PRESS_KEY ->
                                page.keyboard().press(
                                        action.value()
                                );

                        case GO_BACK ->
                                page.goBack();

                        case REFRESH ->
                                page.reload();

                        case WAIT ->
                                page.waitForTimeout(
                                        action.waitMillis()
                                );

                        default ->
                                throw new IllegalStateException(
                                        "실행 대상이 아닌 브라우저 행동입니다."
                                );
                    }

                    return BrowserActionExecutionResult
                            .executed(
                                    action.type()
                            );
                }
        );
    }

    /*
     * D12
     *
     * 자동 Retry 허용 대상.
     *
     * TYPE:
     * 같은 값을 다시 fill 가능.
     *
     * SELECT:
     * 같은 option을 다시 선택 가능.
     *
     * CLICK / GO_BACK / PRESS_KEY / SCROLL 등은
     * 중복 실행 시 부작용이 있으므로 제외한다.
     */
    private int maxAttemptsFor(
            BrowserActionType actionType
    ) {
        if (actionType
                == BrowserActionType.TYPE
                || actionType
                == BrowserActionType.SELECT) {

            return SAFE_RETRY_MAX_ATTEMPTS;
        }

        return DEFAULT_MAX_ATTEMPTS;
    }

    private boolean shouldRetry(
            String sessionId,
            BrowserActionType actionType,
            int currentAttempt,
            int maxAttempts
    ) {
        /*
         * 정해진 최대 실행 횟수에 도달했으면
         * 무조건 종료.
         */
        if (currentAttempt >= maxAttempts) {
            return false;
        }

        /*
         * 안전한 Action이 아니면
         * 절대 자동 Retry하지 않는다.
         */
        if (actionType
                != BrowserActionType.TYPE
                && actionType
                != BrowserActionType.SELECT) {

            return false;
        }

        /*
         * BrowserSession 자체가 사라진 경우
         * Locator를 다시 찾아도 의미가 없다.
         */
        try {
            return browserSessionManager.exists(
                    sessionId
            );

        } catch (RuntimeException exception) {

            /*
             * 존재여부 확인 자체가 실패했다면
             * 안전하게 Retry하지 않는다.
             */
            return false;
        }
    }

    private int scrollX(
            BrowserAction action
    ) {
        return action.scrollX() == null
                ? 0
                : action.scrollX();
    }

    private int scrollY(
            BrowserAction action
    ) {
        return action.scrollY() == null
                ? 0
                : action.scrollY();
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
}