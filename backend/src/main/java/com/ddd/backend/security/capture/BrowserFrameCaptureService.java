package com.ddd.backend.security.capture;

import com.ddd.backend.automation.session.BrowserSessionManager;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.ScreenshotScale;
import com.microsoft.playwright.options.ScreenshotType;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import com.ddd.backend.security.secureinput.SecureInputRegistry;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.time.Duration;
import java.util.Objects;

@Service
public class BrowserFrameCaptureService {

    /*
     * Frontend Viewer 기준 해상도와 동일하게 유지한다.
     */
    public static final int FRAME_WIDTH =
            1280;

    public static final int FRAME_HEIGHT =
            720;

    public static final String FRAME_MIME_TYPE =
            "image/png";

    /*
     * D17 PNG frame 최대 크기.
     *
     * 비정상적으로 큰 이미지가
     * WebSocket으로 넘어가지 않도록 제한한다.
     */
    public static final int MAX_FRAME_BYTES =
            5 * 1024 * 1024;

    private static final Duration CAPTURE_TIMEOUT =
            Duration.ofSeconds(10);

    private static final double PLAYWRIGHT_CAPTURE_TIMEOUT_MILLIS =
            8_000.0;

    private final BrowserSessionManager browserSessionManager;
    private final FrameCaptureGuard frameCaptureGuard;
    private SecureInputRegistry secureInputRegistry;

    @Autowired
    void setSecureInputRegistry(SecureInputRegistry secureInputRegistry) {
        this.secureInputRegistry = secureInputRegistry;
    }

    public BrowserFrameCaptureService(
            BrowserSessionManager browserSessionManager,
            FrameCaptureGuard frameCaptureGuard
    ) {
        this.browserSessionManager =
                Objects.requireNonNull(
                        browserSessionManager,
                        "BrowserSessionManager는 필수입니다."
                );

        this.frameCaptureGuard =
                Objects.requireNonNull(
                        frameCaptureGuard,
                        "FrameCaptureGuard는 필수입니다."
                );
    }

    /*
     * D17에서 사용하는 외부 진입점.
     *
     * BrowserSessionManager.execute() 내부에서
     *
     * 1. secure-input 검사
     * 2. screenshot
     *
     * 을 같은 Playwright Worker 작업으로 처리한다.
     *
     * 즉 Guard 검사와 screenshot 사이에
     * 별도 Worker 작업을 끼우지 않는다.
     */
    public FrameCaptureAttempt capture(
            String sessionId
    ) {
        validateSessionId(
                sessionId
        );

        if (secureInputRegistry != null && secureInputRegistry.blocksCapture(sessionId)) {
            return FrameCaptureAttempt.blocked(FrameCaptureDecision.SECURE_INPUT_BLOCKED);
        }

        return browserSessionManager.execute(
                sessionId,
                CAPTURE_TIMEOUT,
                this::capturePage
        );
    }

    /*
     * package-private:
     * 단위 테스트에서 직접 검증 가능.
     */
    FrameCaptureAttempt capturePage(
            Page page
    ) {
        Objects.requireNonNull(
                page,
                "Page는 필수입니다."
        );

        /*
         * screenshot을 찍기 전에
         * 반드시 보안 정책부터 검사한다.
         */
        FrameCaptureDecision decision =
                frameCaptureGuard.evaluatePage(
                        page
                );

        if (!decision.isAllowed()) {

            /*
             * secure-input 또는
             * 보안 검사 실패라면
             *
             * page.screenshot() 자체를 호출하지 않는다.
             */
            return FrameCaptureAttempt.blocked(
                    decision
            );
        }

        /*
         * 파일 경로(setPath)를 지정하지 않는다.
         *
         * screenshot은 메모리 byte[]로만 받는다.
         */
        byte[] imageBytes =
                page.screenshot(
                        new Page.ScreenshotOptions()
                                .setFullPage(
                                        false
                                )
                                .setType(
                                        ScreenshotType.PNG
                                )
                                .setScale(
                                        ScreenshotScale.CSS
                                )
                                .setTimeout(
                                        PLAYWRIGHT_CAPTURE_TIMEOUT_MILLIS
                                )
                );

        validateFrameBytes(
                imageBytes
        );

        ImageDimensions dimensions =
                readImageDimensions(
                        imageBytes
                );

        /*
         * BrowserContext는 이미
         * 1280 x 720으로 고정했다.
         *
         * 실제 생성된 PNG도 같은 크기인지
         * 다시 검증한다.
         */
        if (dimensions.width()
                != FRAME_WIDTH
                || dimensions.height()
                != FRAME_HEIGHT) {

            throw new IllegalStateException(
                    "Browser Frame 크기가 "
                            + FRAME_WIDTH
                            + "x"
                            + FRAME_HEIGHT
                            + "와 일치하지 않습니다. "
                            + "actual="
                            + dimensions.width()
                            + "x"
                            + dimensions.height()
            );
        }

        CapturedBrowserFrame frame =
                new CapturedBrowserFrame(
                        imageBytes,
                        dimensions.width(),
                        dimensions.height(),
                        FRAME_MIME_TYPE
                );

        return FrameCaptureAttempt.captured(
                frame
        );
    }

    private void validateFrameBytes(
            byte[] imageBytes
    ) {
        if (imageBytes == null
                || imageBytes.length == 0) {

            throw new IllegalStateException(
                    "Browser Frame 생성 결과가 비어 있습니다."
            );
        }

        if (imageBytes.length
                > MAX_FRAME_BYTES) {

            throw new IllegalStateException(
                    "Browser Frame 크기가 허용 한도를 초과했습니다."
            );
        }
    }

    private ImageDimensions readImageDimensions(
            byte[] imageBytes
    ) {
        try (
                ByteArrayInputStream inputStream =
                        new ByteArrayInputStream(
                                imageBytes
                        )
        ) {
            BufferedImage image =
                    ImageIO.read(
                            inputStream
                    );

            if (image == null) {
                throw new IllegalStateException(
                        "Browser Frame PNG를 해석할 수 없습니다."
                );
            }

            return new ImageDimensions(
                    image.getWidth(),
                    image.getHeight()
            );

        } catch (IOException exception) {

            throw new IllegalStateException(
                    "Browser Frame PNG 확인에 실패했습니다.",
                    exception
            );
        }
    }

    private void validateSessionId(
            String sessionId
    ) {
        if (sessionId == null
                || sessionId.isBlank()) {

            throw new IllegalArgumentException(
                    "세션 ID는 비어 있을 수 없습니다."
            );
        }
    }

    private record ImageDimensions(
            int width,
            int height
    ) {
    }
}
