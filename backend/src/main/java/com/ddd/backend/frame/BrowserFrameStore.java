package com.ddd.backend.frame;

import com.ddd.backend.security.capture.CapturedBrowserFrame;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class BrowserFrameStore {

    private final Map<String, SessionFrameState> states =
            new ConcurrentHashMap<>();

    /*
     * 일반 Frame publish.
     *
     * 동일 PNG면 기존 Frame을 재사용한다.
     */
    public BrowserFramePayload publish(
            String sessionId,
            CapturedBrowserFrame frame
    ) {
        return publishInternal(
                sessionId,
                frame,
                false
        );
    }

    /*
     * Browser Action 성공 직후 Frame.
     *
     * HTTP Action response와
     * WebSocket Binary Frame을 sequence로
     * 명확하게 연결하기 위해
     * 동일 PNG라도 새로운 sequence/frameId를 발급한다.
     */
    public BrowserFramePayload publishAfterAction(
            String sessionId,
            CapturedBrowserFrame frame
    ) {
        return publishInternal(
                sessionId,
                frame,
                true
        );
    }

    private BrowserFramePayload publishInternal(
            String sessionId,
            CapturedBrowserFrame frame,
            boolean forceAdvance
    ) {
        validateSessionId(
                sessionId
        );

        Objects.requireNonNull(
                frame,
                "CapturedBrowserFrame은 필수입니다."
        );

        SessionFrameState state =
                states.computeIfAbsent(
                        sessionId,
                        ignored ->
                                new SessionFrameState()
                );

        return state.publish(
                sessionId,
                frame,
                forceAdvance
        );
    }

    public Optional<BrowserFramePayload> latest(
            String sessionId
    ) {
        validateSessionId(
                sessionId
        );

        SessionFrameState state =
                states.get(
                        sessionId
                );

        if (state == null) {
            return Optional.empty();
        }

        return state.latest();
    }

    public void removeSession(
            String sessionId
    ) {
        validateSessionId(
                sessionId
        );

        states.remove(
                sessionId
        );
    }

    public boolean containsSession(
            String sessionId
    ) {
        validateSessionId(
                sessionId
        );

        return states.containsKey(
                sessionId
        );
    }

    public int activeSessionCount() {
        return states.size();
    }

    private void validateSessionId(
            String sessionId
    ) {
        if (sessionId == null
                || sessionId.isBlank()) {

            throw new IllegalArgumentException(
                    "세션 ID는 비어 있을 수 없습니다."
            );
        }
    }

    private static String createFrameId() {
        return "frm-"
                + UUID.randomUUID();
    }

    private static final class SessionFrameState {

        private long sequence;

        private BrowserFramePayload latest;

        private byte[] latestFrameBytes;

        private synchronized BrowserFramePayload publish(
                String sessionId,
                CapturedBrowserFrame frame,
                boolean forceAdvance
        ) {
            byte[] incomingBytes =
                    frame.bytes();

            if (!forceAdvance
                    && latest != null
                    && latestFrameBytes != null
                    && Arrays.equals(
                    latestFrameBytes,
                    incomingBytes
            )) {

                return latest;
            }

            long nextSequence =
                    ++sequence;

            BrowserFrameMetadata metadata =
                    new BrowserFrameMetadata(
                            BrowserFrameMetadata.FRAME_TYPE,
                            sessionId,
                            createFrameId(),
                            nextSequence,
                            System.currentTimeMillis(),
                            frame.width(),
                            frame.height(),
                            frame.mimeType(),
                            frame.byteLength()
                    );

            BrowserFramePayload payload =
                    new BrowserFramePayload(
                            metadata,
                            incomingBytes
                    );

            latest =
                    payload;

            latestFrameBytes =
                    incomingBytes.clone();

            return payload;
        }

        private synchronized Optional<BrowserFramePayload>
        latest() {

            return Optional.ofNullable(
                    latest
            );
        }
    }
}