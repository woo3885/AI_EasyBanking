package com.ddd.backend.frame;

import java.util.Objects;

public record BrowserFramePayload(
        BrowserFrameMetadata metadata,
        byte[] bytes
) {

    public BrowserFramePayload {

        Objects.requireNonNull(
                metadata,
                "Frame metadata는 필수입니다."
        );

        Objects.requireNonNull(
                bytes,
                "Frame bytes는 필수입니다."
        );

        if (bytes.length == 0) {
            throw new IllegalArgumentException(
                    "Frame bytes는 비어 있을 수 없습니다."
            );
        }

        if (metadata.byteLength()
                != bytes.length) {

            throw new IllegalArgumentException(
                    "metadata.byteLength와 "
                            + "실제 Frame 크기가 일치하지 않습니다."
            );
        }

        /*
         * 외부 코드가 원본 byte[]를
         * 변경하지 못하도록 방어적 복사.
         */
        bytes =
                bytes.clone();
    }

    @Override
    public byte[] bytes() {
        return bytes.clone();
    }
}