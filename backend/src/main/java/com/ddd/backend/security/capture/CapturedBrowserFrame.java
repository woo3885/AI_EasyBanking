package com.ddd.backend.security.capture;

import java.util.Objects;

public record CapturedBrowserFrame(
        byte[] bytes,
        int width,
        int height,
        String mimeType
) {

    public CapturedBrowserFrame {
        Objects.requireNonNull(
                bytes,
                "Frame bytes는 필수입니다."
        );

        Objects.requireNonNull(
                mimeType,
                "Frame MIME type은 필수입니다."
        );

        if (bytes.length == 0) {
            throw new IllegalArgumentException(
                    "Frame bytes는 비어 있을 수 없습니다."
            );
        }

        if (width <= 0 || height <= 0) {
            throw new IllegalArgumentException(
                    "Frame 크기는 0보다 커야 합니다."
            );
        }

        /*
         * 외부에서 byte[] 내용을 변경하지 못하도록
         * 방어적 복사한다.
         */
        bytes =
                bytes.clone();
    }

    @Override
    public byte[] bytes() {
        return bytes.clone();
    }

    public int byteLength() {
        return bytes.length;
    }
}