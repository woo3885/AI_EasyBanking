package com.ddd.backend.automation;

import com.ddd.backend.automation.session.BrowserSessionManager;
import com.ddd.backend.automation.worker.PlaywrightWorker;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BrowserActionPolicyContextResolverTest {

    private static final String SESSION_ID =
            "policy-context-resolver-test";

    private PlaywrightWorker worker;
    private BrowserSessionManager manager;
    private BrowserActionPolicyContextResolver resolver;

    @BeforeEach
    void setUp() {
        worker = new PlaywrightWorker();
        manager = new BrowserSessionManager(worker);

        resolver =
                new BrowserActionPolicyContextResolver(
                        manager
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
    void password_입력창은_민감정보로_판정한다() {
        setPageContent("""
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

        BrowserAction action =
                new BrowserAction(
                        BrowserActionType.TYPE,
                        "#input-password",
                        "입력값",
                        null,
                        null,
                        null
                );

        BrowserActionPolicyContext context =
                resolver.resolve(
                        SESSION_ID,
                        action
                );

        assertTrue(context.sensitiveInput());
        assertFalse(context.userChoice());
        assertFalse(context.finalExecution());
    }

    @Test
    void 일회용_인증번호_입력창은_민감정보로_판정한다() {
        setPageContent("""
                <!doctype html>
                <html lang="ko">
                <body>
                    <input
                        id="input-verification-code"
                        type="text"
                        autocomplete="one-time-code"
                        aria-label="인증번호"
                    />
                </body>
                </html>
                """);

        BrowserAction action =
                new BrowserAction(
                        BrowserActionType.TYPE,
                        "#input-verification-code",
                        "000000",
                        null,
                        null,
                        null
                );

        BrowserActionPolicyContext context =
                resolver.resolve(
                        SESSION_ID,
                        action
                );

        assertTrue(context.sensitiveInput());
    }

    @Test
    void normal_속성이_있어도_password는_민감정보로_판정한다() {
        setPageContent("""
                <!doctype html>
                <html lang="ko">
                <body>
                    <input
                        id="input-password"
                        type="password"
                        data-ddd-policy="normal"
                    />
                </body>
                </html>
                """);

        BrowserAction action =
                new BrowserAction(
                        BrowserActionType.TYPE,
                        "#input-password",
                        "입력값",
                        null,
                        null,
                        null
                );

        BrowserActionPolicyContext context =
                resolver.resolve(
                        SESSION_ID,
                        action
                );

        assertTrue(context.sensitiveInput());
    }

    @Test
    void 계좌_선택_버튼은_사용자_선택으로_판정한다() {
        setPageContent("""
                <!doctype html>
                <html lang="ko">
                <body>
                    <button id="btn-select-account">
                        출금 계좌 선택
                    </button>
                </body>
                </html>
                """);

        BrowserAction action =
                new BrowserAction(
                        BrowserActionType.CLICK,
                        "#btn-select-account",
                        null,
                        null,
                        null,
                        null
                );

        BrowserActionPolicyContext context =
                resolver.resolve(
                        SESSION_ID,
                        action
                );

        assertTrue(context.userChoice());
        assertFalse(context.sensitiveInput());
    }

    @Test
    void 비밀번호_화면으로_이동하는_일반_버튼은_민감입력으로_오탐하지_않는다() {
        setPageContent("""
                <button id="btn-deposit-terms-next" data-ddd-policy="normal">
                    동의하고 비밀번호 입력으로 이동
                </button>
                """);

        BrowserActionPolicyContext context = resolver.resolve(
                SESSION_ID,
                new BrowserAction(BrowserActionType.CLICK,
                        "#btn-deposit-terms-next", null, null, null, null));

        assertFalse(context.sensitiveInput());
        assertFalse(context.finalExecution());
        assertFalse(context.blockedTarget());
    }

    @Test
    void 선택적_마케팅_동의는_선택약관으로_판정한다() {
        setPageContent("""
                <!doctype html>
                <html lang="ko">
                <body>
                    <label>
                        <input
                            id="checkbox-marketing"
                            type="checkbox"
                            aria-label="선택 마케팅 수신 동의"
                        />
                        선택 마케팅 수신 동의
                    </label>
                </body>
                </html>
                """);

        BrowserAction action =
                new BrowserAction(
                        BrowserActionType.CLICK,
                        "#checkbox-marketing",
                        null,
                        null,
                        null,
                        null
                );

        BrowserActionPolicyContext context =
                resolver.resolve(
                        SESSION_ID,
                        action
                );

        assertTrue(context.optionalConsent());
        assertFalse(context.userChoice());
    }

    @Test
    void 최종_송금_버튼은_최종확인으로_판정한다() {
        setPageContent("""
                <!doctype html>
                <html lang="ko">
                <body>
                    <button id="btn-transfer-final">
                        최종 송금
                    </button>
                </body>
                </html>
                """);

        BrowserAction action =
                new BrowserAction(
                        BrowserActionType.CLICK,
                        "#btn-transfer-final",
                        null,
                        null,
                        null,
                        null
                );

        BrowserActionPolicyContext context =
                resolver.resolve(
                        SESSION_ID,
                        action
                );

        assertTrue(context.finalExecution());
        assertFalse(context.userChoice());
    }

    @Test
    void 명시적으로_blocked된_요소는_차단한다() {
        setPageContent("""
                <!doctype html>
                <html lang="ko">
                <body>
                    <button
                        id="blocked-target"
                        data-ddd-policy="blocked"
                    >
                        실행
                    </button>
                </body>
                </html>
                """);

        BrowserAction action =
                new BrowserAction(
                        BrowserActionType.CLICK,
                        "#blocked-target",
                        null,
                        null,
                        null,
                        null
                );

        BrowserActionPolicyContext context =
                resolver.resolve(
                        SESSION_ID,
                        action
                );

        assertTrue(context.blockedTarget());
    }

    @Test
    void 알_수_없는_명시적_정책은_안전하게_차단한다() {
        setPageContent("""
                <!doctype html>
                <html lang="ko">
                <body>
                    <button
                        id="unknown-policy"
                        data-ddd-policy="unknown-policy"
                    >
                        실행
                    </button>
                </body>
                </html>
                """);

        BrowserAction action =
                new BrowserAction(
                        BrowserActionType.CLICK,
                        "#unknown-policy",
                        null,
                        null,
                        null,
                        null
                );

        BrowserActionPolicyContext context =
                resolver.resolve(
                        SESSION_ID,
                        action
                );

        assertTrue(context.blockedTarget());
    }

    @Test
    void 일반_검색_버튼은_정상_행동으로_판정한다() {
        setPageContent("""
                <!doctype html>
                <html lang="ko">
                <body>
                    <button id="btn-search">
                        검색
                    </button>
                </body>
                </html>
                """);

        BrowserAction action =
                new BrowserAction(
                        BrowserActionType.CLICK,
                        "#btn-search",
                        null,
                        null,
                        null,
                        null
                );

        BrowserActionPolicyContext context =
                resolver.resolve(
                        SESSION_ID,
                        action
                );

        assertFalse(context.sensitiveInput());
        assertFalse(context.userChoice());
        assertFalse(context.optionalConsent());
        assertFalse(context.finalExecution());
        assertFalse(context.blockedTarget());
    }

    @Test
    void WAIT은_DOM을_확인하지_않고_정상으로_판정한다() {
        BrowserAction action =
                new BrowserAction(
                        BrowserActionType.WAIT,
                        null,
                        null,
                        null,
                        null,
                        100
                );

        BrowserActionPolicyContext context =
                resolver.resolve(
                        SESSION_ID,
                        action
                );

        assertFalse(context.sensitiveInput());
        assertFalse(context.userChoice());
        assertFalse(context.optionalConsent());
        assertFalse(context.finalExecution());
        assertFalse(context.blockedTarget());
    }

    private void setPageContent(
            String html
    ) {
        manager.execute(
                SESSION_ID,
                Duration.ofSeconds(5),
                page -> {
                    page.setContent(html);
                    return null;
                }
        );
    }
}
