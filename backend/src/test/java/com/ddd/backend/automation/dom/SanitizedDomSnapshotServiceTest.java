package com.ddd.backend.automation.dom;

import com.ddd.backend.automation.BrowserActionPolicyContextResolver;
import com.ddd.backend.automation.session.BrowserSessionManager;
import com.ddd.backend.automation.worker.PlaywrightWorker;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SanitizedDomSnapshotServiceTest {

    private static final String SESSION_ID =
            "sanitized-dom-test-session";

    private PlaywrightWorker worker;

    private BrowserSessionManager manager;

    private SanitizedDomSnapshotService service;

    private DomSanitizer sanitizer;

    @BeforeEach
    void setUp() {
        worker =
                new PlaywrightWorker();

        manager =
                new BrowserSessionManager(
                        worker
                );

        InteractiveElementExtractor extractor =
                new InteractiveElementExtractor(
                        manager
                );

        BrowserActionPolicyContextResolver resolver =
                new BrowserActionPolicyContextResolver(
                        manager
                );

        sanitizer =
                new DomSanitizer();

        service =
                new SanitizedDomSnapshotService(
                        manager,
                        extractor,
                        resolver,
                        sanitizer
                );

        manager.createSession(
                SESSION_ID
        );
    }

    @Test
    void secure_latch_중에는_Sanitized_DOM을_생성하지_않는다() {
        var registry = new com.ddd.backend.security.secureinput.SecureInputRegistry();
        registry.activate(SESSION_ID,
                com.ddd.backend.security.secureinput.SecureInputType.ACCOUNT_PASSWORD,
                "frm-001", 1L, "https://demo/secure");
        service.setSecureInputRegistry(registry);

        assertThatThrownBy(() -> service.createSnapshot(SESSION_ID))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("보안 입력 중");
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
    void 개인정보를_제거한_DOM_Snapshot을_생성한다() {

        manager.execute(
                SESSION_ID,
                Duration.ofSeconds(5),
                page -> {

                    page.setContent("""
                            <!doctype html>
                            <html lang="ko">
                            <head>
                                <title>
                                    문의 test@example.com
                                </title>
                            </head>
                            <body>

                                <button
                                    id="normal"
                                    aria-label="연락처 010-1234-5678"
                                >
                                    고객 test@example.com
                                </button>

                                <input
                                    id="password"
                                    type="password"
                                    value="super-secret-password"
                                    placeholder="비밀번호 입력"
                                />

                                <input
                                    id="otp"
                                    type="text"
                                    autocomplete="one-time-code"
                                    value="123456"
                                />

                                <input
                                    id="account-choice"
                                    type="radio"
                                    data-ddd-policy="user-choice"
                                    aria-label="출금 계좌 선택"
                                />

                                <button
                                    id="final"
                                    data-ddd-policy="final-confirmation"
                                >
                                    송금하기
                                </button>

                                <button
                                    id="blocked"
                                    data-ddd-policy="blocked"
                                >
                                    차단 대상
                                </button>

                                <button
                                    id="hidden"
                                    style="display:none"
                                >
                                    숨김
                                </button>

                            </body>
                            </html>
                            """);

                    return null;
                }
        );

        SanitizedDomSnapshot snapshot =
                service.createSnapshot(
                        SESSION_ID
                );

        assertThat(
                snapshot.schemaVersion()
        ).isEqualTo(
                "1.0"
        );

        assertThat(
                snapshot.snapshotId()
        ).startsWith(
                "snap-"
        );

        /*
         * hidden button 제외.
         */
        assertThat(
                snapshot.elements()
        ).hasSize(
                6
        );

        /*
         * page title의 이메일 마스킹.
         */
        assertThat(
                snapshot.page()
                        .title()
        ).contains(
                "[EMAIL]"
        );

        SanitizedDomSnapshot.ElementSnapshot normal =
                snapshot.elements()
                        .get(
                                0
                        );

        assertThat(
                normal.text()
        ).contains(
                "[EMAIL]"
        );

        assertThat(
                normal.ariaLabel()
        ).contains(
                "[PHONE]"
        );

        /*
         * password value는 Snapshot 구조에
         * 존재하지 않는다.
         */
        SanitizedDomSnapshot.ElementSnapshot password =
                snapshot.elements()
                        .get(
                                1
                        );

        assertThat(
                password.inputType()
        ).isEqualTo(
                "password"
        );

        assertThat(
                password.text()
        ).doesNotContain(
                "super-secret-password"
        );

        assertThat(
                password.toString()
        ).doesNotContain(
                "super-secret-password"
        );

        assertThat(
                password.securityPolicy()
        ).isEqualTo(
                SanitizedDomSnapshot
                        .SecurityPolicy
                        .SECURE_INPUT
        );

        SanitizedDomSnapshot.ElementSnapshot otp =
                snapshot.elements()
                        .get(
                                2
                        );

        assertThat(
                otp.securityPolicy()
        ).isEqualTo(
                SanitizedDomSnapshot
                        .SecurityPolicy
                        .SECURE_INPUT
        );

        SanitizedDomSnapshot.ElementSnapshot choice =
                snapshot.elements()
                        .get(
                                3
                        );

        assertThat(
                choice.securityPolicy()
        ).isEqualTo(
                SanitizedDomSnapshot
                        .SecurityPolicy
                        .USER_DECISION
        );

        SanitizedDomSnapshot.ElementSnapshot finalButton =
                snapshot.elements()
                        .get(
                                4
                        );

        assertThat(
                finalButton.securityPolicy()
        ).isEqualTo(
                SanitizedDomSnapshot
                        .SecurityPolicy
                        .FINAL_CONFIRMATION
        );

        SanitizedDomSnapshot.ElementSnapshot blocked =
                snapshot.elements()
                        .get(
                                5
                        );

        assertThat(
                blocked.securityPolicy()
        ).isEqualTo(
                SanitizedDomSnapshot
                        .SecurityPolicy
                        .BLOCKED
        );
    }

    @Test
    void elementId는_snapshot별로_순차_발급한다() {

        manager.execute(
                SESSION_ID,
                Duration.ofSeconds(5),
                page -> {

                    page.setContent("""
                            <button>첫 번째</button>
                            <button>두 번째</button>
                            <button>세 번째</button>
                            """);

                    return null;
                }
        );

        SanitizedDomSnapshot snapshot =
                service.createSnapshot(
                        SESSION_ID
                );

        String token =
                snapshot.snapshotId()
                        .substring(
                                "snap-".length()
                        );

        assertThat(
                snapshot.elements()
        )
                .extracting(
                        SanitizedDomSnapshot
                                .ElementSnapshot
                                ::elementId
                )
                .containsExactly(
                        "el-" + token + "-001",
                        "el-" + token + "-002",
                        "el-" + token + "-003"
                );
    }

    @Test
    void 최대_300개까지만_AI_Snapshot에_포함한다() {

        manager.execute(
                SESSION_ID,
                Duration.ofSeconds(5),
                page -> {

                    page.setContent(
                            "<div id='container'></div>"
                    );

                    page.evaluate(
                            """
                            () => {
                                const container =
                                    document.querySelector(
                                        '#container'
                                    );

                                for (
                                    let i = 0;
                                    i < 305;
                                    i++
                                ) {
                                    const button =
                                        document.createElement(
                                            'button'
                                        );

                                    button.textContent =
                                        '버튼 ' + i;

                                    container.appendChild(
                                        button
                                    );
                                }
                            }
                            """
                    );

                    return null;
                }
        );

        SanitizedDomSnapshot snapshot =
                service.createSnapshot(
                        SESSION_ID
                );

        assertThat(
                snapshot.elements()
        ).hasSize(
                300
        );
    }

    @Test
    void URL에서_query_fragment_userinfo를_제거한다() {

        String sanitized =
                sanitizer.sanitizeUrl(
                        "http://user:pass@127.0.0.1:5190/"
                                + "transfer/accounts"
                                + "?account=1234"
                                + "#section"
                );

        assertThat(
                sanitized
        ).isEqualTo(
                "http://127.0.0.1:5190/transfer/accounts"
        );

        assertThat(
                sanitized
        )
                .doesNotContain(
                        "user"
                )
                .doesNotContain(
                        "pass"
                )
                .doesNotContain(
                        "account=1234"
                )
                .doesNotContain(
                        "#section"
                );
    }

    @Test
    void AI에_전달하는_문자열은_최대_200자로_제한한다() {

        String source =
                "A".repeat(
                        500
                );

        String result =
                sanitizer.sanitizeText(
                        source
                );

        assertThat(
                result
        ).hasSize(
                200
        );
    }

    @Test
    void B_to_C_Snapshot에_checkbox_checked_상태를_포함한다() {
        manager.execute(SESSION_ID, Duration.ofSeconds(5), page -> {
            page.setContent("""
                    <label><input id="term-required" type="checkbox" checked>
                    [필수] 이용약관</label>
                    <label><input id="term-optional" type="checkbox">
                    [선택] 마케팅</label>
                    """);
            return null;
        });

        SanitizedDomSnapshot snapshot = service.createSnapshot(SESSION_ID);

        assertThat(snapshot.elements())
                .extracting(SanitizedDomSnapshot.ElementSnapshot::checked)
                .containsExactly(true, false);
    }

    @Test
    void 실제_Demo_상품버튼은_가까운_heading으로_고유_label을_생성한다() {
        manager.execute(SESSION_ID, Duration.ofSeconds(5), page -> {
            page.setContent("""
                    <article id="product-deposit-12m">
                      <h2>12개월 정기예금</h2>
                      <button id="btn-select-deposit-12m">이 상품 선택</button>
                    </article>
                    <article id="product-deposit-preferred">
                      <h2>우대금리 정기예금</h2>
                      <button id="btn-select-deposit-preferred">이 상품 선택</button>
                    </article>
                    """);
            return null;
        });

        SanitizedDomSnapshot snapshot = service.createSnapshot(SESSION_ID);

        assertThat(snapshot.elements())
                .extracting(SanitizedDomSnapshot.ElementSnapshot::text)
                .containsExactly("12개월 정기예금", "우대금리 정기예금");
        assertThat(snapshot.elements())
                .extracting(SanitizedDomSnapshot.ElementSnapshot::securityPolicy)
                .containsOnly(SanitizedDomSnapshot.SecurityPolicy.USER_DECISION);
    }

    @Test
    void 상품상세_Snapshot은_C가_추론없이_읽을_상품_semantic_context를_포함한다() {
        manager.execute(SESSION_ID, Duration.ofSeconds(5), page -> {
            page.route("**/*", route -> route.fulfill(
                    new com.microsoft.playwright.Route.FulfillOptions()
                            .setStatus(200)
                            .setContentType("text/html; charset=utf-8")
                            .setBody("""
                                    <main id="page-deposit-product-detail">
                                      <h2 id="summary-deposit-product-name">우대금리 정기예금</h2>
                                      <span id="summary-deposit-product-period">12개월</span>
                                      <button id="btn-deposit-amount-start">가입 금액 입력</button>
                                    </main>
                                    """)));
            page.navigate("http://127.0.0.1:5190/deposit/products/deposit-preferred");
            return null;
        });

        SanitizedDomSnapshot snapshot = service.createSnapshot(SESSION_ID);

        assertThat(snapshot.page().productId()).isEqualTo("deposit-preferred");
        assertThat(snapshot.page().productName()).isEqualTo("우대금리 정기예금");
        assertThat(snapshot.page().productPeriod()).isEqualTo("12개월");
        assertThat(snapshot.snapshotId()).startsWith("snap-");
    }

    @Test
    void final_Snapshot은_이전_검증_context와_DOM이_일치할_때만_summary를_보존한다() {
        var selected = new com.ddd.backend.service.decision
                .SelectedDepositProductStore();
        selected.select(SESSION_ID, "btn-select-deposit-12m", "snap-products");
        assertThat(selected.observeDetail(
                SESSION_ID, "deposit-12m", "12개월 정기예금", "12개월",
                "100만 원을 12개월 동안 가입"))
                .isEqualTo(com.ddd.backend.service.decision
                        .SelectedDepositProductStore.Verification.VALID);
        assertThat(selected.observeAmount(
                SESSION_ID, "deposit-12m", "입력 금액: 1,000,000원")).isTrue();
        service.setSelectedProductStore(selected);

        manager.execute(SESSION_ID, Duration.ofSeconds(5), page -> {
            page.route("**/*", route -> route.fulfill(
                    new com.microsoft.playwright.Route.FulfillOptions()
                            .setStatus(200)
                            .setContentType("text/html; charset=utf-8")
                            .setBody("""
                                    <main id="page-deposit-confirmation">
                                      <dl id="summary-deposit-confirmation">
                                        <div data-ddd-summary-id="product-name">
                                          <dt>상품명</dt><dd>12개월 정기예금</dd>
                                        </div>
                                        <div data-ddd-summary-id="deposit-amount">
                                          <dt>가입 금액</dt><dd>1,000,000원</dd>
                                        </div>
                                        <div data-ddd-summary-id="deposit-period">
                                          <dt>가입 기간</dt><dd>12개월</dd>
                                        </div>
                                      </dl>
                                      <button data-ddd-policy="final-confirmation">
                                        Demo 예금 최종 승인
                                      </button>
                                    </main>
                                    """)));
            page.navigate("http://127.0.0.1:5190/deposit/confirmation/deposit-12m");
            return null;
        });

        SanitizedDomSnapshot snapshot = service.createSnapshot(SESSION_ID);
        var summary = new com.ddd.backend.service.confirmation
                .FinalConfirmationSummaryExtractor().extract(snapshot);

        assertThat(snapshot.page().productId()).isEqualTo("deposit-12m");
        assertThat(snapshot.page().productName()).isEqualTo("12개월 정기예금");
        assertThat(snapshot.page().productPeriod()).isEqualTo("12개월");
        assertThat(snapshot.page().depositAmount()).isEqualTo("1,000,000원");
        assertThat(summary).isEqualTo(new com.ddd.backend.service.confirmation
                .FinalConfirmationSummary("12개월 정기예금", "12개월", "1,000,000원"));
    }
}
