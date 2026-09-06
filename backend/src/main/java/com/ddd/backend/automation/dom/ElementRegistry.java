package com.ddd.backend.automation.dom;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Component
public final class ElementRegistry {

    private final DomSanitizer sanitizer;

    /*
     * sessionId별로 최신 Snapshot 하나만 유지한다.
     *
     * 새 Snapshot이 생성되면 이전 Snapshot은
     * 자동으로 교체된다.
     */
    private final ConcurrentMap<String, SnapshotRegistration>
            snapshots =
            new ConcurrentHashMap<>();

    public ElementRegistry(
            DomSanitizer sanitizer
    ) {
        this.sanitizer =
                Objects.requireNonNull(
                        sanitizer,
                        "DomSanitizer는 필수입니다."
                );
    }

    public void replaceSnapshot(
            String sessionId,
            String snapshotId,
            String pageUrl,
            List<ElementRegistration> elements
    ) {
        validateText(
                sessionId,
                "sessionId"
        );

        validateText(
                snapshotId,
                "snapshotId"
        );

        Objects.requireNonNull(
                pageUrl,
                "pageUrl은 필수입니다."
        );

        Objects.requireNonNull(
                elements,
                "elements는 필수입니다."
        );

        String elementIdPrefix =
                elementIdPrefix(
                        snapshotId
                );

        Map<String, ElementRegistration>
                registrationMap =
                new LinkedHashMap<>();

        for (ElementRegistration element :
                elements) {

            Objects.requireNonNull(
                    element,
                    "ElementRegistration은 필수입니다."
            );

            if (!element.elementId()
                    .startsWith(
                            elementIdPrefix
                    )) {

                throw new IllegalArgumentException(
                        "elementId와 snapshotId가 일치하지 않습니다."
                );
            }

            ElementRegistration previous =
                    registrationMap.putIfAbsent(
                            element.elementId(),
                            element
                    );

            if (previous != null) {
                throw new IllegalArgumentException(
                        "중복 elementId를 등록할 수 없습니다."
                );
            }
        }

        SnapshotRegistration snapshot =
                new SnapshotRegistration(
                        snapshotId,
                        pageUrl,
                        Map.copyOf(
                                registrationMap
                        )
                );

        /*
         * 같은 Session은 최신 Snapshot만 유지.
         *
         * 따라서 이전 snapshot의 elementId는
         * 자동으로 stale 처리된다.
         */
        snapshots.put(
                sessionId,
                snapshot
        );
    }

    /*
     * 중요:
     *
     * Locator 자체는 Registry에 저장하지 않는다.
     *
     * elementId를 받아 현재 Page의 DOM을 다시 검사하고,
     * Snapshot 당시 fingerprint와 동일한 Element를
     * 새 Locator로 재탐색한다.
     *
     * 이 메서드는 반드시 PlaywrightWorker 안에서
     * 호출되어야 한다.
     */
    public Locator resolveLocator(
            Page page,
            String sessionId,
            String elementId
    ) {
        Objects.requireNonNull(
                page,
                "Page는 필수입니다."
        );

        validateText(
                sessionId,
                "sessionId"
        );

        validateText(
                elementId,
                "elementId"
        );

        SnapshotRegistration snapshot =
                snapshots.get(
                        sessionId
                );

        if (snapshot == null) {
            throw new IllegalStateException(
                    "해당 세션의 Element Registry가 없습니다."
            );
        }

        /*
         * Snapshot 이후 navigation이 발생했다면
         * 예전 elementId 사용 금지.
         */
        if (!Objects.equals(
                snapshot.pageUrl(),
                page.url()
        )) {

            throw new IllegalStateException(
                    "Snapshot 생성 후 페이지가 변경되었습니다."
            );
        }

        String expectedPrefix =
                elementIdPrefix(
                        snapshot.snapshotId()
                );

        /*
         * 다른 Snapshot의 ID.
         */
        if (!elementId.startsWith(
                expectedPrefix
        )) {

            throw new IllegalStateException(
                    "현재 Snapshot에 속하지 않는 오래된 elementId입니다."
            );
        }

        ElementRegistration expected =
                snapshot.elements()
                        .get(
                                elementId
                        );

        /*
         * 같은 Snapshot 형식처럼 위조했지만
         * 실제 Registry에는 없는 ID.
         */
        if (expected == null) {
            throw new IllegalStateException(
                    "등록되지 않은 elementId입니다."
            );
        }

        Locator candidates =
                page.locator(
                        InteractiveElementExtractor
                                .INTERACTIVE_SELECTOR
                );

        int count =
                candidates.count();

        int matchedIndex =
                -1;

        int matchCount =
                0;

        for (int index = 0;
             index < count;
             index++) {

            Locator candidate =
                    candidates.nth(
                            index
                    );

            /*
             * 현재 보이지 않는 대상은
             * 실행 대상으로 인정하지 않는다.
             */
            if (!candidate.isVisible()) {
                continue;
            }

            CurrentElement current =
                    inspect(
                            candidate
                    );

            if (matches(
                    expected,
                    current
            )) {

                matchedIndex =
                        index;

                matchCount++;
            }
        }

        if (matchCount == 0) {
            throw new IllegalStateException(
                    "현재 DOM에서 elementId 대상 요소를 다시 찾을 수 없습니다."
            );
        }

        /*
         * 하나의 elementId가 여러 요소에 대응하면
         * 임의로 첫 번째를 선택하면 안 된다.
         */
        if (matchCount > 1) {
            throw new IllegalStateException(
                    "현재 DOM에서 elementId 대상이 여러 개 발견되었습니다."
            );
        }

        return candidates.nth(
                matchedIndex
        );
    }

    public boolean containsSession(
            String sessionId
    ) {
        if (sessionId == null
                || sessionId.isBlank()) {

            return false;
        }

        return snapshots.containsKey(
                sessionId
        );
    }

    public void removeSession(
            String sessionId
    ) {
        if (sessionId == null
                || sessionId.isBlank()) {

            return;
        }

        snapshots.remove(
                sessionId
        );
    }

    private CurrentElement inspect(
            Locator locator
    ) {
        String tag =
                readTagName(
                        locator
                );

        String role =
                readRole(
                        locator
                );

        String text =
                sanitizer.sanitizeText(
                        locator.textContent()
                );

        String ariaLabel =
                sanitizer.sanitizeNullableText(
                        locator.getAttribute(
                                "aria-label"
                        )
                );

        String placeholder =
                sanitizer.sanitizeNullableText(
                        locator.getAttribute(
                                "placeholder"
                        )
                );

        String inputType =
                readInputType(
                        locator,
                        tag
                );

        String domId =
                normalizeNullable(
                        locator.getAttribute(
                                "id"
                        )
                );

        String name =
                normalizeNullable(
                        locator.getAttribute(
                                "name"
                        )
                );

        String autocomplete =
                normalizeNullableLowercase(
                        locator.getAttribute(
                                "autocomplete"
                        )
                );

        String explicitPolicy =
                normalizeNullableLowercase(
                        locator.getAttribute(
                                "data-ddd-policy"
                        )
                );

        return new CurrentElement(
                tag,
                text,
                role,
                ariaLabel,
                placeholder,
                inputType,
                domId,
                name,
                autocomplete,
                explicitPolicy
        );
    }

    /*
     * Snapshot 당시 의미와 현재 의미가
     * 전부 동일해야 같은 Element로 인정한다.
     *
     * 특히 text / aria / autocomplete /
     * data-ddd-policy까지 비교하므로,
     * 같은 DOM id를 재사용한 전혀 다른 버튼을
     * 잘못 실행하는 것을 막는다.
     */
    private boolean matches(
            ElementRegistration expected,
            CurrentElement current
    ) {
        if (!Objects.equals(
                expected.tag(),
                current.tag()
        )) {
            return false;
        }

        if (!Objects.equals(
                expected.text(),
                current.text()
        )) {
            return false;
        }

        if (!Objects.equals(
                expected.role(),
                current.role()
        )) {
            return false;
        }

        if (!Objects.equals(
                expected.ariaLabel(),
                current.ariaLabel()
        )) {
            return false;
        }

        if (!Objects.equals(
                expected.placeholder(),
                current.placeholder()
        )) {
            return false;
        }

        if (!Objects.equals(
                expected.inputType(),
                current.inputType()
        )) {
            return false;
        }

        /*
         * 보안 관련 속성은 null → 값 있음 변경도
         * 다른 Element 상태로 간주한다.
         */
        if (!Objects.equals(
                expected.autocomplete(),
                current.autocomplete()
        )) {
            return false;
        }

        if (!Objects.equals(
                expected.explicitPolicy(),
                current.explicitPolicy()
        )) {
            return false;
        }

        /*
         * Snapshot 당시 id/name이 존재했다면
         * 현재도 반드시 같아야 한다.
         */
        if (expected.domId() != null
                && !Objects.equals(
                expected.domId(),
                current.domId()
        )) {

            return false;
        }

        if (expected.name() != null
                && !Objects.equals(
                expected.name(),
                current.name()
        )) {

            return false;
        }

        return true;
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

    /*
     * D14 InteractiveElementExtractor와
     * 같은 Semantic Role 계산 규칙을 사용한다.
     */
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

                            if (
                                tag === 'a'
                                && element.hasAttribute('href')
                            ) {
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
            String tag
    ) {
        if (!"input".equals(
                tag
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

    private String elementIdPrefix(
            String snapshotId
    ) {
        if (!snapshotId.startsWith(
                "snap-"
        )) {

            throw new IllegalArgumentException(
                    "올바르지 않은 snapshotId입니다."
            );
        }

        String token =
                snapshotId.substring(
                        "snap-".length()
                );

        if (token.isBlank()) {
            throw new IllegalArgumentException(
                    "올바르지 않은 snapshotId입니다."
            );
        }

        return "el-"
                + token
                + "-";
    }

    private String normalizeNullable(
            String value
    ) {
        if (value == null
                || value.isBlank()) {

            return null;
        }

        return value.trim();
    }

    private String normalizeNullableLowercase(
            String value
    ) {
        String normalized =
                normalizeNullable(
                        value
                );

        if (normalized == null) {
            return null;
        }

        return normalized.toLowerCase();
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

    public record ElementRegistration(
            String elementId,
            String tag,
            String text,
            String role,
            String ariaLabel,
            String placeholder,
            String inputType,
            String domId,
            String name,
            String autocomplete,
            String explicitPolicy
    ) {

        public ElementRegistration {
            if (elementId == null
                    || elementId.isBlank()) {

                throw new IllegalArgumentException(
                        "elementId는 필수입니다."
                );
            }

            if (tag == null
                    || tag.isBlank()) {

                throw new IllegalArgumentException(
                        "tag는 필수입니다."
                );
            }
        }
    }

    private record SnapshotRegistration(
            String snapshotId,
            String pageUrl,
            Map<String, ElementRegistration> elements
    ) {
    }

    private record CurrentElement(
            String tag,
            String text,
            String role,
            String ariaLabel,
            String placeholder,
            String inputType,
            String domId,
            String name,
            String autocomplete,
            String explicitPolicy
    ) {
    }
}