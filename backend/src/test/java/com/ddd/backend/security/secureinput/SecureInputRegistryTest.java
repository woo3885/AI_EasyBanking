package com.ddd.backend.security.secureinput;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static com.ddd.backend.common.exception.ErrorCode.*;

class SecureInputRegistryTest {
    private final SecureInputRegistry registry = new SecureInputRegistry();

    @Test
    void latch는_세션별로_안정적인_request를_생성하고_복원한다() {
        SecureInputRequest first = registry.activate(
                "session-1", SecureInputType.ACCOUNT_PASSWORD,
                "frm-1", 3L, "https://demo/secure");
        SecureInputRequest duplicate = registry.activate(
                "session-1", SecureInputType.ACCOUNT_PASSWORD,
                "frm-1", 3L, "https://demo/secure");

        assertThat(duplicate).isEqualTo(first);
        assertThat(registry.active("session-1")).contains(first);
        assertThat(registry.isActive("session-2")).isFalse();
    }

    @Test
    void 다른세션_stale_frame_duplicate_request와_동시제출을_차단한다() {
        SecureInputRequest request = registry.activate(
                "session-1", SecureInputType.OTP,
                "frm-1", 7L, "https://demo/otp");

        assertThatThrownBy(() -> registry.claim(
                "session-2", request.secureRequestId(), "req-1", "frm-1", 7L))
                .isInstanceOf(SecureInputException.class)
                .extracting("errorCode").isEqualTo(SECURE_REQUEST_NOT_FOUND);
        assertThatThrownBy(() -> registry.claim(
                "session-1", request.secureRequestId(), "req-1", "frm-old", 6L))
                .isInstanceOf(SecureInputException.class)
                .extracting("errorCode").isEqualTo(SECURE_STALE_FRAME);

        registry.claim("session-1", request.secureRequestId(),
                "req-1", "frm-1", 7L);
        assertThatThrownBy(() -> registry.claim(
                "session-1", request.secureRequestId(), "req-2", "frm-1", 7L))
                .isInstanceOf(SecureInputException.class)
                .extracting("errorCode").isEqualTo(SECURE_COMPLETION_BUSY);
        registry.releaseFailedSubmission("session-1");
        assertThatThrownBy(() -> registry.claim(
                "session-1", request.secureRequestId(), "req-1", "frm-1", 7L))
                .isInstanceOf(SecureInputException.class)
                .extracting("errorCode").isEqualTo(SECURE_DUPLICATE_REQUEST);
    }

    @Test
    void completion_timeout은_전용_오류로_fail_closed한다() throws Exception {
        SecureInputRegistry expired = new SecureInputRegistry(java.time.Duration.ZERO);
        SecureInputRequest request = expired.activate(
                "session-1", SecureInputType.ACCOUNT_PASSWORD,
                "frm-1", 1L, "https://demo/secure");
        Thread.sleep(2L);

        assertThatThrownBy(() -> expired.claim(
                "session-1", request.secureRequestId(), "req-1", "frm-1", 1L))
                .isInstanceOf(SecureInputException.class)
                .extracting("errorCode").isEqualTo(SECURE_COMPLETION_TIMEOUT);
    }

    @Test
    void resolve와_session_cleanup은_active_request를_제거한다() {
        SecureInputRequest request = registry.activate(
                "session-1", SecureInputType.CERTIFICATE_PASSWORD,
                "frm-1", 1L, "https://demo/cert");
        registry.claim("session-1", request.secureRequestId(),
                "req-1", "frm-1", 1L);

        assertThat(registry.resolve("session-1", request.secureRequestId()))
                .isEqualTo(request);
        assertThat(registry.active("session-1")).isEmpty();

        registry.activate("session-1", SecureInputType.ACCOUNT_PASSWORD,
                "frm-2", 2L, "https://demo/password");
        registry.removeSession("session-1");
        assertThat(registry.active("session-1")).isEmpty();
    }
}
