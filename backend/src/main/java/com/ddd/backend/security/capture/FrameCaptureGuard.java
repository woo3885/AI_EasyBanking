package com.ddd.backend.security.capture;

import com.ddd.backend.automation.session.BrowserSessionManager;
import com.microsoft.playwright.Frame;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Objects;

@Component
public class FrameCaptureGuard {

    private static final Duration INSPECTION_TIMEOUT =
            Duration.ofSeconds(3);

    /*
     * 화면 캡처를 중단해야 하는 보안 입력 요소.
     *
     * 1. 프로젝트 명시 정책
     * 2. 비밀번호 입력
     * 3. OTP / 인증번호 입력
     */
    static final String SECURE_INPUT_SELECTOR =
            """
            [data-ddd-policy="secure-input"],
            input[type="password" i],
            [autocomplete~="one-time-code"]
            """;

    private final BrowserSessionManager browserSessionManager;

    public FrameCaptureGuard(
            BrowserSessionManager browserSessionManager
    ) {
        this.browserSessionManager =
                Objects.requireNonNull(
                        browserSessionManager,
                        "BrowserSessionManager는 필수입니다."
                );
    }

    /*
     * 이 메서드만 D17 FrameCapture 쪽에서 호출한다.
     *
     * BrowserSessionManager.execute()를 통하기 때문에
     * Playwright 객체는 기존 전용 Worker 스레드에서
     * 접근하게 된다.
     */
    public FrameCaptureDecision evaluate(
            String sessionId
    ) {
        if (sessionId == null
                || sessionId.isBlank()) {

            throw new IllegalArgumentException(
                    "세션 ID는 비어 있을 수 없습니다."
            );
        }

        return browserSessionManager.execute(
                sessionId,
                INSPECTION_TIMEOUT,
                this::evaluatePage
        );
    }

    /*
     * 테스트 가능하도록 package-private로 둔다.
     */
    FrameCaptureDecision evaluatePage(
            Page page
    ) {
        Objects.requireNonNull(
                page,
                "Page는 필수입니다."
        );

        try {
            /*
             * 메인 문서뿐 아니라 iframe 내부도 검사한다.
             */
            for (Frame frame : page.frames()) {

                if (containsVisibleSecureInput(
                        frame
                )) {
                    return FrameCaptureDecision
                            .SECURE_INPUT_BLOCKED;
                }
            }

            return FrameCaptureDecision.ALLOW;

        } catch (RuntimeException exception) {

            /*
             * 보안 검사 자체가 실패했는데
             * 화면을 캡처해 버리면 안 된다.
             *
             * 알 수 없는 상태에서는 fail-closed.
             */
            return FrameCaptureDecision
                    .INSPECTION_FAILED_BLOCKED;
        }
    }

    private boolean containsVisibleSecureInput(
            Frame frame
    ) {
        Locator secureElements =
                frame.locator(
                        SECURE_INPUT_SELECTOR
                );

        int count =
                secureElements.count();

        for (int index = 0;
             index < count;
             index++) {

            Locator element =
                    secureElements.nth(
                            index
                    );

            /*
             * DOM에 숨겨진 password input 하나가
             * 있다는 이유만으로 일반 화면 캡처를
             * 막지는 않는다.
             *
             * 실제 화면에 표시된 보안 입력 요소만
             * 캡처 중지 대상으로 본다.
             */
            if (element.isVisible()) {
                return true;
            }
        }

        return false;
    }
}