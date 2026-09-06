package com.ddd.backend.security.capture;

import com.ddd.backend.automation.session.BrowserSessionManager;
import com.microsoft.playwright.Page;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verifyNoInteractions;

class BrowserFrameCaptureServiceTest {

    private BrowserSessionManager browserSessionManager;
    private FrameCaptureGuard frameCaptureGuard;
    private BrowserFrameCaptureService service;

    @BeforeEach
    void setUp() {
        browserSessionManager =
                mock(
                        BrowserSessionManager.class
                );

        frameCaptureGuard =
                mock(
                        FrameCaptureGuard.class
                );

        service =
                new BrowserFrameCaptureService(
                        browserSessionManager,
                        frameCaptureGuard
                );
    }

    @Test
    void secure_latch_중에는_BrowserSession과_screenshot에_접근하지_않는다() {
        var registry = new com.ddd.backend.security.secureinput.SecureInputRegistry();
        registry.activate("session-001",
                com.ddd.backend.security.secureinput.SecureInputType.ACCOUNT_PASSWORD,
                "frm-001", 1L, "https://demo/secure");
        service.setSecureInputRegistry(registry);

        FrameCaptureAttempt result = service.capture("session-001");

        assertThat(result.decision()).isEqualTo(FrameCaptureDecision.SECURE_INPUT_BLOCKED);
        verifyNoInteractions(browserSessionManager);
    }

    @Test
    void 허용된_페이지를_1280x720_PNG로_캡처한다()
            throws IOException {

        Page page =
                mock(
                        Page.class
                );

        byte[] png =
                createPng(
                        1280,
                        720
                );

        when(
                frameCaptureGuard.evaluatePage(
                        page
                )
        ).thenReturn(
                FrameCaptureDecision.ALLOW
        );

        when(
                page.screenshot(
                        any(
                                Page.ScreenshotOptions.class
                        )
                )
        ).thenReturn(
                png
        );

        FrameCaptureAttempt result =
                service.capturePage(
                        page
                );

        assertThat(
                result.captured()
        ).isTrue();

        assertThat(
                result.decision()
        ).isEqualTo(
                FrameCaptureDecision.ALLOW
        );

        assertThat(
                result.frame()
        ).isNotNull();

        assertThat(
                result.frame().width()
        ).isEqualTo(
                1280
        );

        assertThat(
                result.frame().height()
        ).isEqualTo(
                720
        );

        assertThat(
                result.frame().mimeType()
        ).isEqualTo(
                "image/png"
        );

        assertThat(
                result.frame().byteLength()
        ).isEqualTo(
                png.length
        );

        verify(
                page
        ).screenshot(
                any(
                        Page.ScreenshotOptions.class
                )
        );
    }

    @Test
    void secure_input_화면이면_screenshot을_호출하지_않는다() {
        Page page =
                mock(
                        Page.class
                );

        when(
                frameCaptureGuard.evaluatePage(
                        page
                )
        ).thenReturn(
                FrameCaptureDecision
                        .SECURE_INPUT_BLOCKED
        );

        FrameCaptureAttempt result =
                service.capturePage(
                        page
                );

        assertThat(
                result.captured()
        ).isFalse();

        assertThat(
                result.decision()
        ).isEqualTo(
                FrameCaptureDecision
                        .SECURE_INPUT_BLOCKED
        );

        assertThat(
                result.frame()
        ).isNull();

        verify(
                page,
                never()
        ).screenshot(
                any(
                        Page.ScreenshotOptions.class
                )
        );
    }

    @Test
    void 보안검사_실패상태에서도_screenshot을_호출하지_않는다() {
        Page page =
                mock(
                        Page.class
                );

        when(
                frameCaptureGuard.evaluatePage(
                        page
                )
        ).thenReturn(
                FrameCaptureDecision
                        .INSPECTION_FAILED_BLOCKED
        );

        FrameCaptureAttempt result =
                service.capturePage(
                        page
                );

        assertThat(
                result.captured()
        ).isFalse();

        assertThat(
                result.decision()
        ).isEqualTo(
                FrameCaptureDecision
                        .INSPECTION_FAILED_BLOCKED
        );

        verify(
                page,
                never()
        ).screenshot(
                any(
                        Page.ScreenshotOptions.class
                )
        );
    }

    @Test
    void PNG가_1280x720이_아니면_거부한다()
            throws IOException {

        Page page =
                mock(
                        Page.class
                );

        byte[] wrongSizePng =
                createPng(
                        800,
                        600
                );

        when(
                frameCaptureGuard.evaluatePage(
                        page
                )
        ).thenReturn(
                FrameCaptureDecision.ALLOW
        );

        when(
                page.screenshot(
                        any(
                                Page.ScreenshotOptions.class
                        )
                )
        ).thenReturn(
                wrongSizePng
        );

        assertThatThrownBy(
                () -> service.capturePage(
                        page
                )
        )
                .isInstanceOf(
                        IllegalStateException.class
                )
                .hasMessageContaining(
                        "1280x720"
                );
    }

    @Test
    void 빈_screenshot_결과를_거부한다() {
        Page page =
                mock(
                        Page.class
                );

        when(
                frameCaptureGuard.evaluatePage(
                        page
                )
        ).thenReturn(
                FrameCaptureDecision.ALLOW
        );

        when(
                page.screenshot(
                        any(
                                Page.ScreenshotOptions.class
                        )
                )
        ).thenReturn(
                new byte[0]
        );

        assertThatThrownBy(
                () -> service.capturePage(
                        page
                )
        )
                .isInstanceOf(
                        IllegalStateException.class
                )
                .hasMessageContaining(
                        "비어"
                );
    }

    private byte[] createPng(
            int width,
            int height
    ) throws IOException {

        BufferedImage image =
                new BufferedImage(
                        width,
                        height,
                        BufferedImage.TYPE_INT_RGB
                );

        try (
                ByteArrayOutputStream outputStream =
                        new ByteArrayOutputStream()
        ) {
            ImageIO.write(
                    image,
                    "png",
                    outputStream
            );

            return outputStream.toByteArray();
        }
    }
}
