package com.ddd.backend.automation;

import com.ddd.backend.automation.dom.ElementLocatorResolver;
import com.microsoft.playwright.Locator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ElementIdBrowserActionExecutorTest {

    private static final String SESSION_ID =
            "session-public-action-test";

    private static final String ELEMENT_ID =
            "el-a1b2c3d4-001";

    private ElementLocatorResolver
            elementLocatorResolver;

    private BrowserActionPolicyContextResolver
            policyContextResolver;

    private Locator locator;

    private ElementIdBrowserActionExecutor executor;

    @BeforeEach
    void setUp() {
        elementLocatorResolver =
                mock(
                        ElementLocatorResolver.class
                );

        policyContextResolver =
                mock(
                        BrowserActionPolicyContextResolver.class
                );

        locator =
                mock(
                        Locator.class
                );

        executor =
                new ElementIdBrowserActionExecutor(
                        elementLocatorResolver,
                        policyContextResolver
                );

        when(
                locator.isVisible()
        ).thenReturn(
                true
        );

        when(
                locator.isEnabled()
        ).thenReturn(
                true
        );

        /*
         * ElementLocatorResolver가 실제 Worker 내부에서
         * Locator를 callback에 전달하는 동작을
         * 단위 테스트에서 모사한다.
         */
        when(
                elementLocatorResolver
                        .withLocator(
                                eq(SESSION_ID),
                                eq(ELEMENT_ID),
                                any()
                        )
        ).thenAnswer(
                invocation -> {

                    @SuppressWarnings(
                            "unchecked"
                    )
                    Function<
                            Locator,
                            BrowserActionExecutionResult
                            > task =
                            invocation.getArgument(
                                    2
                            );

                    return task.apply(
                            locator
                    );
                }
        );
    }

    @Test
    void NORMAL_요소는_CLICK을_실행한다() {
        mockPolicy(
                BrowserActionPolicyContext
                        .normal()
        );

        BrowserActionExecutionResult result =
                executor.executeClick(
                        SESSION_ID,
                        ELEMENT_ID
                );

        assertThat(
                result.status()
        ).isEqualTo(
                BrowserActionExecutionStatus.EXECUTED
        );

        verify(
                locator
        ).click();
    }

    @Test
    void USER_CHOICE는_사용자가_직접_누른_CLICK이므로_실행한다() {
        mockPolicy(
                BrowserActionPolicyContext
                        .forUserChoice()
        );

        BrowserActionExecutionResult result =
                executor.executeClick(
                        SESSION_ID,
                        ELEMENT_ID
                );

        assertThat(
                result.status()
        ).isEqualTo(
                BrowserActionExecutionStatus.EXECUTED
        );

        verify(
                locator
        ).click();
    }

    @Test
    void SECURE_INPUT_대상은_CLICK하지_않는다() {
        mockPolicy(
                BrowserActionPolicyContext
                        .forSensitiveInput()
        );

        BrowserActionExecutionResult result =
                executor.executeClick(
                        SESSION_ID,
                        ELEMENT_ID
                );

        assertThat(
                result.status()
        ).isEqualTo(
                BrowserActionExecutionStatus
                        .SECURE_INPUT_REQUIRED
        );

        verify(
                locator,
                never()
        ).click();
    }

    @Test
    void FINAL_CONFIRMATION_대상은_CLICK하지_않는다() {
        mockPolicy(
                BrowserActionPolicyContext
                        .forFinalExecution()
        );

        BrowserActionExecutionResult result =
                executor.executeClick(
                        SESSION_ID,
                        ELEMENT_ID
                );

        assertThat(
                result.status()
        ).isEqualTo(
                BrowserActionExecutionStatus
                        .FINAL_CONFIRMATION_REQUIRED
        );

        verify(
                locator,
                never()
        ).click();
    }

    @Test
    void BLOCKED_대상은_CLICK하지_않는다() {
        mockPolicy(
                BrowserActionPolicyContext
                        .forBlockedTarget()
        );

        BrowserActionExecutionResult result =
                executor.executeClick(
                        SESSION_ID,
                        ELEMENT_ID
                );

        assertThat(
                result.status()
        ).isEqualTo(
                BrowserActionExecutionStatus.BLOCKED
        );

        verify(
                locator,
                never()
        ).click();
    }

    @Test
    void 비활성화된_요소는_CLICK하지_않는다() {
        when(
                locator.isEnabled()
        ).thenReturn(
                false
        );

        BrowserActionExecutionResult result =
                executor.executeClick(
                        SESSION_ID,
                        ELEMENT_ID
                );

        assertThat(
                result.status()
        ).isEqualTo(
                BrowserActionExecutionStatus.BLOCKED
        );

        verify(
                locator,
                never()
        ).click();
    }

    private void mockPolicy(
            BrowserActionPolicyContext context
    ) {
        when(
                policyContextResolver
                        .resolveMetadata(
                                any(),
                                any(),
                                any(),
                                any(),
                                any(),
                                any(),
                                any(),
                                eq(
                                        BrowserActionType.CLICK
                                )
                        )
        ).thenReturn(
                context
        );
    }
}