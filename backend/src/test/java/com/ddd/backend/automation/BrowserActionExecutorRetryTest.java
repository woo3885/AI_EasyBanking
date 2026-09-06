package com.ddd.backend.automation;

import com.ddd.backend.automation.session.BrowserSessionManager;
import com.ddd.backend.automation.worker.PlaywrightWorker;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class BrowserActionExecutorRetryTest {

    private static final String SESSION_ID =
            "browser-action-retry-test-session";

    private PlaywrightWorker worker;

    private BrowserSessionManager manager;

    private BrowserActionExecutor executor;

    @BeforeEach
    void setUp() {
        worker =
                new PlaywrightWorker();

        manager =
                new BrowserSessionManager(
                        worker
                );

        executor =
                new BrowserActionExecutor(
                        manager,
                        new BrowserActionValidator(),
                        new BrowserActionPolicyContextResolver(
                                manager
                        ),
                        new BrowserActionPolicyEvaluator()
                );

        manager.createSession(
                SESSION_ID
        );
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

    /*
     * D12
     *
     * 첫 TYPE 실행 시에는 element가 아직 없어서 실패한다.
     *
     * 그 뒤 DOM에 input이 생기면
     * 두 번째 실행에서 page.locator()를 다시 생성해서
     * 정상 입력해야 한다.
     */
    @Test
    void TYPE은_첫실패후_Locator를_다시찾아_1회_재시도한다() {
        manager.execute(
                SESSION_ID,
                Duration.ofSeconds(5),
                page -> {

                    /*
                     * 첫 번째 Locator 대기를
                     * 길게 잡지 않도록 테스트에서만
                     * 짧은 timeout 적용.
                     */
                    page.setDefaultTimeout(
                            300
                    );

                    page.setContent("""
                            <!doctype html>
                            <html lang="ko">
                            <body>
                                <div id="container">
                                    입력창 준비 중
                                </div>

                                <script>
                                    setTimeout(() => {
                                        const input =
                                            document.createElement(
                                                'input'
                                            );

                                        input.id =
                                            'late-input';

                                        input.type =
                                            'text';

                                        document
                                            .querySelector(
                                                '#container'
                                            )
                                            .replaceChildren(
                                                input
                                            );
                                    }, 450);
                                </script>
                            </body>
                            </html>
                            """);

                    return null;
                }
        );

        BrowserAction action =
                new BrowserAction(
                        BrowserActionType.TYPE,
                        "#late-input",
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

        String value =
                manager.execute(
                        SESSION_ID,
                        Duration.ofSeconds(5),
                        page ->
                                page.locator(
                                        "#late-input"
                                ).inputValue()
                );

        assertEquals(
                BrowserActionExecutionStatus.EXECUTED,
                result.status()
        );

        assertEquals(
                "홍길동",
                value
        );
    }

    /*
     * SELECT도 같은 option을 다시 선택하는 것은
     * 제한적 재시도가 가능하다.
     */
    @Test
    void SELECT은_첫실패후_Locator를_다시찾아_1회_재시도한다() {
        manager.execute(
                SESSION_ID,
                Duration.ofSeconds(5),
                page -> {

                    page.setDefaultTimeout(
                            300
                    );

                    page.setContent("""
                            <!doctype html>
                            <html lang="ko">
                            <body>
                                <div id="container">
                                    상품 목록 준비 중
                                </div>

                                <script>
                                    setTimeout(() => {
                                        const select =
                                            document.createElement(
                                                'select'
                                            );

                                        select.id =
                                            'late-select';

                                        select.innerHTML = `
                                            <option value="deposit">
                                                예금
                                            </option>
                                            <option value="savings">
                                                적금
                                            </option>
                                        `;

                                        document
                                            .querySelector(
                                                '#container'
                                            )
                                            .replaceChildren(
                                                select
                                            );
                                    }, 450);
                                </script>
                            </body>
                            </html>
                            """);

                    return null;
                }
        );

        BrowserAction action =
                new BrowserAction(
                        BrowserActionType.SELECT,
                        "#late-select",
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
                        page ->
                                page.locator(
                                        "#late-select"
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

    /*
     * 금융 Action에서 특히 중요.
     *
     * CLICK 실패를 자동 재시도하면
     * 실제로는 첫 click이 수행되었는데 응답만 늦은 경우
     * 송금/가입 버튼을 두 번 누를 위험이 있다.
     *
     * 그래서 CLICK은 자동 Retry하지 않는다.
     */
    @Test
    void CLICK은_실패해도_자동_재시도하지_않는다() {
        manager.execute(
                SESSION_ID,
                Duration.ofSeconds(5),
                page -> {

                    page.setDefaultTimeout(
                            300
                    );

                    page.setContent("""
                            <!doctype html>
                            <html lang="ko">
                            <body>
                                <div id="status">
                                    실행 전
                                </div>

                                <script>
                                    setTimeout(() => {
                                        const button =
                                            document.createElement(
                                                'button'
                                            );

                                        button.id =
                                            'late-button';

                                        button.textContent =
                                            '실행';

                                        button.onclick = () => {
                                            document
                                                .querySelector(
                                                    '#status'
                                                )
                                                .textContent =
                                                    '클릭됨';
                                        };

                                        document.body.appendChild(
                                            button
                                        );
                                    }, 450);
                                </script>
                            </body>
                            </html>
                            """);

                    return null;
                }
        );

        BrowserAction action =
                new BrowserAction(
                        BrowserActionType.CLICK,
                        "#late-button",
                        null,
                        null,
                        null,
                        null
                );

        /*
         * 첫 click은 300ms 안에 button을 찾지 못하고 실패.
         *
         * CLICK에는 재시도가 없으므로
         * 450ms 뒤 생기는 button을 자동 클릭하면 안 된다.
         */
        assertThrows(
                IllegalStateException.class,
                () ->
                        executor.execute(
                                SESSION_ID,
                                action
                        )
        );

        manager.execute(
                SESSION_ID,
                Duration.ofSeconds(5),
                page -> {
                    page.waitForTimeout(
                            600
                    );

                    return null;
                }
        );

        String status =
                manager.execute(
                        SESSION_ID,
                        Duration.ofSeconds(5),
                        page ->
                                page.locator(
                                                "#status"
                                        )
                                        .innerText()
                                        .trim()
                );

        assertEquals(
                "실행 전",
                status
        );
    }

    /*
     * Retry 대상인 TYPE도
     * 영원히 재시도하면 안 된다.
     *
     * 첫 실행 + 재시도 1회가 모두 실패하면
     * 최종 예외를 상위 계층으로 전달한다.
     */
    @Test
    void TYPE은_재시도까지_실패하면_최종_예외를_반환한다() {
        manager.execute(
                SESSION_ID,
                Duration.ofSeconds(5),
                page -> {

                    page.setDefaultTimeout(
                            100
                    );

                    page.setContent("""
                            <!doctype html>
                            <html lang="ko">
                            <body>
                                <div>
                                    존재하지 않는 입력창 테스트
                                </div>
                            </body>
                            </html>
                            """);

                    return null;
                }
        );

        BrowserAction action =
                new BrowserAction(
                        BrowserActionType.TYPE,
                        "#never-exists",
                        "테스트",
                        null,
                        null,
                        null
                );

        assertThrows(
                IllegalStateException.class,
                () ->
                        executor.execute(
                                SESSION_ID,
                                action
                        )
        );
    }

    /*
     * 기존 정상 CLICK은
     * Retry 로직 추가 후에도 한 번 정상 실행되어야 한다.
     */
    @Test
    void 정상_CLICK은_기존처럼_실행된다() {
        manager.execute(
                SESSION_ID,
                Duration.ofSeconds(5),
                page -> {

                    page.setContent("""
                            <!doctype html>
                            <html lang="ko">
                            <body>
                                <button
                                    id="normal-button"
                                    onclick="
                                        document
                                            .querySelector(
                                                '#status'
                                            )
                                            .textContent =
                                                '완료'
                                    ">
                                    실행
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
                        "#normal-button",
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

        String status =
                manager.execute(
                        SESSION_ID,
                        Duration.ofSeconds(5),
                        page ->
                                page.locator(
                                                "#status"
                                        )
                                        .innerText()
                                        .trim()
                );

        assertEquals(
                BrowserActionExecutionStatus.EXECUTED,
                result.status()
        );

        assertEquals(
                "완료",
                status
        );
    }
}