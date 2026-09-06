package com.ddd.backend.automation.worker;

import java.time.Instant;

public record BrowserTaskResult<T>(
        String taskId,
        String sessionId,
        BrowserTaskStatus status,
        T data,
        String message,
        Throwable failureCause,
        Instant startedAt,
        Instant completedAt
) {

    public static <T> BrowserTaskResult<T> success(
            BrowserTask<T> task,
            T data,
            Instant startedAt
    ) {
        return new BrowserTaskResult<>(
                task.getTaskId(),
                task.getSessionId(),
                BrowserTaskStatus.SUCCESS,
                data,
                null,
                null,
                startedAt,
                Instant.now()
        );
    }

    public static <T> BrowserTaskResult<T> failed(
            BrowserTask<T> task,
            String safeMessage,
            Throwable failureCause,
            Instant startedAt
    ) {
        return new BrowserTaskResult<>(
                task.getTaskId(),
                task.getSessionId(),
                BrowserTaskStatus.FAILED,
                null,
                safeMessage,
                failureCause,
                startedAt,
                Instant.now()
        );
    }

    public static <T> BrowserTaskResult<T> timedOut(
            BrowserTask<T> task,
            Instant startedAt
    ) {
        return new BrowserTaskResult<>(
                task.getTaskId(),
                task.getSessionId(),
                BrowserTaskStatus.TIMED_OUT,
                null,
                "브라우저 작업 제한시간을 초과했습니다.",
                null,
                startedAt,
                Instant.now()
        );
    }

    public static <T> BrowserTaskResult<T> cancelled(
            BrowserTask<T> task,
            Instant startedAt
    ) {
        return new BrowserTaskResult<>(
                task.getTaskId(),
                task.getSessionId(),
                BrowserTaskStatus.CANCELLED,
                null,
                "브라우저 작업이 취소되었습니다.",
                null,
                startedAt,
                Instant.now()
        );
    }
}
