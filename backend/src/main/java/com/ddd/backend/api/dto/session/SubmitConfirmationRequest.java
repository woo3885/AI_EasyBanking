package com.ddd.backend.api.dto.session;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record SubmitConfirmationRequest(

        @NotBlank(message = "requestId는 필수입니다.")
        @Size(max = 100, message = "requestId는 100자를 초과할 수 없습니다.")
        String requestId,

        @NotBlank(
                message = "최종 확인 ID는 필수입니다."
        )
        @Size(
                max = 100,
                message = "최종 확인 ID는 100자를 초과할 수 없습니다."
        )
        String confirmationId,

        @NotNull(
                message = "승인 여부는 필수입니다."
        )
        Boolean approved,

        @NotBlank(message = "expectedFrameId는 필수입니다.")
        @Size(max = 100, message = "expectedFrameId는 100자를 초과할 수 없습니다.")
        String expectedFrameId,

        @NotNull(message = "expectedSequence는 필수입니다.")
        @jakarta.validation.constraints.Positive(
                message = "expectedSequence는 1 이상이어야 합니다.")
        Long expectedSequence
) {

    public SubmitConfirmationRequest {
        if (requestId != null) {
            requestId = requestId.trim();
        }
        if (confirmationId != null) {
            confirmationId =
                    confirmationId.trim();
        }
        if (expectedFrameId != null) {
            expectedFrameId = expectedFrameId.trim();
        }
    }

    /** 기존 서비스 단위 테스트 호환용. HTTP JSON 계약에는 모든 필드가 필요하다. */
    public SubmitConfirmationRequest(String confirmationId, Boolean approved) {
        this("legacy-request", confirmationId, approved, "legacy-frame", 1L);
    }
}
