package com.ddd.backend.automation.worker;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PlaywrightWorkerTest {

    private PlaywrightWorker worker;

    @BeforeEach
    void setUp() {
        worker = new PlaywrightWorker();
    }

    @AfterEach
    void tearDown() {
        worker.close();
    }

    @Test
    void 작업이_정상적으로_완료되면_SUCCESS를_반환한다()
            throws Exception {

        BrowserTask<String> task = BrowserTask.create(
                "session-success",
                Duration.ofSeconds(1),
                () -> "페이지 제목"
        );

        BrowserTaskResult<String> result =
                worker.submit(task).get(
                        2,
                        TimeUnit.SECONDS
                );

        assertEquals(
                BrowserTaskStatus.SUCCESS,
                result.status()
        );

        assertEquals(
                "페이지 제목",
                result.data()
        );

        assertEquals(
                task.getTaskId(),
                result.taskId()
        );

        assertEquals(
                "session-success",
                result.sessionId()
        );

        assertTrue(
                result.message() == null
                        || result.message().isBlank()
        );

        assertTrue(
                result.completedAt()
                        .compareTo(result.startedAt()) >= 0
        );
    }

    @Test
    void 여러_작업은_제출된_순서대로_실행된다()
            throws Exception {

        List<Integer> executionOrder =
                Collections.synchronizedList(
                        new ArrayList<>()
                );

        CountDownLatch firstTaskStarted =
                new CountDownLatch(1);

        CountDownLatch allowFirstTaskToFinish =
                new CountDownLatch(1);

        BrowserTask<Integer> firstTask =
                BrowserTask.create(
                        "session-order",
                        Duration.ofSeconds(2),
                        () -> {
                            executionOrder.add(1);
                            firstTaskStarted.countDown();

                            allowFirstTaskToFinish.await();

                            executionOrder.add(2);
                            return 1;
                        }
                );

        BrowserTask<Integer> secondTask =
                BrowserTask.create(
                        "session-order",
                        Duration.ofSeconds(2),
                        () -> {
                            executionOrder.add(3);
                            return 2;
                        }
                );

        CompletableFuture<BrowserTaskResult<Integer>>
                firstResult =
                worker.submit(firstTask);

        assertTrue(
                firstTaskStarted.await(
                        1,
                        TimeUnit.SECONDS
                )
        );

        CompletableFuture<BrowserTaskResult<Integer>>
                secondResult =
                worker.submit(secondTask);

        /*
         * 첫 번째 작업을 풀어주기 전에는
         * 두 번째 작업이 실행되면 안 된다.
         */
        Thread.sleep(100);

        assertEquals(
                List.of(1),
                executionOrder
        );

        assertFalse(
                secondResult.isDone()
        );

        allowFirstTaskToFinish.countDown();

        assertEquals(
                BrowserTaskStatus.SUCCESS,
                firstResult.get(
                        2,
                        TimeUnit.SECONDS
                ).status()
        );

        assertEquals(
                BrowserTaskStatus.SUCCESS,
                secondResult.get(
                        2,
                        TimeUnit.SECONDS
                ).status()
        );

        assertEquals(
                List.of(1, 2, 3),
                executionOrder
        );
    }

    @Test
    void 작업_실행_중_예외가_발생하면_FAILED를_반환한다()
            throws Exception {

        BrowserTask<String> task = BrowserTask.create(
                "session-failure",
                Duration.ofSeconds(1),
                () -> {
                    throw new IllegalStateException(
                            "계좌번호 123-456-789"
                    );
                }
        );

        BrowserTaskResult<String> result =
                worker.submit(task).get(
                        2,
                        TimeUnit.SECONDS
                );

        assertEquals(
                BrowserTaskStatus.FAILED,
                result.status()
        );

        assertEquals(
                "브라우저 작업 실행에 실패했습니다.",
                result.message()
        );

        assertEquals(
                null,
                result.data()
        );

        /*
         * 실제 예외 메시지나 민감정보가
         * 외부 결과에 포함되지 않는지 확인한다.
         */
        assertFalse(
                result.message().contains(
                        "123-456-789"
                )
        );
    }

    @Test
    void 제한시간을_초과하면_TIMED_OUT을_반환한다()
            throws Exception {

        BrowserTask<String> task = BrowserTask.create(
                "session-timeout",
                Duration.ofMillis(100),
                () -> {
                    Thread.sleep(1_000);
                    return "완료";
                }
        );

        BrowserTaskResult<String> result =
                worker.submit(task).get(
                        2,
                        TimeUnit.SECONDS
                );

        assertEquals(
                BrowserTaskStatus.TIMED_OUT,
                result.status()
        );

        assertEquals(
                "브라우저 작업 제한시간을 초과했습니다.",
                result.message()
        );

        assertEquals(
                null,
                result.data()
        );
    }

    @Test
    void 종료할_때_대기_중인_작업은_CANCELLED된다()
            throws Exception {

        CountDownLatch firstTaskStarted =
                new CountDownLatch(1);

        CountDownLatch keepFirstTaskWaiting =
                new CountDownLatch(1);

        BrowserTask<String> firstTask =
                BrowserTask.create(
                        "session-close",
                        Duration.ofSeconds(5),
                        () -> {
                            firstTaskStarted.countDown();
                            keepFirstTaskWaiting.await();
                            return "첫 번째 작업";
                        }
                );

        BrowserTask<String> waitingTask =
                BrowserTask.create(
                        "session-close",
                        Duration.ofSeconds(5),
                        () -> "두 번째 작업"
                );

        CompletableFuture<BrowserTaskResult<String>>
                firstResult =
                worker.submit(firstTask);

        assertTrue(
                firstTaskStarted.await(
                        1,
                        TimeUnit.SECONDS
                )
        );

        CompletableFuture<BrowserTaskResult<String>>
                waitingResult =
                worker.submit(waitingTask);

        worker.close();

        BrowserTaskResult<String> cancelledResult =
                waitingResult.get(
                        2,
                        TimeUnit.SECONDS
                );

        assertEquals(
                BrowserTaskStatus.CANCELLED,
                cancelledResult.status()
        );

        assertEquals(
                "브라우저 작업이 취소되었습니다.",
                cancelledResult.message()
        );

        assertTrue(
                firstResult.isDone()
        );
    }

    @Test
    void 종료된_Worker에는_새로운_작업을_제출할_수_없다() {

        worker.close();

        BrowserTask<String> task = BrowserTask.create(
                "session-closed",
                Duration.ofSeconds(1),
                () -> "실행되지 않음"
        );

        IllegalStateException exception =
                assertThrows(
                        IllegalStateException.class,
                        () -> worker.submit(task)
                );

        assertEquals(
                "종료된 Playwright Worker에는 "
                        + "작업을 제출할 수 없습니다.",
                exception.getMessage()
        );
    }
}