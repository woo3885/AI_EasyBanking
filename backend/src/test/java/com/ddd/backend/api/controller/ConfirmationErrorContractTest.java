package com.ddd.backend.api.controller;

import com.ddd.backend.common.exception.ErrorCode;
import com.ddd.backend.common.exception.GlobalExceptionHandler;
import com.ddd.backend.service.confirmation.ConfirmationException;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ConfirmationErrorContractTest {
    @Test
    void 모든_confirmation_오류는_전용_code와_안전한_message를_반환한다() {
        GlobalExceptionHandler handler = new GlobalExceptionHandler();
        List<ErrorCode> codes = List.of(
                ErrorCode.CONFIRMATION_NOT_FOUND,
                ErrorCode.CONFIRMATION_ID_MISMATCH,
                ErrorCode.CONFIRMATION_STALE_FRAME,
                ErrorCode.CONFIRMATION_DUPLICATE_REQUEST,
                ErrorCode.CONFIRMATION_REQUEST_IN_PROGRESS,
                ErrorCode.CONFIRMATION_EXPIRED,
                ErrorCode.CONFIRMATION_WORKFLOW_CONFLICT,
                ErrorCode.CONFIRMATION_TARGET_NOT_FOUND,
                ErrorCode.CONFIRMATION_TARGET_DISABLED,
                ErrorCode.CONFIRMATION_POLICY_MISMATCH,
                ErrorCode.CONFIRMATION_ACTION_FAILED,
                ErrorCode.CONFIRMATION_FRAME_CAPTURE_FAILED);

        for (ErrorCode code : codes) {
            var response = handler.handleConfirmation(new ConfirmationException(code));
            assertThat(response.getStatusCode().value())
                    .isEqualTo(code.getHttpStatus().value());
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().errorCode()).isEqualTo(code.getCode());
            assertThat(response.getBody().message())
                    .isEqualTo(code.getMessage())
                    .doesNotContain("selector", "<", ">", "password", "OTP");
        }
    }
}
