package com.ddd.backend.common.exception;

import org.springframework.http.HttpStatus;

public enum ErrorCode {

    INVALID_REQUEST(
            HttpStatus.BAD_REQUEST,
            "COMMON_400",
            "요청값이 올바르지 않습니다."
    ),

    SESSION_NOT_FOUND(
            HttpStatus.NOT_FOUND,
            "SESSION_404",
            "자동화 세션을 찾을 수 없습니다."
    ),

    INVALID_SESSION_STATE(
            HttpStatus.CONFLICT,
            "SESSION_409",
            "현재 세션 상태에서는 요청을 처리할 수 없습니다."
    ),

    ACTION_FRAME_NOT_READY(
            HttpStatus.CONFLICT,
            "ACTION_409_FRAME_NOT_READY",
            "현재 Viewer Frame이 준비되지 않았습니다."
    ),

    ACTION_STALE_FRAME(
            HttpStatus.CONFLICT,
            "ACTION_409_STALE_FRAME",
            "오래된 Viewer Frame을 기준으로 한 요청입니다."
    ),

    ACTION_DUPLICATE_REQUEST(
            HttpStatus.CONFLICT,
            "ACTION_409_DUPLICATE_REQUEST",
            "이미 처리된 Browser Action 요청입니다."
    ),

    ACTION_BUSY(
            HttpStatus.CONFLICT,
            "ACTION_409_BUSY",
            "현재 다른 Browser Action이 처리 중입니다."
    ),

    ACTION_RATE_LIMITED(
            HttpStatus.TOO_MANY_REQUESTS,
            "ACTION_429_RATE_LIMITED",
            "Browser Action 요청이 너무 빠릅니다."
    ),

    USER_DECISION_RESUME_FAILED(
            HttpStatus.CONFLICT,
            "DECISION_409_RESUME_FAILED",
            "사용자 결정 후속 처리에 실패했습니다."
    ),

    SECURE_REQUEST_NOT_FOUND(HttpStatus.NOT_FOUND,
            "SECURE_404_REQUEST_NOT_FOUND", "활성 보안 입력 요청을 찾을 수 없습니다."),
    SECURE_REQUEST_MISMATCH(HttpStatus.CONFLICT,
            "SECURE_409_REQUEST_MISMATCH", "현재 보안 입력 요청과 일치하지 않습니다."),
    SECURE_STALE_FRAME(HttpStatus.CONFLICT,
            "SECURE_409_STALE_FRAME", "오래된 화면을 기준으로 한 완료 요청입니다."),
    SECURE_DUPLICATE_REQUEST(HttpStatus.CONFLICT,
            "SECURE_409_DUPLICATE_REQUEST", "이미 처리된 보안 입력 완료 요청입니다."),
    SECURE_COMPLETION_BUSY(HttpStatus.CONFLICT,
            "SECURE_409_COMPLETION_BUSY", "보안 입력 완료 여부를 이미 확인하고 있습니다."),
    SECURE_MARKER_MISSING(HttpStatus.CONFLICT,
            "SECURE_409_MARKER_MISSING", "사용자의 보안 입력 완료 상태를 확인할 수 없습니다."),
    SECURE_INPUT_STILL_ACTIVE(HttpStatus.CONFLICT,
            "SECURE_409_INPUT_ACTIVE", "보안 입력 화면이 아직 활성 상태입니다."),
    SECURE_SESSION_TERMINATED(HttpStatus.CONFLICT,
            "SECURE_409_SESSION_TERMINATED", "종료된 세션에서는 완료 요청을 처리할 수 없습니다."),
    SECURE_INVALID_WORKFLOW_STATUS(HttpStatus.CONFLICT,
            "SECURE_409_INVALID_STATUS", "현재 상태에서는 보안 입력 완료를 처리할 수 없습니다."),
    SECURE_COMPLETION_TIMEOUT(HttpStatus.REQUEST_TIMEOUT,
            "SECURE_408_COMPLETION_TIMEOUT", "보안 입력 완료 요청의 유효 시간이 지났습니다."),
    SECURE_SAFE_FRAME_FAILED(HttpStatus.SERVICE_UNAVAILABLE,
            "SECURE_503_SAFE_FRAME_FAILED", "완료 이후의 안전 화면을 생성할 수 없습니다."),
    SECURE_REQUEST_ABORTED(HttpStatus.CONFLICT,
            "SECURE_409_REQUEST_ABORTED", "보안 입력 완료 요청이 취소되거나 중단되었습니다."),

    CONFIRMATION_NOT_FOUND(HttpStatus.NOT_FOUND,
            "CONFIRMATION_NOT_FOUND", "활성 최종 확인 요청을 찾을 수 없습니다."),
    CONFIRMATION_ID_MISMATCH(HttpStatus.CONFLICT,
            "CONFIRMATION_ID_MISMATCH", "현재 최종 확인 요청과 일치하지 않습니다."),
    CONFIRMATION_STALE_FRAME(HttpStatus.CONFLICT,
            "CONFIRMATION_STALE_FRAME", "오래된 Viewer Frame의 최종 확인 요청입니다."),
    CONFIRMATION_DUPLICATE_REQUEST(HttpStatus.CONFLICT,
            "CONFIRMATION_DUPLICATE_REQUEST", "이미 처리된 최종 확인 요청입니다."),
    CONFIRMATION_REQUEST_IN_PROGRESS(HttpStatus.CONFLICT,
            "CONFIRMATION_REQUEST_IN_PROGRESS", "다른 최종 확인 요청을 처리하고 있습니다."),
    CONFIRMATION_EXPIRED(HttpStatus.GONE,
            "CONFIRMATION_EXPIRED", "최종 확인 요청의 유효 시간이 지났습니다."),
    CONFIRMATION_WORKFLOW_CONFLICT(HttpStatus.CONFLICT,
            "CONFIRMATION_WORKFLOW_CONFLICT", "현재 상태에서는 최종 확인을 처리할 수 없습니다."),
    CONFIRMATION_TARGET_NOT_FOUND(HttpStatus.CONFLICT,
            "CONFIRMATION_TARGET_NOT_FOUND", "최종 실행 대상을 찾을 수 없습니다."),
    CONFIRMATION_TARGET_DISABLED(HttpStatus.CONFLICT,
            "CONFIRMATION_TARGET_DISABLED", "최종 실행 대상을 사용할 수 없습니다."),
    CONFIRMATION_POLICY_MISMATCH(HttpStatus.CONFLICT,
            "CONFIRMATION_POLICY_MISMATCH", "최종 실행 안전 정책이 일치하지 않습니다."),
    CONFIRMATION_ACTION_FAILED(HttpStatus.SERVICE_UNAVAILABLE,
            "CONFIRMATION_ACTION_FAILED", "최종 실행을 안전하게 완료할 수 없습니다."),
    CONFIRMATION_FRAME_CAPTURE_FAILED(HttpStatus.SERVICE_UNAVAILABLE,
            "CONFIRMATION_FRAME_CAPTURE_FAILED", "실행 이후 안전 화면을 생성할 수 없습니다."),

    INTERNAL_SERVER_ERROR(
            HttpStatus.INTERNAL_SERVER_ERROR,
            "COMMON_500",
            "서버 처리 중 오류가 발생했습니다."
    );

    private final HttpStatus httpStatus;
    private final String code;
    private final String message;

    ErrorCode(
            HttpStatus httpStatus,
            String code,
            String message
    ) {
        this.httpStatus =
                httpStatus;

        this.code =
                code;

        this.message =
                message;
    }

    public HttpStatus getHttpStatus() {
        return httpStatus;
    }

    public String getCode() {
        return code;
    }

    public String getMessage() {
        return message;
    }
}
