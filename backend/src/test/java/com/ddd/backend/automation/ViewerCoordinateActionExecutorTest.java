package com.ddd.backend.automation;

import com.ddd.backend.automation.session.BrowserSessionManager;
import com.microsoft.playwright.Mouse;
import com.microsoft.playwright.Page;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ViewerCoordinateActionExecutorTest {

    private BrowserSessionManager
            browserSessionManager;

    private BrowserActionPolicyContextResolver
            policyResolver;

    private ViewerCoordinateActionExecutor
            executor;

    private Page page;

    private Mouse mouse;

    @BeforeEach
    void setUp() {
        browserSessionManager =
                mock(
                        BrowserSessionManager.class
                );

        policyResolver =
                mock(
                        BrowserActionPolicyContextResolver.class
                );

        executor =
                new ViewerCoordinateActionExecutor(
                        browserSessionManager,
                        policyResolver
                );

        page =
                mock(
                        Page.class
                );

        mouse =
                mock(
                        Mouse.class
                );

        when(
                page.mouse()
        ).thenReturn(
                mouse
        );

        when(
                policyResolver.resolveMetadata(
                        any(),
                        any(),
                        any(),
                        any(),
                        any(),
                        any(),
                        any(),
                        any()
                )
        ).thenReturn(
                BrowserActionPolicyContext.normal()
        );
    }

    @Test
    void 정상_좌표_CLICK을_실행한다() {
        when(
                page.evaluate(
                        any(),
                        any()
                )
        ).thenReturn(
                normalTarget(
                        false
                )
        );

        BrowserActionExecutionResult result =
                executor.executeClickOnPage(
                        page,
                        320,
                        240
                );

        assertThat(
                result.status()
        ).isEqualTo(
                BrowserActionExecutionStatus.EXECUTED
        );

        verify(
                mouse
        ).move(
                320,
                240
        );

        verify(
                mouse
        ).click(
                320,
                240
        );
    }

    @Test
    void disabled_Target은_CLICK하지_않는다() {
        when(
                page.evaluate(
                        any(),
                        any()
                )
        ).thenReturn(
                Map.of(
                        "found", true,
                        "visible", true,
                        "enabled", false,
                        "embeddedFrame", false,
                        "scrollable", false,
                        "text", "disabled button"
                )
        );

        BrowserActionExecutionResult result =
                executor.executeClickOnPage(
                        page,
                        100,
                        100
                );

        assertThat(
                result.status()
        ).isEqualTo(
                BrowserActionExecutionStatus.BLOCKED
        );

        verify(
                mouse,
                never()
        ).click(
                any(
                        Double.class
                ),
                any(
                        Double.class
                )
        );
    }

    @Test
    void secure_input_Target은_CLICK하지_않는다() {
        when(
                page.evaluate(
                        any(),
                        any()
                )
        ).thenReturn(
                Map.of(
                        "found", true,
                        "visible", true,
                        "enabled", true,
                        "embeddedFrame", false,
                        "scrollable", false,
                        "explicitPolicy", "secure-input",
                        "text", "비밀번호"
                )
        );

        when(
                policyResolver.resolveMetadata(
                        any(),
                        any(),
                        any(),
                        any(),
                        any(),
                        any(),
                        any(),
                        any()
                )
        ).thenReturn(
                BrowserActionPolicyContext
                        .forSensitiveInput()
        );

        BrowserActionExecutionResult result =
                executor.executeClickOnPage(
                        page,
                        200,
                        200
                );

        assertThat(
                result.status()
        ).isEqualTo(
                BrowserActionExecutionStatus
                        .SECURE_INPUT_REQUIRED
        );

        verify(
                mouse,
                never()
        ).click(
                200,
                200
        );
    }

    @Test
    void final_confirmation_Target은_CLICK하지_않는다() {
        when(
                page.evaluate(
                        any(),
                        any()
                )
        ).thenReturn(
                normalTarget(
                        false
                )
        );

        when(
                policyResolver.resolveMetadata(
                        any(),
                        any(),
                        any(),
                        any(),
                        any(),
                        any(),
                        any(),
                        any()
                )
        ).thenReturn(
                BrowserActionPolicyContext
                        .forFinalExecution()
        );

        BrowserActionExecutionResult result =
                executor.executeClickOnPage(
                        page,
                        250,
                        250
                );

        assertThat(
                result.status()
        ).isEqualTo(
                BrowserActionExecutionStatus
                        .FINAL_CONFIRMATION_REQUIRED
        );

        verify(
                mouse,
                never()
        ).click(
                250,
                250
        );
    }

    @Test
    void iframe_Target은_실행하지_않는다() {
        when(
                page.evaluate(
                        any(),
                        any()
                )
        ).thenReturn(
                Map.of(
                        "found", true,
                        "visible", true,
                        "enabled", true,
                        "embeddedFrame", true,
                        "scrollable", true,
                        "text", "iframe"
                )
        );

        BrowserActionExecutionResult result =
                executor.executeClickOnPage(
                        page,
                        300,
                        300
                );

        assertThat(
                result.status()
        ).isEqualTo(
                BrowserActionExecutionStatus.BLOCKED
        );

        verify(
                mouse,
                never()
        ).click(
                300,
                300
        );
    }

    @Test
    void 정상_세로_SCROLL을_실행한다() {
        when(
                page.evaluate(
                        any(),
                        any()
                )
        ).thenReturn(
                normalTarget(
                        true
                )
        );

        BrowserActionExecutionResult result =
                executor.executeScrollOnPage(
                        page,
                        320,
                        240,
                        0,
                        480
                );

        assertThat(
                result.status()
        ).isEqualTo(
                BrowserActionExecutionStatus.EXECUTED
        );

        verify(
                mouse
        ).move(
                320,
                240
        );

        verify(
                mouse
        ).wheel(
                0,
                480
        );
    }

    @Test
    void 정상_가로_SCROLL을_실행한다() {
        when(
                page.evaluate(
                        any(),
                        any()
                )
        ).thenReturn(
                normalTarget(
                        true
                )
        );

        BrowserActionExecutionResult result =
                executor.executeScrollOnPage(
                        page,
                        400,
                        300,
                        500,
                        0
                );

        assertThat(
                result.status()
        ).isEqualTo(
                BrowserActionExecutionStatus.EXECUTED
        );

        verify(
                mouse
        ).wheel(
                500,
                0
        );
    }

    @Test
    void scroll가능영역이_아니면_SCROLL하지_않는다() {
        when(
                page.evaluate(
                        any(),
                        any()
                )
        ).thenReturn(
                normalTarget(
                        false
                )
        );

        BrowserActionExecutionResult result =
                executor.executeScrollOnPage(
                        page,
                        400,
                        300,
                        0,
                        500
                );

        assertThat(
                result.status()
        ).isEqualTo(
                BrowserActionExecutionStatus.BLOCKED
        );

        verify(
                mouse,
                never()
        ).wheel(
                0,
                500
        );
    }

    private Map<String, Object> normalTarget(
            boolean scrollable
    ) {
        return Map.of(
                "found", true,
                "visible", true,
                "enabled", true,
                "embeddedFrame", false,
                "scrollable", scrollable,
                "text", "normal target"
        );
    }
}