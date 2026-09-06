package com.ddd.backend.automation;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class BrowserActionValidatorTest {

    private final BrowserActionValidator validator =
            new BrowserActionValidator();

    @Test
    void selector가_있는_CLICK은_허용한다() {
        BrowserAction action =
                new BrowserAction(
                        BrowserActionType.CLICK,
                        "#btn-next",
                        null,
                        null,
                        null,
                        null
                );

        assertDoesNotThrow(
                () -> validator.validate(action)
        );
    }

    @Test
    void selector와_값이_있는_TYPE은_허용한다() {
        BrowserAction action =
                new BrowserAction(
                        BrowserActionType.TYPE,
                        "#input-name",
                        "홍길동",
                        null,
                        null,
                        null
                );

        assertDoesNotThrow(
                () -> validator.validate(action)
        );
    }

    @Test
    void 이동_거리가_있는_SCROLL은_허용한다() {
        BrowserAction action =
                new BrowserAction(
                        BrowserActionType.SCROLL,
                        null,
                        null,
                        0,
                        500,
                        null
                );

        assertDoesNotThrow(
                () -> validator.validate(action)
        );
    }

    @Test
    void 허용_범위의_WAIT은_허용한다() {
        BrowserAction action =
                new BrowserAction(
                        BrowserActionType.WAIT,
                        null,
                        null,
                        null,
                        null,
                        1_000
                );

        assertDoesNotThrow(
                () -> validator.validate(action)
        );
    }

    @Test
    void CLICK에_selector가_없으면_거부한다() {
        BrowserAction action =
                new BrowserAction(
                        BrowserActionType.CLICK,
                        null,
                        null,
                        null,
                        null,
                        null
                );

        assertThrows(
                IllegalArgumentException.class,
                () -> validator.validate(action)
        );
    }

    @Test
    void CLICK에_불필요한_value가_있으면_거부한다() {
        BrowserAction action =
                new BrowserAction(
                        BrowserActionType.CLICK,
                        "#btn-next",
                        "불필요한 값",
                        null,
                        null,
                        null
                );

        assertThrows(
                IllegalArgumentException.class,
                () -> validator.validate(action)
        );
    }

    @Test
    void Enter_키는_거부한다() {
        BrowserAction action =
                new BrowserAction(
                        BrowserActionType.PRESS_KEY,
                        null,
                        "Enter",
                        null,
                        null,
                        null
                );

        assertThrows(
                IllegalArgumentException.class,
                () -> validator.validate(action)
        );
    }

    @Test
    void WAIT이_최대시간을_초과하면_거부한다() {
        BrowserAction action =
                new BrowserAction(
                        BrowserActionType.WAIT,
                        null,
                        null,
                        null,
                        null,
                        10_001
                );

        assertThrows(
                IllegalArgumentException.class,
                () -> validator.validate(action)
        );
    }

    @Test
    void GO_BACK에_불필요한_데이터가_있으면_거부한다() {
        BrowserAction action =
                new BrowserAction(
                        BrowserActionType.GO_BACK,
                        "#unexpected",
                        null,
                        null,
                        null,
                        null
                );

        assertThrows(
                IllegalArgumentException.class,
                () -> validator.validate(action)
        );
    }
}
