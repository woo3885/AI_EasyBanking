package com.ddd.backend.service.decision;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SelectedDepositProductStoreTest {

    private final SelectedDepositProductStore store = new SelectedDepositProductStore();

    @Test
    void 두_예금상품은_검증된_Snapshot선택과_상세DOM기간을_연결한다() {
        for (String productId : new String[]{"deposit-12m", "deposit-preferred"}) {
            String sessionId = "session-" + productId;
            store.select(sessionId, "btn-select-" + productId, "snap-products-1");
            String productName = productId.equals("deposit-12m")
                    ? "12개월 정기예금" : "우대금리 정기예금";

            assertThat(store.observeDetail(sessionId, productId, productName, "12개월",
                    "100만 원 정기예금에 가입하고 싶다"))
                    .isEqualTo(SelectedDepositProductStore.Verification.VALID);
            assertThat(store.validatesAmountPage(sessionId, productId)).isTrue();
            assertThat(store.find(sessionId).orElseThrow().sourceSnapshotId())
                    .isEqualTo("snap-products-1");
            assertThat(store.find(sessionId).orElseThrow().periodLabel())
                    .isEqualTo("12개월");
            assertThat(store.observeAmount(
                    sessionId, productId, "입력 금액: 1,000,000원")).isTrue();
            assertThat(store.validatesFinalContext(
                    sessionId, productId, productName,
                    "12개월", "1,000,000원")).isTrue();
        }
    }

    @Test
    void final_DOM이_이전_상품이나_금액과_다르면_거부한다() {
        store.select("session", "btn-select-deposit-12m", "snap-1");
        assertThat(store.observeDetail(
                "session", "deposit-12m", "12개월 정기예금",
                "12개월", "100만 원을 12개월 동안 가입"))
                .isEqualTo(SelectedDepositProductStore.Verification.VALID);
        assertThat(store.observeAmount(
                "session", "deposit-12m", "입력 금액: 1,000,000원")).isTrue();

        assertThat(store.validatesFinalContext(
                "session", "deposit-preferred", "우대금리 정기예금",
                "12개월", "1,000,000원")).isFalse();
        assertThat(store.validatesFinalContext(
                "session", "deposit-12m", "12개월 정기예금",
                "12개월", "2,000,000원")).isFalse();
    }

    @Test
    void 요청기간과_상세DOM기간이_일치하면_진행한다() {
        store.select("session", "btn-select-deposit-12m", "snap-1");

        assertThat(store.observeDetail("session", "deposit-12m", "12개월 정기예금",
                "가입 기간 12개월",
                "100만 원을 12개월 동안 가입"))
                .isEqualTo(SelectedDepositProductStore.Verification.VALID);
    }

    @Test
    void 요청기간과_상세DOM기간이_다르면_충돌로_중단한다() {
        store.select("session", "btn-select-deposit-12m", "snap-1");

        assertThat(store.observeDetail("session", "deposit-12m", "12개월 정기예금", "12개월",
                "100만 원을 6개월 동안 가입"))
                .isEqualTo(SelectedDepositProductStore.Verification.PERIOD_CONFLICT);
        assertThat(store.validatesAmountPage("session", "deposit-12m")).isFalse();
    }

    @Test
    void 선택없음_URL상품불일치_기간누락은_검증을_거부한다() {
        assertThat(store.observeDetail("missing", "deposit-12m", "12개월 정기예금",
                "12개월", "100만 원"))
                .isEqualTo(SelectedDepositProductStore.Verification.INVALID);

        store.select("session", "btn-select-deposit-12m", "snap-1");
        assertThat(store.observeDetail("session", "deposit-preferred", "우대금리 정기예금",
                "12개월", "100만 원"))
                .isEqualTo(SelectedDepositProductStore.Verification.INVALID);
        assertThat(store.observeDetail("session", "deposit-12m", "12개월 정기예금",
                "기간 미정", "100만 원"))
                .isEqualTo(SelectedDepositProductStore.Verification.INVALID);
    }

    @Test
    void URL상품과_DOM상품명이_다르면_검증을_거부한다() {
        store.select("session", "btn-select-deposit-12m", "snap-1");

        assertThat(store.observeDetail("session", "deposit-12m", "우대금리 정기예금",
                "12개월", "100만 원"))
                .isEqualTo(SelectedDepositProductStore.Verification.INVALID);
    }

    @Test
    void 알수없는_상품이나_Snapshot없는_선택은_저장하지_않는다() {
        assertThatThrownBy(() -> store.select(
                "session", "btn-select-deposit-unknown", "snap-1"))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> store.select(
                "session", "btn-select-deposit-12m", " "))
                .isInstanceOf(IllegalStateException.class);
    }
}
