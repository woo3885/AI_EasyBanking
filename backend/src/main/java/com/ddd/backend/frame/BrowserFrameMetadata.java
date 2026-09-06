package com.ddd.backend.frame;

import java.util.Objects;

public record BrowserFrameMetadata(
        String type,
        String sessionId,
        String frameId,
        long sequence,
        long timestamp,
        int width,
        int height,
        String mimeType,
        int byteLength
) {

    public static final String FRAME_TYPE =
            "BROWSER_FRAME";

    public BrowserFrameMetadata {

        Objects.requireNonNull(
                type,
                "Frame type은 필수입니다."
        );

        Objects.requireNonNull(
                sessionId,
                "sessionId는 필수입니다."
        );

        Objects.requireNonNull(
                frameId,
                "frameId는 필수입니다."
        );

        Objects.requireNonNull(
                mimeType,
                "mimeType은 필수입니다."
        );

        if (!FRAME_TYPE.equals(type)) {
            throw new IllegalArgumentException(
                    "지원하지 않는 Frame type입니다."
            );
        }

        if (sessionId.isBlank()) {
            throw new IllegalArgumentException(
                    "sessionId는 비어 있을 수 없습니다."
            );
        }

        if (frameId.isBlank()) {
            throw new IllegalArgumentException(
                    "frameId는 비어 있을 수 없습니다."
            );
        }

        if (sequence <= 0) {
            throw new IllegalArgumentException(
                    "sequence는 1 이상이어야 합니다."
            );
        }

        if (timestamp <= 0) {
            throw new IllegalArgumentException(
                    "timestamp는 0보다 커야 합니다."
            );
        }

        if (width <= 0
                || height <= 0) {

            throw new IllegalArgumentException(
                    "Frame 크기는 0보다 커야 합니다."
            );
        }

        if (byteLength <= 0) {
            throw new IllegalArgumentException(
                    "byteLength는 0보다 커야 합니다."
            );
        }
    }
}