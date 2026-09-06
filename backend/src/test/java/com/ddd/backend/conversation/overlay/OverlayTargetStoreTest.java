package com.ddd.backend.conversation.overlay;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OverlayTargetStoreTest {
    private static final Instant NOW = Instant.parse("2026-09-06T12:00:00Z");

    @Test
    void target은_session별_하나이고_internal_elementId는_public_DTO에_없다() {
        OverlayTargetStore store = store();
        PublicOverlayTarget first = store.replace(target("session-1", "target-1", NOW.plusSeconds(60)),
                "el-internal-secret", "fingerprint-1");
        store.replace(target("session-2", "target-2", NOW.plusSeconds(60)),
                "el-other", "fingerprint-2");

        assertThat(store.active("session-1", "page-1")).contains(first);
        assertThat(store.active("session-2", "page-1")).isPresent();
        assertThat(first.toString()).doesNotContain("el-internal-secret");
        assertThat(store.active("session-1", "wrong-page")).isEmpty();
    }

    @Test
    void duplicate와_consumed_target을_구분하고_재사용하지_않는다() {
        OverlayTargetStore store = store();
        store.replace(target("session-1", "target-1", NOW.plusSeconds(60)), "el-1", "fp");
        store.claim("session-1", "request-1", "target-1", "page-1", "snap-1");
        store.consume("session-1", "target-1");

        assertThatThrownBy(() -> store.claim(
                "session-1", "request-1", "target-1", "page-1", "snap-1"))
                .isInstanceOfSatisfying(OverlayTargetException.class,
                        error -> assertThat(error.error()).isEqualTo(OverlayTargetError.OBSERVATION_DUPLICATE_REQUEST));
        assertThatThrownBy(() -> store.claim(
                "session-1", "request-2", "target-1", "page-1", "snap-1"))
                .isInstanceOfSatisfying(OverlayTargetException.class,
                        error -> assertThat(error.error()).isEqualTo(OverlayTargetError.TARGET_ALREADY_CONSUMED));
    }

    @Test
    void 만료되거나_잘못된_rectangle은_fail_closed한다() {
        OverlayTargetStore store = store();
        PublicOverlayTarget expired = new PublicOverlayTarget("target-1", "session-1", "page-1", "snap-1",
                OverlayCoordinateSpace.VIEWPORT_CSS_PX,
                new PublicOverlayTarget.Rectangle(120, 240, 180, 56),
                new PublicOverlayTarget.Viewport(1280, 720), "button", "선택", "직접 눌러 주세요.",
                OverlayActionMode.GUIDE_USER_CLICK, NOW.minusSeconds(120), NOW.minusSeconds(1), null);
        store.replace(expired, "el-1", "fp");
        assertThat(store.active("session-1", "page-1")).isEmpty();

        PublicOverlayTarget invalid = new PublicOverlayTarget("target-2", "session-1", "page-1", "snap-1",
                OverlayCoordinateSpace.VIEWPORT_CSS_PX,
                new PublicOverlayTarget.Rectangle(0, 0, Double.NaN, 10),
                new PublicOverlayTarget.Viewport(1280, 720), "button", "선택", "직접 눌러 주세요.",
                OverlayActionMode.GUIDE_USER_CLICK, NOW, NOW.plusSeconds(60), null);
        assertThatThrownBy(() -> store.replace(invalid, "el-1", "fp"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private OverlayTargetStore store() {
        return new OverlayTargetStore(Duration.ofMinutes(2), Clock.fixed(NOW, ZoneOffset.UTC));
    }
    private PublicOverlayTarget target(String sessionId, String targetId, Instant expiresAt) {
        return new PublicOverlayTarget(targetId, sessionId, "page-1", "snap-1",
                OverlayCoordinateSpace.VIEWPORT_CSS_PX,
                new PublicOverlayTarget.Rectangle(120, 240, 180, 56),
                new PublicOverlayTarget.Viewport(1280, 720), "button", "12개월 상품 선택",
                "이 버튼을 직접 눌러 주세요.", OverlayActionMode.GUIDE_USER_CLICK,
                NOW, expiresAt, null);
    }
}
