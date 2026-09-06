package com.ddd.backend.service.confirmation;

import com.ddd.backend.domain.session.ConfirmationType;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import com.ddd.backend.common.exception.ErrorCode;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FinalConfirmationStoreTest {
    @Test
    void Backend가_ID를_생성하고_승인을_exactly_once로_소비한다() {
        FinalConfirmationStore store = new FinalConfirmationStore();
        FinalConfirmationRequest request = store.activate(
                "session-001", ConfirmationType.DEPOSIT_SUBSCRIPTION,
                "el-final", "snap-001",
                new FinalConfirmationSummary("정기예금", "12개월", "1,000,000원"));

        assertThat(request.confirmationId()).startsWith("confirm-");
        assertThat(store.consume("session-001", request.confirmationId()))
                .isEqualTo(request);
        assertThatThrownBy(() -> store.consume(
                "session-001", request.confirmationId()))
                .isInstanceOfSatisfying(ConfirmationException.class,
                        exception -> assertThat(exception.getErrorCode())
                                .isEqualTo(ErrorCode.CONFIRMATION_REQUEST_IN_PROGRESS));
    }

    @Test
    void 다른_confirmationId는_거부하고_active를_유지한다() {
        FinalConfirmationStore store = new FinalConfirmationStore();
        FinalConfirmationRequest request = store.activate(
                "session-001", ConfirmationType.DEPOSIT_SUBSCRIPTION,
                "el-final", "snap-001",
                new FinalConfirmationSummary("정기예금", "12개월", "1,000,000원"));

        assertThatThrownBy(() -> store.consume("session-001", "confirm-other"))
                .isInstanceOf(IllegalStateException.class);
        assertThat(store.active("session-001")).contains(request);
    }

    @Test
    void source_frame과_requestId가_일치할_때만_한번_소비한다() {
        FinalConfirmationStore store = new FinalConfirmationStore();
        FinalConfirmationRequest request = store.activate(
                "session-001", ConfirmationType.DEPOSIT_SUBSCRIPTION,
                "el-final", "snap-001", "frm-001", 7L,
                new FinalConfirmationSummary("정기예금", "12개월", "1,000,000원"));

        assertThatThrownBy(() -> store.consume(
                "session-001", request.confirmationId(), "req-001",
                "frm-stale", 6L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("오래된 Viewer Frame");

        assertThat(store.consume(
                "session-001", request.confirmationId(), "req-002",
                "frm-001", 7L)).isEqualTo(request);

        assertThatThrownBy(() -> store.consume(
                "session-001", request.confirmationId(), "req-002",
                "frm-001", 7L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("이미 처리된");
    }

    @Test
    void timeout이면_identity를_전달하고_만료_ID를_다시_소비하지_않는다()
            throws Exception {
        FinalConfirmationStore store = new FinalConfirmationStore(
                Duration.ofMillis(30), Clock.systemUTC());
        CountDownLatch expired = new CountDownLatch(1);
        store.setExpirationListener((sessionId, confirmation) -> expired.countDown());
        FinalConfirmationRequest request = store.activate(
                "session-timeout", ConfirmationType.DEPOSIT_SUBSCRIPTION,
                "el-final", "snap-001", "frm-001", 7L,
                new FinalConfirmationSummary("정기예금", "12개월", "1,000,000원"));

        assertThat(expired.await(1, TimeUnit.SECONDS)).isTrue();
        assertThatThrownBy(() -> store.requireActive(
                "session-timeout", request.confirmationId()))
                .isInstanceOfSatisfying(ConfirmationException.class,
                        exception -> assertThat(exception.getErrorCode())
                                .isEqualTo(ErrorCode.CONFIRMATION_EXPIRED));
    }

    @Test
    void stale_요청에_사용한_requestId도_재사용할_수_없다() {
        FinalConfirmationStore store = new FinalConfirmationStore();
        FinalConfirmationRequest request = store.activate(
                "session-001", ConfirmationType.DEPOSIT_SUBSCRIPTION,
                "el-final", "snap-001", "frm-001", 7L,
                new FinalConfirmationSummary("정기예금", "12개월", "1,000,000원"));

        assertThatThrownBy(() -> store.consume("session-001",
                request.confirmationId(), "req-stale", "frm-old", 6L))
                .isInstanceOf(ConfirmationException.class);
        assertThatThrownBy(() -> store.consume("session-001",
                request.confirmationId(), "req-stale", "frm-001", 7L))
                .isInstanceOfSatisfying(ConfirmationException.class,
                        exception -> assertThat(exception.getErrorCode())
                                .isEqualTo(ErrorCode.CONFIRMATION_DUPLICATE_REQUEST));
    }
}
