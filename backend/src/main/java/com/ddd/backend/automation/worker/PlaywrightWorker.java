package com.ddd.backend.automation.worker;

import jakarta.annotation.PreDestroy;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
public final class PlaywrightWorker implements AutoCloseable {

    private static final String FAILED_MESSAGE =
            "브라우저 작업 실행에 실패했습니다.";

    private final ExecutorService taskExecutor;
    private final ScheduledExecutorService timeoutExecutor;
    private final AtomicBoolean closed =
            new AtomicBoolean(false);

    public PlaywrightWorker() {
        this.taskExecutor =
                Executors.newSingleThreadExecutor(
                        namedThreadFactory(
                                "playwright-worker"
                        )
                );

        this.timeoutExecutor =
                Executors.newSingleThreadScheduledExecutor(
                        namedThreadFactory(
                                "playwright-timeout"
                        )
                );
    }

    public <T> CompletableFuture<BrowserTaskResult<T>> submit(
            BrowserTask<T> task
    ) {
        Objects.requireNonNull(
                task,
                "브라우저 작업은 필수입니다."
        );

        ensureOpen();

        CompletableFuture<BrowserTaskResult<T>> result =
                new CompletableFuture<>();

        taskExecutor.execute(
                new QueuedCommand<>(
                        task,
                        result
                )
        );

        return result;
    }

    private <T> void executeTask(
            BrowserTask<T> task,
            CompletableFuture<BrowserTaskResult<T>> result
    ) {
        if (result.isDone()) {
            return;
        }

        Instant startedAt = Instant.now();
        AtomicBoolean timedOut =
                new AtomicBoolean(false);

        Thread workerThread =
                Thread.currentThread();

        long timeoutMillis = Math.max(
                1L,
                task.getTimeout().toMillis()
        );

        ScheduledFuture<?> timeoutFuture =
                timeoutExecutor.schedule(
                        () -> {
                            timedOut.set(true);

                            result.complete(
                                    BrowserTaskResult.timedOut(
                                            task,
                                            startedAt
                                    )
                            );

                            workerThread.interrupt();
                        },
                        timeoutMillis,
                        TimeUnit.MILLISECONDS
                );

        try {
            T data = task.execute();

            if (!timedOut.get()) {
                result.complete(
                        BrowserTaskResult.success(
                                task,
                                data,
                                startedAt
                        )
                );
            }

        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();

            if (!timedOut.get()) {
                result.complete(
                        BrowserTaskResult.cancelled(
                                task,
                                startedAt
                        )
                );
            }

        } catch (Exception exception) {
            if (!timedOut.get()) {
                result.complete(
                        BrowserTaskResult.failed(
                                task,
                                FAILED_MESSAGE,
                                startedAt
                        )
                );
            }

        } finally {
            timeoutFuture.cancel(false);

            /*
             * Timeout 또는 종료 과정에서 설정된 interrupt 상태가
             * 다음 작업에 영향을 주지 않도록 제거한다.
             */
            Thread.interrupted();
        }
    }

    private void ensureOpen() {
        if (closed.get()) {
            throw new IllegalStateException(
                    "종료된 Playwright Worker에는 "
                            + "작업을 제출할 수 없습니다."
            );
        }
    }

    @Override
    @PreDestroy
    public void close() {
        if (!closed.compareAndSet(false, true)) {
            return;
        }

        List<Runnable> waitingCommands =
                taskExecutor.shutdownNow();

        for (Runnable command : waitingCommands) {
            if (command instanceof QueuedCommand<?> queuedCommand) {
                queuedCommand.cancelBeforeStart();
            }
        }

        timeoutExecutor.shutdownNow();

        awaitTermination(taskExecutor);
        awaitTermination(timeoutExecutor);
    }

    private void awaitTermination(
            ExecutorService executorService
    ) {
        try {
            executorService.awaitTermination(
                    3,
                    TimeUnit.SECONDS
            );

        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
        }
    }

    private static ThreadFactory namedThreadFactory(
            String threadName
    ) {
        return runnable -> {
            Thread thread = new Thread(runnable);

            thread.setName(threadName);
            thread.setDaemon(true);

            return thread;
        };
    }

    private final class QueuedCommand<T>
            implements Runnable {

        private final BrowserTask<T> task;
        private final CompletableFuture<
                BrowserTaskResult<T>
                > result;

        private QueuedCommand(
                BrowserTask<T> task,
                CompletableFuture<
                        BrowserTaskResult<T>
                        > result
        ) {
            this.task = task;
            this.result = result;
        }

        @Override
        public void run() {
            executeTask(
                    task,
                    result
            );
        }

        private void cancelBeforeStart() {
            result.complete(
                    BrowserTaskResult.cancelled(
                            task,
                            Instant.now()
                    )
            );
        }
    }
}