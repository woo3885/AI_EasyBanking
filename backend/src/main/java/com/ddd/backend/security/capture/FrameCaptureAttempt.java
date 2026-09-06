package com.ddd.backend.security.capture;

import java.util.Objects;

public record FrameCaptureAttempt(
        FrameCaptureDecision decision,
        CapturedBrowserFrame frame
) {

    public FrameCaptureAttempt {
        Objects.requireNonNull(
                decision,
                "FrameCaptureDecision은 필수입니다."
        );

        if (decision.isAllowed()
                && frame == null) {

            throw new IllegalArgumentException(
                    "캡처 허용 결과에는 Frame이 필요합니다."
            );
        }

        if (!decision.isAllowed()
                && frame != null) {

            throw new IllegalArgumentException(
                    "캡처 차단 결과에는 Frame이 없어야 합니다."
            );
        }
    }

    public static FrameCaptureAttempt captured(
            CapturedBrowserFrame frame
    ) {
        return new FrameCaptureAttempt(
                FrameCaptureDecision.ALLOW,
                Objects.requireNonNull(
                        frame,
                        "CapturedBrowserFrame은 필수입니다."
                )
        );
    }

    public static FrameCaptureAttempt blocked(
            FrameCaptureDecision decision
    ) {
        if (decision == null
                || decision.isAllowed()) {

            throw new IllegalArgumentException(
                    "차단된 FrameCaptureDecision이 필요합니다."
            );
        }

        return new FrameCaptureAttempt(
                decision,
                null
        );
    }

    public boolean captured() {
        return decision.isAllowed()
                && frame != null;
    }
}