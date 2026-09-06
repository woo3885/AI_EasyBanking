package com.ddd.backend.common.response;

import com.ddd.backend.common.exception.ErrorCode;

public record ApiResponse<T>(
        boolean success,
        T data,
        String errorCode,
        String message
) {

    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(
                true,
                data,
                null,
                null
        );
    }

    public static <T> ApiResponse<T> success(T data, String message) {
        return new ApiResponse<>(
                true,
                data,
                null,
                message
        );
    }

    public static <T> ApiResponse<T> failure(ErrorCode errorCode) {
        return new ApiResponse<>(
                false,
                null,
                errorCode.getCode(),
                errorCode.getMessage()
        );
    }

    public static <T> ApiResponse<T> failure(
            ErrorCode errorCode,
            String message
    ) {
        return new ApiResponse<>(
                false,
                null,
                errorCode.getCode(),
                message
        );
    }
}