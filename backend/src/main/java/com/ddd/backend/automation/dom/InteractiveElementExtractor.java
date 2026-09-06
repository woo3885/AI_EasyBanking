package com.ddd.backend.automation.dom;

import com.ddd.backend.automation.session.BrowserSessionManager;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.BoundingBox;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Service
public final class InteractiveElementExtractor {

    private static final Duration EXTRACTION_TIMEOUT =
            Duration.ofSeconds(
                    10
            );

    static final String INTERACTIVE_SELECTOR =
            """
            button,
            a[href],
            input:not([type="hidden"]),
            select,
            textarea,
            [contenteditable="true"],
            [role="button"],
            [role="link"],
            [role="checkbox"],
            [role="radio"],
            [role="option"],
            [role="menuitem"],
            [role="tab"],
            [role="switch"],
            [role="combobox"]
            """;

    private final BrowserSessionManager browserSessionManager;

    public InteractiveElementExtractor(
            BrowserSessionManager browserSessionManager
    ) {
        this.browserSessionManager =
                Objects.requireNonNull(
                        browserSessionManager,
                        "BrowserSessionManager는 필수입니다."
                );
    }

    public List<InteractiveElement> extract(
            String sessionId
    ) {
        validateSessionId(
                sessionId
        );

        return browserSessionManager.execute(
                sessionId,
                EXTRACTION_TIMEOUT,
                this::extractFromPage
        );
    }

    /*
     * D15
     *
     * SanitizedDomSnapshotService가 동일한
     * PlaywrightWorker 작업 안에서
     * page 정보 + element 정보를 함께 Snapshot하기 위해 사용.
     */
    List<InteractiveElement> extractFromPage(
            Page page
    ) {
        Objects.requireNonNull(
                page,
                "Page는 필수입니다."
        );

        Locator candidates =
                page.locator(
                        ":is(" + INTERACTIVE_SELECTOR + ")"
                                + ":not([data-ddd-agent-ui], [data-ddd-agent-ui] *)"
                );

        int count =
                candidates.count();

        List<InteractiveElement> elements =
                new ArrayList<>(
                        count
                );

        for (int index = 0;
             index < count;
             index++) {

            Locator candidate =
                    candidates.nth(
                            index
                    );

            String tagName =
                    readTagName(
                            candidate
                    );

            /*
             * value / inputValue()는
             * 절대 읽지 않는다.
             */
            String text =
                    candidate.textContent();

            /*
             * 같은 상품 카드 안의 선택 버튼은 버튼 문구 대신 가까운
             * semantic heading만 사용한다. 카드 전체 텍스트나 금리는 읽지 않는다.
             */
            if ("button".equals(tagName)) {
                Object cardHeading = candidate.evaluate(
                        """
                        element => {
                          const container = element.closest('article');
                          const heading = container?.querySelector('h1, h2, h3');
                          return heading?.innerText?.trim() || null;
                        }
                        """);
                if (cardHeading instanceof String heading && !heading.isBlank()) {
                    text = heading;
                }
            }

            if (text == null || text.isBlank()) {
                Object associatedLabel = candidate.evaluate(
                        """
                        element => {
                          const direct = element.closest('label');
                          if (direct?.innerText?.trim()) return direct.innerText;
                          const id = element.getAttribute('id');
                          if (!id) return null;
                          const label = Array.from(document.querySelectorAll('label'))
                            .find(candidate => candidate.htmlFor === id);
                          return label?.innerText ?? null;
                        }
                        """
                );
                text = associatedLabel instanceof String
                        ? (String) associatedLabel
                        : text;
            }

            String role =
                    readRole(
                            candidate
                    );

            String ariaLabel =
                    candidate.getAttribute(
                            "aria-label"
                    );

            String placeholder =
                    candidate.getAttribute(
                            "placeholder"
                    );

            String inputType =
                    readInputType(
                            candidate,
                            tagName
                    );

            String domId =
                    candidate.getAttribute(
                            "id"
                    );

            String name =
                    candidate.getAttribute(
                            "name"
                    );

            String autocomplete =
                    candidate.getAttribute(
                            "autocomplete"
                    );

            String explicitPolicy =
                    candidate.getAttribute(
                            "data-ddd-policy"
                    );

            boolean visible =
                    candidate.isVisible();

            boolean enabled =
                    candidate.isEnabled();

            Object checkedValue = candidate.evaluate(
                    """
                    element => {
                      if (typeof element.checked === 'boolean') return element.checked;
                      const ariaChecked = element.getAttribute('aria-checked');
                      if (ariaChecked === 'true') return true;
                      if (ariaChecked === 'false') return false;
                      return null;
                    }
                    """);
            Boolean checked = checkedValue instanceof Boolean value
                    ? value : null;

            BoundingBox boundingBox =
                    candidate.boundingBox();

            Double x =
                    boundingBox == null
                            ? null
                            : boundingBox.x;

            Double y =
                    boundingBox == null
                            ? null
                            : boundingBox.y;

            Double width =
                    boundingBox == null
                            ? null
                            : boundingBox.width;

            Double height =
                    boundingBox == null
                            ? null
                            : boundingBox.height;

            elements.add(
                    new InteractiveElement(
                            index,
                            tagName,
                            text,
                            role,
                            ariaLabel,
                            placeholder,
                            inputType,
                            domId,
                            name,
                            autocomplete,
                            explicitPolicy,
                            visible,
                            enabled,
                            checked,
                            x,
                            y,
                            width,
                            height
                    )
            );
        }

        return List.copyOf(
                elements
        );
    }

    private String readTagName(
            Locator locator
    ) {
        Object value =
                locator.evaluate(
                        """
                        element =>
                            element
                                .tagName
                                .toLowerCase()
                        """
                );

        return value == null
                ? ""
                : value.toString();
    }

    private String readRole(
            Locator locator
    ) {
        Object value =
                locator.evaluate(
                        """
                        element => {
                            const explicitRole =
                                element.getAttribute('role');

                            if (explicitRole) {
                                return explicitRole;
                            }

                            const tag =
                                element.tagName.toLowerCase();

                            if (tag === 'button') {
                                return 'button';
                            }

                            if (tag === 'a'
                                && element.hasAttribute('href')) {
                                return 'link';
                            }

                            if (tag === 'textarea') {
                                return 'textbox';
                            }

                            if (tag === 'select') {
                                return element.multiple
                                    ? 'listbox'
                                    : 'combobox';
                            }

                            if (tag === 'input') {
                                const type =
                                    (
                                        element.getAttribute('type')
                                        || 'text'
                                    ).toLowerCase();

                                if (type === 'checkbox') {
                                    return 'checkbox';
                                }

                                if (type === 'radio') {
                                    return 'radio';
                                }

                                if (
                                    type === 'button'
                                    || type === 'submit'
                                    || type === 'reset'
                                ) {
                                    return 'button';
                                }

                                if (
                                    type === 'text'
                                    || type === 'email'
                                    || type === 'tel'
                                    || type === 'url'
                                    || type === 'search'
                                    || type === 'password'
                                    || type === 'number'
                                ) {
                                    return 'textbox';
                                }
                            }

                            if (
                                element.getAttribute(
                                    'contenteditable'
                                ) === 'true'
                            ) {
                                return 'textbox';
                            }

                            return null;
                        }
                        """
                );

        return value == null
                ? null
                : value.toString();
    }

    private String readInputType(
            Locator locator,
            String tagName
    ) {
        if (!"input".equals(
                tagName
        )) {
            return null;
        }

        String type =
                locator.getAttribute(
                        "type"
                );

        if (type == null
                || type.isBlank()) {

            return "text";
        }

        return type
                .trim()
                .toLowerCase();
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
