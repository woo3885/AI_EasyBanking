package com.ddd.backend.automation;

import org.springframework.stereotype.Component;

import java.util.Set;

@Component
public final class BrowserActionValidator {

    private static final int MAX_WAIT_MILLIS =
            10_000;

    private static final int MAX_SCROLL_DISTANCE =
            5_000;

    private static final Set<String> ALLOWED_KEYS =
            Set.of(
                    "Tab",
                    "Escape",
                    "ArrowUp",
                    "ArrowDown",
                    "ArrowLeft",
                    "ArrowRight",
                    "PageUp",
                    "PageDown",
                    "Home",
                    "End",
                    "Backspace",
                    "Delete"
            );

    public void validate(
            BrowserAction action
    ) {
        if (action == null) {
            throw new IllegalArgumentException(
                    "브라우저 행동 명령은 필수입니다."
            );
        }

        switch (action.type()) {
            case CLICK ->
                    validateClick(action);

            case TYPE ->
                    validateType(action);

            case SELECT ->
                    validateSelect(action);

            case SCROLL ->
                    validateScroll(action);

            case PRESS_KEY ->
                    validatePressKey(action);

            case WAIT ->
                    validateWait(action);

            case GO_BACK,
                 REFRESH,
                 NONE,
                 WAIT_FOR_USER,
                 PAUSE_FOR_SECURE_INPUT,
                 REQUEST_FINAL_CONFIRMATION,
                 STOP ->
                    validateEmptyPayload(action);
        }
    }

    private void validateClick(
            BrowserAction action
    ) {
        requireSelector(action);
        requireNoValue(action);
        requireNoScroll(action);
        requireNoWait(action);
    }

    private void validateType(
            BrowserAction action
    ) {
        requireSelector(action);
        requireValue(action);
        requireNoScroll(action);
        requireNoWait(action);
    }

    private void validateSelect(
            BrowserAction action
    ) {
        requireSelector(action);
        requireValue(action);
        requireNoScroll(action);
        requireNoWait(action);
    }

    private void validateScroll(
            BrowserAction action
    ) {
        requireNoSelector(action);
        requireNoValue(action);
        requireNoWait(action);

        int scrollX =
                action.scrollX() == null
                        ? 0
                        : action.scrollX();

        int scrollY =
                action.scrollY() == null
                        ? 0
                        : action.scrollY();

        if (scrollX == 0 && scrollY == 0) {
            throw new IllegalArgumentException(
                    "SCROLL 행동에는 이동 거리가 필요합니다."
            );
        }

        if (Math.abs(scrollX) > MAX_SCROLL_DISTANCE
                || Math.abs(scrollY) > MAX_SCROLL_DISTANCE) {

            throw new IllegalArgumentException(
                    "한 번의 스크롤 거리는 "
                            + MAX_SCROLL_DISTANCE
                            + "픽셀을 초과할 수 없습니다."
            );
        }
    }

    private void validatePressKey(
            BrowserAction action
    ) {
        requireNoSelector(action);
        requireValue(action);
        requireNoScroll(action);
        requireNoWait(action);

        if (!ALLOWED_KEYS.contains(action.value())) {
            throw new IllegalArgumentException(
                    "허용되지 않은 키 입력입니다."
            );
        }
    }

    private void validateWait(
            BrowserAction action
    ) {
        requireNoSelector(action);
        requireNoValue(action);
        requireNoScroll(action);

        Integer waitMillis =
                action.waitMillis();

        if (waitMillis == null
                || waitMillis <= 0
                || waitMillis > MAX_WAIT_MILLIS) {

            throw new IllegalArgumentException(
                    "WAIT 시간은 1~"
                            + MAX_WAIT_MILLIS
                            + "ms 범위여야 합니다."
            );
        }
    }

    private void validateEmptyPayload(
            BrowserAction action
    ) {
        requireNoSelector(action);
        requireNoValue(action);
        requireNoScroll(action);
        requireNoWait(action);
    }

    private void requireSelector(
            BrowserAction action
    ) {
        if (action.selector() == null
                || action.selector().isBlank()) {

            throw new IllegalArgumentException(
                    action.type()
                            + " 행동에는 selector가 필요합니다."
            );
        }
    }

    private void requireValue(
            BrowserAction action
    ) {
        if (action.value() == null
                || action.value().isBlank()) {

            throw new IllegalArgumentException(
                    action.type()
                            + " 행동에는 value가 필요합니다."
            );
        }
    }

    private void requireNoSelector(
            BrowserAction action
    ) {
        if (action.selector() != null
                && !action.selector().isBlank()) {

            throw new IllegalArgumentException(
                    action.type()
                            + " 행동에는 selector를 사용할 수 없습니다."
            );
        }
    }

    private void requireNoValue(
            BrowserAction action
    ) {
        if (action.value() != null
                && !action.value().isBlank()) {

            throw new IllegalArgumentException(
                    action.type()
                            + " 행동에는 value를 사용할 수 없습니다."
            );
        }
    }

    private void requireNoScroll(
            BrowserAction action
    ) {
        if (action.scrollX() != null
                || action.scrollY() != null) {

            throw new IllegalArgumentException(
                    action.type()
                            + " 행동에는 스크롤 값을 사용할 수 없습니다."
            );
        }
    }

    private void requireNoWait(
            BrowserAction action
    ) {
        if (action.waitMillis() != null) {
            throw new IllegalArgumentException(
                    action.type()
                            + " 행동에는 대기 시간을 사용할 수 없습니다."
            );
        }
    }
}
