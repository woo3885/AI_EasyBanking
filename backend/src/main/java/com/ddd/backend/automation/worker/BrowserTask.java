package com.ddd.backend.automation.worker;

import java.time.Duration;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.Callable;

public final class BrowserTask<T> {

    private final String taskId;
    private final String sessionId;
    private final Duration timeout;
    private final Callable<T> command;

    private BrowserTask(
            String taskId,
            String sessionId,
            Duration timeout,
            Callable<T> command
    ) {
        this.taskId = taskId;
        this.sessionId = sessionId;
        this.timeout = timeout;
        this.command = command;
    }

    public static <T> BrowserTask<T> create(
            String sessionId,
            Duration timeout,
            Callable<T> command
    ) {
        validateSessionId(sessionId);
        validateTimeout(timeout);

        Objects.requireNonNull(
                command,
                "브라우저 작업 명령은 필수입니다."
        );

        return new BrowserTask<>(
                UUID.randomUUID().toString(),
                sessionId,
                timeout,
                command
        );
    }

    public String getTaskId() {
        return taskId;
    }

    public String getSessionId() {
        return sessionId;
    }

    public Duration getTimeout() {
        return timeout;
    }

    T execute() throws Exception {
        return command.call();
    }

    private static void validateSessionId(
            String sessionId
    ) {
        if (sessionId == null || sessionId.isBlank()) {
            throw new IllegalArgumentException(
                    "브라우저 작업의 세션 ID는 비어 있을 수 없습니다."
            );
        }
    }

    private static void validateTimeout(
            Duration timeout
    ) {
        if (timeout == null
                || timeout.isZero()
                || timeout.isNegative()) {

            throw new IllegalArgumentException(
                    "브라우저 작업 제한시간은 0보다 커야 합니다."
            );
        }
    }
}