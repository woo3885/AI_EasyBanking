package com.ddd.backend.frame;

import com.ddd.backend.security.capture.CapturedBrowserFrame;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class BrowserFrameStoreTest {

    private BrowserFrameStore store;

    @BeforeEach
    void setUp() {
        store =
                new BrowserFrameStore();
    }

    @Test
    void 첫_Frame의_sequence는_1이다() {
        CapturedBrowserFrame frame =
                createFrame(
                        "frame-1"
                );

        BrowserFramePayload payload =
                store.publish(
                        "session-1",
                        frame
                );

        assertThat(
                payload.metadata().type()
        ).isEqualTo(
                "BROWSER_FRAME"
        );

        assertThat(
                payload.metadata().sessionId()
        ).isEqualTo(
                "session-1"
        );

        assertThat(
                payload.metadata().sequence()
        ).isEqualTo(
                1L
        );

        assertThat(
                payload.metadata().frameId()
        ).startsWith(
                "frm-"
        );

        assertThat(
                payload.metadata().timestamp()
        ).isPositive();

        assertThat(
                payload.metadata().width()
        ).isEqualTo(
                1280
        );

        assertThat(
                payload.metadata().height()
        ).isEqualTo(
                720
        );

        assertThat(
                payload.metadata().mimeType()
        ).isEqualTo(
                "image/png"
        );

        assertThat(
                payload.metadata().byteLength()
        ).isEqualTo(
                frame.byteLength()
        );
    }

    @Test
    void 같은_세션의_sequence는_1씩_증가한다() {
        BrowserFramePayload first =
                store.publish(
                        "session-1",
                        createFrame(
                                "frame-1"
                        )
                );

        BrowserFramePayload second =
                store.publish(
                        "session-1",
                        createFrame(
                                "frame-2"
                        )
                );

        BrowserFramePayload third =
                store.publish(
                        "session-1",
                        createFrame(
                                "frame-3"
                        )
                );

        assertThat(
                first.metadata().sequence()
        ).isEqualTo(
                1L
        );

        assertThat(
                second.metadata().sequence()
        ).isEqualTo(
                2L
        );

        assertThat(
                third.metadata().sequence()
        ).isEqualTo(
                3L
        );
    }

    @Test
    void 세션마다_sequence는_독립적이다() {
        BrowserFramePayload sessionA =
                store.publish(
                        "session-A",
                        createFrame(
                                "A"
                        )
                );

        BrowserFramePayload sessionB =
                store.publish(
                        "session-B",
                        createFrame(
                                "B"
                        )
                );

        assertThat(
                sessionA.metadata().sequence()
        ).isEqualTo(
                1L
        );

        assertThat(
                sessionB.metadata().sequence()
        ).isEqualTo(
                1L
        );

        assertThat(
                sessionA.metadata().sessionId()
        ).isEqualTo(
                "session-A"
        );

        assertThat(
                sessionB.metadata().sessionId()
        ).isEqualTo(
                "session-B"
        );
    }

    @Test
    void latest는_가장_최근_Frame만_반환한다() {
        store.publish(
                "session-1",
                createFrame(
                        "old"
                )
        );

        BrowserFramePayload newest =
                store.publish(
                        "session-1",
                        createFrame(
                                "new"
                        )
                );

        Optional<BrowserFramePayload> latest =
                store.latest(
                        "session-1"
                );

        assertThat(
                latest
        ).isPresent();

        assertThat(
                latest.orElseThrow()
                        .metadata()
                        .frameId()
        ).isEqualTo(
                newest.metadata()
                        .frameId()
        );

        assertThat(
                latest.orElseThrow()
                        .metadata()
                        .sequence()
        ).isEqualTo(
                2L
        );
    }

    @Test
    void 다른_세션의_Frame을_섞지_않는다() {
        store.publish(
                "session-A",
                createFrame(
                        "A"
                )
        );

        store.publish(
                "session-B",
                createFrame(
                        "B"
                )
        );

        BrowserFramePayload sessionA =
                store.latest(
                                "session-A"
                        )
                        .orElseThrow();

        BrowserFramePayload sessionB =
                store.latest(
                                "session-B"
                        )
                        .orElseThrow();

        assertThat(
                sessionA.metadata().sessionId()
        ).isEqualTo(
                "session-A"
        );

        assertThat(
                sessionB.metadata().sessionId()
        ).isEqualTo(
                "session-B"
        );

        assertThat(
                sessionA.metadata().frameId()
        ).isNotEqualTo(
                sessionB.metadata().frameId()
        );
    }

    @Test
    void 세션을_삭제하면_latest도_삭제된다() {
        store.publish(
                "session-1",
                createFrame(
                        "frame"
                )
        );

        assertThat(
                store.containsSession(
                        "session-1"
                )
        ).isTrue();

        store.removeSession(
                "session-1"
        );

        assertThat(
                store.containsSession(
                        "session-1"
                )
        ).isFalse();

        assertThat(
                store.latest(
                        "session-1"
                )
        ).isEmpty();
    }

    @Test
    void payload의_byte배열은_외부에서_변경할_수_없다() {
        BrowserFramePayload payload =
                store.publish(
                        "session-1",
                        createFrame(
                                "original"
                        )
                );

        byte[] firstRead =
                payload.bytes();

        firstRead[0] =
                (byte) 99;

        byte[] secondRead =
                payload.bytes();

        assertThat(
                secondRead[0]
        ).isNotEqualTo(
                (byte) 99
        );
    }

    private CapturedBrowserFrame createFrame(
            String value
    ) {
        byte[] bytes =
                value.getBytes(
                        StandardCharsets.UTF_8
                );

        return new CapturedBrowserFrame(
                bytes,
                1280,
                720,
                "image/png"
        );
    }

    @Test
    void 동일한_Frame을_publish하면_sequence가_증가하지_않는다() {
        CapturedBrowserFrame frame =
                createFrame(
                        "same-frame"
                );

        BrowserFramePayload first =
                store.publish(
                        "session-1",
                        frame
                );

        BrowserFramePayload second =
                store.publish(
                        "session-1",
                        frame
                );

        assertThat(
                second.metadata().sequence()
        ).isEqualTo(
                1L
        );

        assertThat(
                second.metadata().frameId()
        ).isEqualTo(
                first.metadata().frameId()
        );
    }

    @Test
    void 동일_Frame_다음에_변경_Frame이_오면_sequence는_2가_된다() {
        store.publish(
                "session-1",
                createFrame(
                        "same"
                )
        );

        store.publish(
                "session-1",
                createFrame(
                        "same"
                )
        );

        BrowserFramePayload changed =
                store.publish(
                        "session-1",
                        createFrame(
                                "changed"
                        )
                );

        assertThat(
                changed.metadata().sequence()
        ).isEqualTo(
                2L
        );
    }

    @Test
    void Action성공후_Frame은_동일PNG여도_sequence를_증가시킨다() {
        CapturedBrowserFrame same =
                createFrame(
                        "same-action-frame"
                );

        BrowserFramePayload first =
                store.publish(
                        "session-1",
                        same
                );

        BrowserFramePayload afterAction =
                store.publishAfterAction(
                        "session-1",
                        same
                );

        assertThat(
                first.metadata().sequence()
        ).isEqualTo(
                1L
        );

        assertThat(
                afterAction.metadata().sequence()
        ).isEqualTo(
                2L
        );

        assertThat(
                afterAction.metadata().frameId()
        ).isNotEqualTo(
                first.metadata().frameId()
        );
    }
}