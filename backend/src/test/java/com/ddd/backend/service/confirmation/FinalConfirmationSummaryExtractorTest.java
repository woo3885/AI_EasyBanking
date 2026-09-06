package com.ddd.backend.service.confirmation;

import com.ddd.backend.automation.dom.SanitizedDomSnapshot;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FinalConfirmationSummaryExtractorTest {
    private final FinalConfirmationSummaryExtractor extractor =
            new FinalConfirmationSummaryExtractor();

    @Test
    void 안전하고_완전한_요약만_생성한다() {
        FinalConfirmationSummary summary = extractor.extract(snapshot(
                "정기예금", "12개월", "1,000,000원"));

        assertThat(summary).isEqualTo(
                new FinalConfirmationSummary("정기예금", "12개월", "1,000,000원"));
    }

    @Test
    void 구분자_없는_10자리_금액은_계좌번호로_오탐하지_않는다() {
        assertThat(extractor.extract(snapshot(
                "정기예금", "12개월", "1000000000원")).amount())
                .isEqualTo("1000000000원");
    }

    @Test
    void 민감정보가_포함된_상품명은_fail_closed한다() {
        assertThatThrownBy(() -> extractor.extract(snapshot(
                "홍길동 010-1234-5678 정기예금", "12개월", "1,000,000원")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("민감정보");
    }

    @Test
    void malformed_or_missing_summary는_fail_closed한다() {
        assertThatThrownBy(() -> extractor.extract(snapshot(
                "정기예금", "열두 달", "1,000,000원")))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> extractor.extract(snapshot(
                "정기예금", "12개월", "가입 금액 미확인")))
                .isInstanceOf(IllegalStateException.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "<script>alert(1)</script>정기예금",
            "<b>정기예금</b>",
            "password 포함 정기예금",
            "비밀번호 포함 정기예금",
            "OTP 포함 정기예금",
            "인증번호 포함 정기예금",
            "PIN 포함 정기예금",
            "계좌 1234567890 정기예금"
    })
    void 위험한_summary_문자열은_전체를_fail_closed한다(String productName) {
        assertThatThrownBy(() -> extractor.extract(snapshot(
                productName, "12개월", "1,000,000원")))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void CRLF외_제어문자도_fail_closed한다() {
        assertThatThrownBy(() -> extractor.extract(snapshot(
                "정기\u0007예금", "12개월", "1,000,000원")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("형식");
    }

    @Test
    void 금액_문맥에_민감정보가_하나라도_있으면_전체_summary를_거부한다() {
        assertThatThrownBy(() -> extractor.extract(snapshot(
                "정기예금", "12개월",
                "계좌 123456789012 / 가입 금액 1,000,000원")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("민감정보");
    }

    @Test
    void ordered_item의_중복_ID와_내부_ID는_전체를_fail_closed한다() {
        FinalConfirmationSummary duplicate = new FinalConfirmationSummary(
                "정기예금 가입", List.of(
                new ConfirmationSummaryItem("product-name", "상품명", "정기예금"),
                new ConfirmationSummaryItem("product-name", "가입 금액", "1,000,000원"),
                new ConfirmationSummaryItem("deposit-period", "가입 기간", "12개월")));
        FinalConfirmationSummary internal = new FinalConfirmationSummary(
                "정기예금 가입", List.of(
                new ConfirmationSummaryItem("product-name", "상품명", "정기예금"),
                new ConfirmationSummaryItem("deposit-amount", "elementId", "1,000,000원"),
                new ConfirmationSummaryItem("deposit-period", "가입 기간", "12개월")));

        assertThatThrownBy(() -> extractor.validate(duplicate))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> extractor.validate(internal))
                .isInstanceOf(IllegalStateException.class);
    }

    private SanitizedDomSnapshot snapshot(
            String productName, String productPeriod, String amount
    ) {
        return new SanitizedDomSnapshot(
                "1.0", "snap-001",
                new SanitizedDomSnapshot.PageSnapshot(
                        "http://127.0.0.1/final", "최종 확인",
                        "deposit-001", productName, productPeriod),
                List.of(new SanitizedDomSnapshot.ElementSnapshot(
                        "el-amount", "span", null, amount, null,
                        null, null, true, true, null,
                        new SanitizedDomSnapshot.BoundingBoxSnapshot(0, 0, 1, 1),
                        SanitizedDomSnapshot.SecurityPolicy.NORMAL)));
    }
}
