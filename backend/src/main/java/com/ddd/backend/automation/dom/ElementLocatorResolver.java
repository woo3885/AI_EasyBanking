package com.ddd.backend.automation.dom;

import com.ddd.backend.automation.session.BrowserSessionManager;
import com.microsoft.playwright.Locator;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Objects;
import java.util.function.Function;

@Service
public final class ElementLocatorResolver {

    private static final Duration RESOLVE_TIMEOUT =
            Duration.ofSeconds(
                    10
            );

    private final BrowserSessionManager browserSessionManager;

    private final ElementRegistry elementRegistry;

    public ElementLocatorResolver(
            BrowserSessionManager browserSessionManager,
            ElementRegistry elementRegistry
    ) {
        this.browserSessionManager =
                Objects.requireNonNull(
                        browserSessionManager,
                        "BrowserSessionManager는 필수입니다."
                );

        this.elementRegistry =
                Objects.requireNonNull(
                        elementRegistry,
                        "ElementRegistry는 필수입니다."
                );
    }

    /*
     * Locator를 외부로 return하지 않는다.
     *
     * resolve → action 실행까지
     * 하나의 PlaywrightWorker 작업 안에서 수행한다.
     */
    public <T> T withLocator(
            String sessionId,
            String elementId,
            Function<Locator, T> task
    ) {
        validateText(
                sessionId,
                "sessionId"
        );

        validateText(
                elementId,
                "elementId"
        );

        Objects.requireNonNull(
                task,
                "Locator 작업은 필수입니다."
        );

        return browserSessionManager.execute(
                sessionId,
                RESOLVE_TIMEOUT,
                page -> {

                    Locator locator =
                            elementRegistry
                                    .resolveLocator(
                                            page,
                                            sessionId,
                                            elementId
                                    );

                    return task.apply(
                            locator
                    );
                }
        );
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