package com.ddd.backend.automation;

import com.ddd.backend.automation.session.BrowserSessionManager;
import com.ddd.backend.automation.worker.PlaywrightWorker;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BrowserActionExecutorTest {

    private static final String SESSION_ID =
            "browser-action-test-session";

    private PlaywrightWorker worker;
    private BrowserSessionManager manager;
    private BrowserActionExecutor executor;

    @BeforeEach
    void setUp() {
        worker = new PlaywrightWorker();

        manager =
                new BrowserSessionManager(worker);

        executor =
                new BrowserActionExecutor(
                        manager,
                        new BrowserActionValidator(),
                        new BrowserActionPolicyContextResolver(
                                manager
                        ),
                        new BrowserActionPolicyEvaluator()
                );

        manager.createSession(SESSION_ID);
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
    void CLICK_행동을_실행한다() {
        manager.execute(
                SESSION_ID,
                Duration.ofSeconds(5),
                page -> {
                    page.setContent("""
                            <!doctype html>
                            <html lang="ko">
                            <body>
                                <button
                                    id="btn-confirm"
                                    onclick="
                                        document
                                            .querySelector('#status')
                                            .textContent='선택 완료'
                                    ">
                                    선택
                                </button>

                                <div id="status">
                                    선택 전
                                </div>
                            </body>
                            </html>
                            """);

                    return null;
                }
        );

        BrowserAction action =
                new BrowserAction(
                        BrowserActionType.CLICK,
                        "#btn-confirm",
                        null,
                        null,
                        null,
                        null
                );

        BrowserActionExecutionResult result =
                executor.execute(
                        SESSION_ID,
                        action
                );

        String statusText =
                manager.execute(
                        SESSION_ID,
                        Duration.ofSeconds(5),
                        page -> page.locator(
                                "#status"
                        ).innerText().trim()
                );

        assertEquals(
                BrowserActionExecutionStatus.EXECUTED,
                result.status()
        );

        assertEquals(
                BrowserActionType.CLICK,
                result.actionType()
        );

        assertEquals(
                "선택 완료",
                statusText
        );
    }

    @Test
    void TYPE_행동으로_입력창에_값을_입력한다() {
        manager.execute(
                SESSION_ID,
                Duration.ofSeconds(5),
                page -> {
                    page.setContent("""
                            <!doctype html>
                            <html lang="ko">
                            <body>
                                <input
                                    id="input-name"
                                    type="text"
                                />
                            </body>
                            </html>
                            """);

                    return null;
                }
        );

        BrowserAction action =
                new BrowserAction(
                        BrowserActionType.TYPE,
                        "#input-name",
                        "홍길동",
                        null,
                        null,
                        null
                );

        BrowserActionExecutionResult result =
                executor.execute(
                        SESSION_ID,
                        action
                );

        String inputValue =
                manager.execute(
                        SESSION_ID,
                        Duration.ofSeconds(5),
                        page -> page.locator(
                                "#input-name"
                        ).inputValue()
                );

        assertEquals(
                BrowserActionExecutionStatus.EXECUTED,
                result.status()
        );

        assertEquals(
                "홍길동",
                inputValue
        );
    }

    @Test
    void SELECT_행동으로_선택값을_변경한다() {
        manager.execute(
                SESSION_ID,
                Duration.ofSeconds(5),
                page -> {
                    page.setContent("""
                            <!doctype html>
                            <html lang="ko">
                            <body>
                                <select id="product-select">
                                    <option value="deposit">
                                        예금
                                    </option>
                                    <option value="savings">
                                        적금
                                    </option>
                                </select>
                            </body>
                            </html>
                            """);

                    return null;
                }
        );

        BrowserAction action =
                new BrowserAction(
                        BrowserActionType.SELECT,
                        "#product-select",
                        "savings",
                        null,
                        null,
                        null
                );

        BrowserActionExecutionResult result =
                executor.execute(
                        SESSION_ID,
                        action
                );

        String selectedValue =
                manager.execute(
                        SESSION_ID,
                        Duration.ofSeconds(5),
                        page -> page.locator(
                                "#product-select"
                        ).inputValue()
                );

        assertEquals(
                BrowserActionExecutionStatus.EXECUTED,
                result.status()
        );

        assertEquals(
                "savings",
                selectedValue
        );
    }

    @Test
    void WAIT_행동을_실행한다() {
        BrowserAction action =
                new BrowserAction(
                        BrowserActionType.WAIT,
                        null,
                        null,
                        null,
                        null,
                        50
                );

        BrowserActionExecutionResult result =
                executor.execute(
                        SESSION_ID,
                        action
                );

        assertEquals(
                BrowserActionExecutionStatus.EXECUTED,
                result.status()
        );

        assertEquals(
                BrowserActionType.WAIT,
                result.actionType()
        );
    }

    @Test
    void NONE은_페이지를_조작하지_않는다() {
        BrowserAction action =
                new BrowserAction(
                        BrowserActionType.NONE,
                        null,
                        null,
                        null,
                        null,
                        null
                );

        BrowserActionExecutionResult result =
                executor.execute(
                        SESSION_ID,
                        action
                );

        assertEquals(
                BrowserActionExecutionStatus.NO_ACTION,
                result.status()
        );
    }

    @Test
    void WAIT_FOR_USER는_사용자_선택을_요청한다() {
        BrowserAction action =
                new BrowserAction(
                        BrowserActionType.WAIT_FOR_USER,
                        null,
                        null,
                        null,
                        null,
                        null
                );

        BrowserActionExecutionResult result =
                executor.execute(
                        SESSION_ID,
                        action
                );

        assertEquals(
                BrowserActionExecutionStatus.USER_ACTION_REQUIRED,
                result.status()
        );
    }

    @Test
    void PAUSE_FOR_SECURE_INPUT은_민감정보_직접입력을_요청한다() {
        BrowserAction action =
                new BrowserAction(
                        BrowserActionType.PAUSE_FOR_SECURE_INPUT,
                        null,
                        null,
                        null,
                        null,
                        null
                );

        BrowserActionExecutionResult result =
                executor.execute(
                        SESSION_ID,
                        action
                );

        assertEquals(
                BrowserActionExecutionStatus.SECURE_INPUT_REQUIRED,
                result.status()
        );

        assertTrue(
                result.message().contains(
                        "사용자가 직접 입력"
                )
        );
    }

    @Test
    void REQUEST_FINAL_CONFIRMATION은_최종확인을_요청한다() {
        BrowserAction action =
                new BrowserAction(
                        BrowserActionType.REQUEST_FINAL_CONFIRMATION,
                        null,
                        null,
                        null,
                        null,
                        null
                );

        BrowserActionExecutionResult result =
                executor.execute(
                        SESSION_ID,
                        action
                );

        assertEquals(
                BrowserActionExecutionStatus.FINAL_CONFIRMATION_REQUIRED,
                result.status()
        );
    }

    @Test
    void STOP은_자동화를_중단한다() {
        BrowserAction action =
                new BrowserAction(
                        BrowserActionType.STOP,
                        null,
                        null,
                        null,
                        null,
                        null
                );

        BrowserActionExecutionResult result =
                executor.execute(
                        SESSION_ID,
                        action
                );

        assertEquals(
                BrowserActionExecutionStatus.STOPPED,
                result.status()
        );
    }

    @Test
    void 민감정보_TYPE은_실제_입력창에_전달하지_않는다() {
        manager.execute(
                SESSION_ID,
                Duration.ofSeconds(5),
                page -> {
                    page.setContent("""
                            <!doctype html>
                            <html lang="ko">
                            <body>
                                <input
                                    id="input-password"
                                    type="password"
                                />
                            </body>
                            </html>
                            """);

                    return null;
                }
        );

        BrowserAction action =
                new BrowserAction(
                        BrowserActionType.TYPE,
                        "#input-password",
                        "secret-password",
                        null,
                        null,
                        null
                );

        BrowserActionExecutionResult result =
                executor.execute(
                        SESSION_ID,
                        action
                );

        String inputValue =
                manager.execute(
                        SESSION_ID,
                        Duration.ofSeconds(5),
                        page -> page.locator(
                                "#input-password"
                        ).inputValue()
                );

        assertEquals(
                BrowserActionExecutionStatus.SECURE_INPUT_REQUIRED,
                result.status()
        );

        assertEquals(
                "",
                inputValue
        );
    }

    @Test
    void 계좌선택_CLICK은_실제_버튼을_누르지_않는다() {
        manager.execute(
                SESSION_ID,
                Duration.ofSeconds(5),
                page -> {
                    page.setContent("""
                            <!doctype html>
                            <html lang="ko">
                            <body>
                                <button
                                    id="btn-select-account"
                                    onclick="
                                        document
                                            .querySelector('#status')
                                            .textContent='계좌 선택 완료'
                                    ">
                                    계좌 선택
                                </button>

                                <div id="status">
                                    선택 전
                                </div>
                            </body>
                            </html>
                            """);

                    return null;
                }
        );

        BrowserAction action =
                new BrowserAction(
                        BrowserActionType.CLICK,
                        "#btn-select-account",
                        null,
                        null,
                        null,
                        null
                );

        BrowserActionExecutionResult result =
                executor.execute(
                        SESSION_ID,
                        action
                );

        String statusText =
                manager.execute(
                        SESSION_ID,
                        Duration.ofSeconds(5),
                        page -> page.locator(
                                "#status"
                        ).innerText().trim()
                );

        assertEquals(
                BrowserActionExecutionStatus.USER_ACTION_REQUIRED,
                result.status()
        );

        assertEquals(
                "선택 전",
                statusText
        );
    }

    @Test
    void 최종송금_CLICK은_사용자확인_전에는_실행하지_않는다() {
        manager.execute(
                SESSION_ID,
                Duration.ofSeconds(5),
                page -> {
                    page.setContent("""
                            <!doctype html>
                            <html lang="ko">
                            <body>
                                <button
                                    id="btn-transfer-final"
                                    onclick="
                                        document
                                            .querySelector('#status')
                                            .textContent='송금 실행'
                                    ">
                                    송금
                                </button>

                                <div id="status">
                                    실행 전
                                </div>
                            </body>
                            </html>
                            """);

                    return null;
                }
        );

        BrowserAction action =
                new BrowserAction(
                        BrowserActionType.CLICK,
                        "#btn-transfer-final",
                        null,
                        null,
                        null,
                        null
                );

        BrowserActionExecutionResult result =
                executor.execute(
                        SESSION_ID,
                        action
                );
        String statusText =
                manager.execute(
                        SESSION_ID,
                        Duration.ofSeconds(5),
                        page -> page.locator(
                                "#status"
                        ).innerText().trim()
                );

        assertEquals(
                BrowserActionExecutionStatus.FINAL_CONFIRMATION_REQUIRED,
                result.status()
        );

        assertEquals(
                "실행 전",
                statusText
        );
    }

    @Test
    void 차단대상_CLICK은_실제_페이지에_전달하지_않는다() {
        manager.execute(
                SESSION_ID,
                Duration.ofSeconds(5),
                page -> {
                    page.setContent("""
                            <!doctype html>
                            <html lang="ko">
                            <body>
                                <button
                                    id="blocked-target"
                                    data-ddd-policy="blocked"
                                    onclick="
                                        document
                                            .querySelector('#status')
                                            .textContent='차단 대상 실행'
                                    ">
                                    실행
                                </button>

                                <div id="status">
                                    차단 전
                                </div>
                            </body>
                            </html>
                            """);

                    return null;
                }
        );

        BrowserAction action =
                new BrowserAction(
                        BrowserActionType.CLICK,
                        "#blocked-target",
                        null,
                        null,
                        null,
                        null
                );

        BrowserActionExecutionResult result =
                executor.execute(
                        SESSION_ID,
                        action
                );

        String statusText =
                manager.execute(
                        SESSION_ID,
                        Duration.ofSeconds(5),
                        page -> page.locator(
                                "#status"
                        ).innerText().trim()
                );

        assertEquals(
                BrowserActionExecutionStatus.BLOCKED,
                result.status()
        );

        assertEquals(
                "차단 전",
                statusText
        );
    }
}


