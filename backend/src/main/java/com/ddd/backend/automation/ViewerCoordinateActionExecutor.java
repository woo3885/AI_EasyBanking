package com.ddd.backend.automation;

import com.ddd.backend.automation.session.BrowserSessionManager;
import com.microsoft.playwright.Page;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public final class ViewerCoordinateActionExecutor {

    private static final Duration ACTION_TIMEOUT =
            Duration.ofSeconds(10);

    /*
     * 좌표 아래 현재 DOM을 Action 직전에 다시 검사한다.
     *
     * iframe 내부 DOM은 main document의
     * elementFromPoint만으로 안전하게 재검증할 수 없으므로
     * iframe 자체를 감지해 fail-closed한다.
     */
    private static final String HIT_TEST_SCRIPT =
            """
            ([x, y]) => {
                const hit =
                    document.elementFromPoint(x, y);

                if (!hit) {
                    return {
                        found: false
                    };
                }

                const tagName =
                    String(hit.tagName || '')
                        .toLowerCase();

                const embeddedFrame =
                    tagName === 'iframe'
                    || tagName === 'frame';

                const target =
                    hit.closest(
                        [
                            '[data-ddd-policy]',
                            'button',
                            'input',
                            'select',
                            'textarea',
                            'a[href]',
                            '[role]',
                            '[contenteditable="true"]'
                        ].join(',')
                    ) || hit;

                const style =
                    window.getComputedStyle(target);

                const rect =
                    target.getBoundingClientRect();

                const visible =
                    rect.width > 0
                    && rect.height > 0
                    && style.display !== 'none'
                    && style.visibility !== 'hidden'
                    && style.pointerEvents !== 'none';

                const ariaDisabled =
                    String(
                        target.getAttribute('aria-disabled')
                        || ''
                    ).toLowerCase() === 'true';

                const nativeDisabled =
                    typeof target.matches === 'function'
                    && target.matches(':disabled');

                const text =
                    String(
                        target.innerText
                        ?? target.textContent
                        ?? ''
                    ).slice(0, 500);

                const canScroll =
                    (element) => {
                        if (!element) {
                            return false;
                        }

                        const s =
                            window.getComputedStyle(element);

                        const overflowX =
                            String(s.overflowX || '');

                        const overflowY =
                            String(s.overflowY || '');

                        const xScrollable =
                            /(auto|scroll|overlay)/.test(
                                overflowX
                            )
                            && element.scrollWidth
                                > element.clientWidth;

                        const yScrollable =
                            /(auto|scroll|overlay)/.test(
                                overflowY
                            )
                            && element.scrollHeight
                                > element.clientHeight;

                        return xScrollable
                            || yScrollable;
                    };

                let scrollable = false;
                let node = target;

                while (node
                        && node instanceof HTMLElement) {

                    if (canScroll(node)) {
                        scrollable = true;
                        break;
                    }

                    node = node.parentElement;
                }

                if (!scrollable) {
                    const root =
                        document.scrollingElement;

                    if (root) {
                        scrollable =
                            root.scrollWidth
                                > root.clientWidth
                            || root.scrollHeight
                                > root.clientHeight;
                    }
                }

                return {
                    found: true,
                    visible,
                    enabled:
                        !ariaDisabled
                        && !nativeDisabled,
                    embeddedFrame,
                    scrollable,
                    explicitPolicy:
                        target.getAttribute(
                            'data-ddd-policy'
                        ),
                    type:
                        target.getAttribute('type'),
                    id:
                        target.getAttribute('id'),
                    name:
                        target.getAttribute('name'),
                    autocomplete:
                        target.getAttribute(
                            'autocomplete'
                        ),
                    ariaLabel:
                        target.getAttribute(
                            'aria-label'
                        ),
                    text
                };
            }
            """;

    private final BrowserSessionManager
            browserSessionManager;

    private final BrowserActionPolicyContextResolver
            policyContextResolver;

    public ViewerCoordinateActionExecutor(
            BrowserSessionManager browserSessionManager,
            BrowserActionPolicyContextResolver
                    policyContextResolver
    ) {
        this.browserSessionManager =
                Objects.requireNonNull(
                        browserSessionManager,
                        "BrowserSessionManager는 필수입니다."
                );

        this.policyContextResolver =
                Objects.requireNonNull(
                        policyContextResolver,
                        "BrowserActionPolicyContextResolver는 필수입니다."
                );
    }

    public BrowserActionExecutionResult executeClick(
            String sessionId,
            int x,
            int y
    ) {
        validateSessionId(
                sessionId
        );

        return browserSessionManager.execute(
                sessionId,
                ACTION_TIMEOUT,
                page ->
                        executeClickOnPage(
                                page,
                                x,
                                y
                        )
        );
    }

    /*
     * package-private:
     * Playwright 객체를 밖으로 유출하지 않고
     * 단위 테스트 가능하게 한다.
     */
    BrowserActionExecutionResult executeClickOnPage(
            Page page,
            int x,
            int y
    ) {
        CoordinateTargetSnapshot target =
                inspectTarget(
                        page,
                        x,
                        y
                );

        BrowserActionExecutionResult blocked =
                validateTarget(
                        target,
                        BrowserActionType.CLICK
                );

        if (blocked != null) {
            return blocked;
        }

        /*
         * 검증과 Action이 동일 Worker 작업 안에서 수행된다.
         *
         * 자동 Retry 없음.
         * Primary button / clickCount=1 고정.
         */
        page.mouse().move(
                x,
                y
        );

        page.mouse().click(
                x,
                y
        );

        return BrowserActionExecutionResult
                .executed(
                        BrowserActionType.CLICK
                );
    }

    public BrowserActionExecutionResult executeScroll(
            String sessionId,
            int x,
            int y,
            int deltaX,
            int deltaY
    ) {
        validateSessionId(
                sessionId
        );

        return browserSessionManager.execute(
                sessionId,
                ACTION_TIMEOUT,
                page ->
                        executeScrollOnPage(
                                page,
                                x,
                                y,
                                deltaX,
                                deltaY
                        )
        );
    }

    BrowserActionExecutionResult executeScrollOnPage(
            Page page,
            int x,
            int y,
            int deltaX,
            int deltaY
    ) {
        CoordinateTargetSnapshot target =
                inspectTarget(
                        page,
                        x,
                        y
                );

        BrowserActionExecutionResult blocked =
                validateTarget(
                        target,
                        BrowserActionType.SCROLL
                );

        if (blocked != null) {
            return blocked;
        }

        /*
         * 안전하게 검증된 좌표 아래에
         * 실제 scroll 가능한 ancestor 또는
         * document scroll 영역이 있어야 한다.
         */
        if (!target.scrollable()) {

            return BrowserActionExecutionResult
                    .blocked(
                            BrowserActionType.SCROLL
                    );
        }

        /*
         * 브라우저 native wheel dispatch를 사용한다.
         *
         * 좌표 아래의 scrollable ancestor가
         * 실제 scroll target을 결정한다.
         *
         * 자동 Retry 없음.
         */
        page.mouse().move(
                x,
                y
        );

        page.mouse().wheel(
                deltaX,
                deltaY
        );

        return BrowserActionExecutionResult
                .executed(
                        BrowserActionType.SCROLL
                );
    }

    private BrowserActionExecutionResult validateTarget(
            CoordinateTargetSnapshot target,
            BrowserActionType actionType
    ) {
        if (target == null
                || !target.found()
                || !target.visible()
                || !target.enabled()
                || target.embeddedFrame()) {

            return BrowserActionExecutionResult
                    .blocked(
                            actionType
                    );
        }

        BrowserActionPolicyContext context =
                policyContextResolver
                        .resolveMetadata(
                                target.explicitPolicy(),
                                target.type(),
                                target.id(),
                                target.name(),
                                target.autocomplete(),
                                target.ariaLabel(),
                                target.text(),
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
         * USER_VIEWER는 실제 사용자의 명시적 Action.
         *
         * 따라서 userChoice / optionalConsent는 허용.
         * AI Action과 정책이 분리된다.
         */
        return null;
    }

    private CoordinateTargetSnapshot inspectTarget(
            Page page,
            int x,
            int y
    ) {
        Objects.requireNonNull(
                page,
                "Page는 필수입니다."
        );

        Object raw =
                page.evaluate(
                        HIT_TEST_SCRIPT,
                        List.of(
                                x,
                                y
                        )
                );

        if (!(raw instanceof Map<?, ?> values)) {

            return CoordinateTargetSnapshot
                    .notFound();
        }

        boolean found =
                booleanValue(
                        values,
                        "found"
                );

        if (!found) {

            return CoordinateTargetSnapshot
                    .notFound();
        }

        return new CoordinateTargetSnapshot(
                true,
                booleanValue(
                        values,
                        "visible"
                ),
                booleanValue(
                        values,
                        "enabled"
                ),
                booleanValue(
                        values,
                        "embeddedFrame"
                ),
                booleanValue(
                        values,
                        "scrollable"
                ),
                stringValue(
                        values,
                        "explicitPolicy"
                ),
                stringValue(
                        values,
                        "type"
                ),
                stringValue(
                        values,
                        "id"
                ),
                stringValue(
                        values,
                        "name"
                ),
                stringValue(
                        values,
                        "autocomplete"
                ),
                stringValue(
                        values,
                        "ariaLabel"
                ),
                stringValue(
                        values,
                        "text"
                )
        );
    }

    private boolean booleanValue(
            Map<?, ?> values,
            String key
    ) {
        return Boolean.TRUE.equals(
                values.get(
                        key
                )
        );
    }

    private String stringValue(
            Map<?, ?> values,
            String key
    ) {
        Object value =
                values.get(
                        key
                );

        if (value == null) {
            return null;
        }

        String normalized =
                String.valueOf(
                                value
                        )
                        .trim();

        return normalized.isEmpty()
                ? null
                : normalized;
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

    private record CoordinateTargetSnapshot(
            boolean found,
            boolean visible,
            boolean enabled,
            boolean embeddedFrame,
            boolean scrollable,
            String explicitPolicy,
            String type,
            String id,
            String name,
            String autocomplete,
            String ariaLabel,
            String text
    ) {

        private static CoordinateTargetSnapshot
        notFound() {

            return new CoordinateTargetSnapshot(
                    false,
                    false,
                    false,
                    false,
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