package com.ddd.backend.security.secureinput;

import java.util.Objects;
import com.ddd.backend.security.SensitiveDataMasker;

/** UI event/reconnect에 노출 가능한 값만 포함한다. */
public record SecureInputRequest(
        String secureRequestId,
        SecureInputType secureInputType,
        String frameId,
        long frameSequence,
        String message
) {
    public SecureInputRequest {
        if (secureRequestId == null || secureRequestId.isBlank()) {
            throw new IllegalArgumentException("secureRequestId는 필수입니다.");
        }
        Objects.requireNonNull(secureInputType, "secureInputType은 필수입니다.");
        if (frameId == null || frameId.isBlank() || frameSequence < 1) {
            throw new IllegalArgumentException("보안 입력 source frame이 올바르지 않습니다.");
        }
        message = message == null || message.isBlank()
                ? "보안 값을 직접 입력해 주세요."
                : SensitiveDataMasker.maskFreeText(message.trim());
    }
}
