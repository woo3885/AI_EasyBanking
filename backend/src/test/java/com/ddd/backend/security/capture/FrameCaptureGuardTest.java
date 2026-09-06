package com.ddd.backend.security.capture;

import com.ddd.backend.automation.session.BrowserSessionManager;
import com.microsoft.playwright.Frame;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class FrameCaptureGuardTest {

    private BrowserSessionManager browserSessionManager;
    private FrameCaptureGuard guard;

    @BeforeEach
    void setUp() {
        browserSessionManager =
                mock(
                        BrowserSessionManager.class
                );

        guard =
                new FrameCaptureGuard(
                        browserSessionManager
                );
    }

    @Test
    void 보안입력이_없으면_캡처를_허용한다() {
        Page page =
                mock(Page.class);

        Frame frame =
                mock(Frame.class);

        Locator candidates =
                mock(Locator.class);

        when(
                page.frames()
        ).thenReturn(
                List.of(frame)
        );

        when(
                frame.locator(
                        anyString()
                )
        ).thenReturn(
                candidates
        );

        when(
                candidates.count()
        ).thenReturn(
                0
        );

        FrameCaptureDecision result =
                guard.evaluatePage(
                        page
                );

        assertThat(
                result
        ).isEqualTo(
                FrameCaptureDecision.ALLOW
        );
    }

    @Test
    void 표시된_보안입력요소가_있으면_캡처를_차단한다() {
        Page page =
                mock(Page.class);

        Frame frame =
                mock(Frame.class);

        Locator candidates =
                mock(Locator.class);

        Locator secureElement =
                mock(Locator.class);

        when(
                page.frames()
        ).thenReturn(
                List.of(frame)
        );

        when(
                frame.locator(
                        anyString()
                )
        ).thenReturn(
                candidates
        );

        when(
                candidates.count()
        ).thenReturn(
                1
        );

        when(
                candidates.nth(0)
        ).thenReturn(
                secureElement
        );

        when(
                secureElement.isVisible()
        ).thenReturn(
                true
        );

        FrameCaptureDecision result =
                guard.evaluatePage(
                        page
                );

        assertThat(
                result
        ).isEqualTo(
                FrameCaptureDecision
                        .SECURE_INPUT_BLOCKED
        );
    }

    @Test
    void 숨겨진_보안입력요소만_있으면_캡처를_허용한다() {
        Page page =
                mock(Page.class);

        Frame frame =
                mock(Frame.class);

        Locator candidates =
                mock(Locator.class);

        Locator secureElement =
                mock(Locator.class);

        when(
                page.frames()
        ).thenReturn(
                List.of(frame)
        );

        when(
                frame.locator(
                        anyString()
                )
        ).thenReturn(
                candidates
        );

        when(
                candidates.count()
        ).thenReturn(
                1
        );

        when(
                candidates.nth(0)
        ).thenReturn(
                secureElement
        );

        when(
                secureElement.isVisible()
        ).thenReturn(
                false
        );

        FrameCaptureDecision result =
                guard.evaluatePage(
                        page
                );

        assertThat(
                result
        ).isEqualTo(
                FrameCaptureDecision.ALLOW
        );
    }

    @Test
    void iframe_내부에_보안입력이_있어도_캡처를_차단한다() {
        Page page =
                mock(Page.class);

        Frame mainFrame =
                mock(Frame.class);

        Frame secureFrame =
                mock(Frame.class);

        Locator normalCandidates =
                mock(Locator.class);

        Locator secureCandidates =
                mock(Locator.class);

        Locator secureElement =
                mock(Locator.class);

        when(
                page.frames()
        ).thenReturn(
                List.of(
                        mainFrame,
                        secureFrame
                )
        );

        when(
                mainFrame.locator(
                        anyString()
                )
        ).thenReturn(
                normalCandidates
        );

        when(
                normalCandidates.count()
        ).thenReturn(
                0
        );

        when(
                secureFrame.locator(
                        anyString()
                )
        ).thenReturn(
                secureCandidates
        );

        when(
                secureCandidates.count()
        ).thenReturn(
                1
        );

        when(
                secureCandidates.nth(0)
        ).thenReturn(
                secureElement
        );

        when(
                secureElement.isVisible()
        ).thenReturn(
                true
        );

        FrameCaptureDecision result =
                guard.evaluatePage(
                        page
                );

        assertThat(
                result
        ).isEqualTo(
                FrameCaptureDecision
                        .SECURE_INPUT_BLOCKED
        );
    }

    @Test
    void 보안검사중_오류가_발생하면_안전하게_캡처를_차단한다() {
        Page page =
                mock(Page.class);

        when(
                page.frames()
        ).thenThrow(
                new IllegalStateException(
                        "page changed"
                )
        );

        FrameCaptureDecision result =
                guard.evaluatePage(
                        page
                );

        assertThat(
                result
        ).isEqualTo(
                FrameCaptureDecision
                        .INSPECTION_FAILED_BLOCKED
        );
    }
}