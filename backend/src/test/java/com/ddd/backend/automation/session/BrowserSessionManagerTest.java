package com.ddd.backend.automation.session;

import com.ddd.backend.automation.worker.PlaywrightWorker;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BrowserSessionManagerTest {

    private PlaywrightWorker worker;
    private BrowserSessionManager manager;

    @BeforeEach
    void setUp() {
        worker = new PlaywrightWorker();
        manager = new BrowserSessionManager(worker);
    }

    @AfterEach
    void tearDown() {
        if (manager != null) {
            manager.close();
        }

        if (worker != null) {
            worker.close();
        }
    }

    @Test
    void 세션마다_독립된_페이지를_사용한다() {
        manager.createSession("session-1");
        manager.createSession("session-2");

        manager.execute(
                "session-1",
                Duration.ofSeconds(5),
                page -> {
                    page.setContent("""
                            <!doctype html>
                            <html lang="ko">
                            <head>
                                <title>첫 번째 세션</title>
                            </head>
                            <body>
                                <h1>첫 번째 사용자 화면</h1>
                            </body>
                            </html>
                            """);

                    return null;
                }
        );

        manager.execute(
                "session-2",
                Duration.ofSeconds(5),
                page -> {
                    page.setContent("""
                            <!doctype html>
                            <html lang="ko">
                            <head>
                                <title>두 번째 세션</title>
                            </head>
                            <body>
                                <h1>두 번째 사용자 화면</h1>
                            </body>
                            </html>
                            """);

                    return null;
                }
        );

        String firstTitle = manager.execute(
                "session-1",
                Duration.ofSeconds(5),
                page -> page.title()
        );

        String secondTitle = manager.execute(
                "session-2",
                Duration.ofSeconds(5),
                page -> page.title()
        );

        assertEquals(
                "첫 번째 세션",
                firstTitle
        );

        assertEquals(
                "두 번째 세션",
                secondTitle
        );

        assertEquals(
                2,
                manager.activeSessionCount()
        );

        assertTrue(
                manager.exists("session-1")
        );

        assertTrue(
                manager.exists("session-2")
        );
    }

    @Test
    void 브라우저_명령은_Worker_스레드에서_실행된다() {
        manager.createSession("worker-session");

        String threadName = manager.execute(
                "worker-session",
                Duration.ofSeconds(5),
                page -> Thread.currentThread().getName()
        );

        assertEquals(
                "playwright-worker",
                threadName
        );
    }

    @Test
    void 요청한_브라우저_세션만_종료한다() {
        manager.createSession("session-1");
        manager.createSession("session-2");

        manager.closeSession("session-1");

        assertFalse(
                manager.exists("session-1")
        );

        assertTrue(
                manager.exists("session-2")
        );

        assertEquals(
                1,
                manager.activeSessionCount()
        );
    }

    @Test
    void 중복된_세션_ID는_거부한다() {
        manager.createSession(
                "duplicate-session"
        );

        IllegalStateException exception =
                assertThrows(
                        IllegalStateException.class,
                        () -> manager.createSession(
                                "duplicate-session"
                        )
                );

        assertTrue(
                exception.getMessage().contains(
                        "이미 생성된 브라우저 세션"
                )
        );
    }

    @Test
    void 비어_있는_세션_ID는_거부한다() {
        assertThrows(
                IllegalArgumentException.class,
                () -> manager.createSession(" ")
        );
    }

    @Test
    void 존재하지_않는_세션에는_명령을_실행할_수_없다() {
        assertThrows(
                IllegalArgumentException.class,
                () -> manager.execute(
                        "not-found-session",
                        Duration.ofSeconds(1),
                        page -> page.title()
                )
        );
    }

    @Test
    void 명령이_제한시간을_초과하면_예외가_발생한다() {
        manager.createSession(
                "timeout-session"
        );

        IllegalStateException exception =
                assertThrows(
                        IllegalStateException.class,
                        () -> manager.execute(
                                "timeout-session",
                                Duration.ofMillis(100),
                                page -> {
                                    Thread.sleep(1_000);
                                    return page.title();
                                }
                        )
                );

        assertEquals(
                "브라우저 작업 제한시간을 초과했습니다.",
                exception.getMessage()
        );
    }
}