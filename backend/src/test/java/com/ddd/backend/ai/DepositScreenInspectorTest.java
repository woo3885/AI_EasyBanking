package com.ddd.backend.ai;

import com.ddd.backend.automation.session.BrowserSessionManager;
import com.ddd.backend.automation.worker.PlaywrightWorker;
import com.microsoft.playwright.Route;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

class DepositScreenInspectorTest {

    private PlaywrightWorker worker;
    private BrowserSessionManager manager;
    private DepositScreenInspector inspector;

    @BeforeEach
    void setUp() {
        worker = new PlaywrightWorker();
        manager = new BrowserSessionManager(worker);
        manager.createSession("deposit-screen");
        inspector = new DepositScreenInspector(manager, new DepositPageClassifier());
    }

    @AfterEach
    void tearDown() {
        manager.close();
        worker.close();
    }

    @Test
    void 약관화면은_필수선택과_안전한_다음버튼을_함께_검증한다() {
        navigate("/deposit/terms/deposit-12m", """
                <main id="page-deposit-terms">
                  <input id="checkbox-term-service-required" type="checkbox" required>
                  <input id="checkbox-term-privacy-required" type="checkbox" required>
                  <input id="checkbox-term-marketing-optional" type="checkbox">
                  <button id="btn-deposit-terms-confirm">확인</button>
                  <button id="btn-deposit-terms-next">비밀번호 입력으로 이동</button>
                </main>
                """);

        DepositScreenInspector.Inspection result = inspector.inspect("deposit-screen");

        assertThat(result.screen()).isEqualTo(DepositPageClassifier.DepositPage.TERMS);
        assertThat(result.valid()).isTrue();
    }

    @Test
    void 약관_다음버튼에_secure_policy가_붙으면_계약을_거부한다() {
        navigate("/deposit/terms/deposit-12m", """
                <main id="page-deposit-terms">
                  <input id="checkbox-term-service-required" type="checkbox" required>
                  <input id="checkbox-term-privacy-required" type="checkbox" required>
                  <input id="checkbox-term-marketing-optional" type="checkbox">
                  <button id="btn-deposit-terms-confirm">확인</button>
                  <button id="btn-deposit-terms-next" data-ddd-policy="secure-input">다음</button>
                </main>
                """);

        assertThat(inspector.inspect("deposit-screen").valid()).isFalse();
    }

    @Test
    void 비밀번호화면은_type과_secure_policy가_모두_필요하다() {
        navigate("/deposit/secure/password/deposit-12m", """
                <main id="page-deposit-password">
                  <input id="input-account-password" type="password"
                         data-ddd-policy="secure-input">
                </main>
                """);

        DepositScreenInspector.Inspection result = inspector.inspect("deposit-screen");

        assertThat(result.screen())
                .isEqualTo(DepositPageClassifier.DepositPage.SECURE_PASSWORD);
        assertThat(result.valid()).isTrue();
    }

    @Test
    void 보안입력완료_marker와_input제거가_확인되면_안전한_대기화면이다() {
        navigate("/deposit/secure/password/deposit-12m", """
                <main id="page-deposit-password">
                  <p data-ddd-secure-state="completed">
                    보안 입력 절차가 완료 요청 상태로 전환되었습니다.
                  </p>
                </main>
                """);

        assertThat(inspector.inspect("deposit-screen").valid()).isTrue();
    }

    @Test
    void 완료_marker가_있어도_secure_input이_남아있으면_거부한다() {
        navigate("/deposit/secure/password/deposit-12m", """
                <main id="page-deposit-password">
                  <input data-ddd-policy="secure-input" type="password">
                  <p data-ddd-secure-state="completed">완료 요청됨</p>
                </main>
                """);

        assertThat(inspector.inspect("deposit-screen").valid()).isFalse();
    }

    @Test
    void 상품상세는_URL상품과_실제_DOM기간을_함께_반환한다() {
        navigate("/deposit/products/deposit-preferred", """
                <main id="page-deposit-product-detail">
                  <h2 id="summary-deposit-product-name">우대금리 정기예금</h2>
                  <span id="summary-deposit-product-period">12개월</span>
                  <button id="btn-deposit-amount-start">가입 금액 입력</button>
                </main>
                """);

        DepositScreenInspector.Inspection result = inspector.inspect("deposit-screen");

        assertThat(result.valid()).isTrue();
        assertThat(result.productId()).isEqualTo("deposit-preferred");
        assertThat(result.productName()).isEqualTo("우대금리 정기예금");
        assertThat(result.periodLabel()).isEqualTo("12개월");
    }

    private void navigate(String path, String html) {
        manager.execute("deposit-screen", Duration.ofSeconds(5), page -> {
            page.route("**/*", route -> route.fulfill(
                    new Route.FulfillOptions().setStatus(200)
                            .setContentType("text/html; charset=utf-8")
                            .setBody(html)));
            page.navigate("http://127.0.0.1:5190" + path);
            return null;
        });
    }
}
