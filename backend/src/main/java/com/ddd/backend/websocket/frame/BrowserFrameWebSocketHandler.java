package com.ddd.backend.websocket.frame;

import com.ddd.backend.frame.BrowserFrameMetadata;
import com.ddd.backend.frame.BrowserFramePayload;
import com.ddd.backend.frame.BrowserFrameStore;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.SubProtocolCapable;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.AbstractWebSocketHandler;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;

@Component
public final class BrowserFrameWebSocketHandler
        extends AbstractWebSocketHandler
        implements SubProtocolCapable {

    public static final String SUB_PROTOCOL =
            "ddd.browser-frame.v1";

    /*
     * D22:
     *
     * Session별 Viewer 연결 상태.
     *
     * 단순 WebSocketSession뿐 아니라
     *
     * - 현재 전송 중 여부
     * - 전송 중 새 Frame 발생 여부
     * - 마지막 전송 sequence
     *
     * 를 함께 관리한다.
     */
    private final Map<String, ConnectionState> connections =
            new ConcurrentHashMap<>();

    private final BrowserFrameStore browserFrameStore;

    public BrowserFrameWebSocketHandler(
            BrowserFrameStore browserFrameStore
    ) {
        this.browserFrameStore =
                Objects.requireNonNull(
                        browserFrameStore,
                        "BrowserFrameStore는 필수입니다."
                );
    }

    @Override
    public List<String> getSubProtocols() {
        return List.of(
                SUB_PROTOCOL
        );
    }

    @Override
    public void afterConnectionEstablished(
            WebSocketSession session
    ) throws Exception {

        if (!SUB_PROTOCOL.equals(
                session.getAcceptedProtocol()
        )) {

            session.close(
                    CloseStatus.POLICY_VIOLATION
            );

            return;
        }

        String automationSessionId =
                readAutomationSessionId(
                        session
                );

        if (automationSessionId == null) {

            session.close(
                    CloseStatus.POLICY_VIOLATION
            );

            return;
        }

        synchronized (connections) {

            ConnectionState existing =
                    connections.get(
                            automationSessionId
                    );

            if (existing != null
                    && existing.session().isOpen()) {

                session.close(
                        CloseStatus.POLICY_VIOLATION
                );

                return;
            }

            connections.put(
                    automationSessionId,
                    new ConnectionState(
                            session
                    )
            );
        }

        /*
         * 최초 Frame 전송.
         */
        sendLatest(
                automationSessionId
        );
    }

    /*
     * D22 Backpressure / latest-only.
     *
     * Viewer가 느려 이전 Frame을 보내고 있는 동안
     * 새로운 Frame이 발생하면 호출자는 기다리지 않고
     * pending flag만 남긴다.
     *
     * 전송 완료 후 Store에서 최신 Frame 하나만
     * 다시 읽어 전송한다.
     */
    public void sendLatest(
            String automationSessionId
    ) {
        validateAutomationSessionId(
                automationSessionId
        );

        ConnectionState state =
                connections.get(
                        automationSessionId
                );

        if (state == null
                || !state.session().isOpen()) {

            return;
        }

        synchronized (state) {

            if (state.sending()) {

                state.markPending();

                return;
            }

            state.startSending();
        }

        try {
            drainLatestFrames(
                    automationSessionId,
                    state
            );

        } finally {

            synchronized (state) {

                state.finishSending();
            }
        }
    }

    /*
     * Queue를 사용하지 않는다.
     *
     * 매 반복마다 BrowserFrameStore.latest()만 조회한다.
     * 따라서 sequence 10을 보내는 동안
     *
     * 11
     * 12
     * 13
     *
     * 이 발생했다면 11, 12를 모두 보내는 것이 아니라
     * 최신 13만 보낸다.
     */
    private void drainLatestFrames(
            String automationSessionId,
            ConnectionState state
    ) {
        while (true) {

            if (!state.session().isOpen()) {
                return;
            }

            BrowserFramePayload payload =
                    browserFrameStore
                            .latest(
                                    automationSessionId
                            )
                            .orElse(
                                    null
                            );

            if (payload == null) {

                connections.remove(
                        automationSessionId,
                        state
                );

                closeQuietly(
                        state.session(),
                        CloseStatus.POLICY_VIOLATION
                );

                return;
            }

            long latestSequence =
                    payload.metadata()
                            .sequence();

            boolean shouldSend;

            synchronized (state) {

                /*
                 * 동일 sequence는 재전송하지 않는다.
                 *
                 * BrowserFrameStore의 Change Detection과
                 * 함께 동일 Frame 중복 전송도 막는다.
                 */
                shouldSend =
                        latestSequence
                                > state.lastSentSequence();

                /*
                 * 현재까지 들어온 pending 요청은
                 * 이번 latest 조회로 처리한다.
                 */
                state.clearPending();
            }

            if (shouldSend) {

                try {
                    sendPayload(
                            state.session(),
                            payload
                    );

                } catch (IOException exception) {

                    connections.remove(
                            automationSessionId,
                            state
                    );

                    closeQuietly(
                            state.session(),
                            CloseStatus.SERVER_ERROR
                    );

                    throw new IllegalStateException(
                            "Browser Frame WebSocket 전송에 실패했습니다."
                    );
                }

                synchronized (state) {

                    state.markSent(
                            latestSequence
                    );
                }
            }

            /*
             * sendPayload() 중 새 Frame이 생겼는지,
             * 또는 Store latest가 더 진행됐는지 확인한다.
             */
            BrowserFramePayload newest =
                    browserFrameStore
                            .latest(
                                    automationSessionId
                            )
                            .orElse(
                                    null
                            );

            if (newest == null) {
                return;
            }

            synchronized (state) {

                boolean newerFrameExists =
                        newest.metadata()
                                .sequence()
                                > state.lastSentSequence();

                if (!state.pending()
                        && !newerFrameExists) {

                    return;
                }
            }
        }
    }

    public void closeConnection(
            String automationSessionId
    ) {
        validateAutomationSessionId(
                automationSessionId
        );

        ConnectionState state =
                connections.remove(
                        automationSessionId
                );

        if (state == null) {
            return;
        }

        closeQuietly(
                state.session(),
                CloseStatus.NORMAL
        );
    }

    private void sendPayload(
            WebSocketSession session,
            BrowserFramePayload payload
    ) throws IOException {

        String metadataJson =
                metadataToJson(
                        payload.metadata()
                );

        byte[] frameBytes =
                payload.bytes();

        /*
         * 하나의 Frame은 metadata → binary 순서를 보장한다.
         */
        synchronized (session) {

            if (!session.isOpen()) {
                return;
            }

            session.sendMessage(
                    new TextMessage(
                            metadataJson
                    )
            );

            session.sendMessage(
                    new BinaryMessage(
                            frameBytes
                    )
            );
        }
    }

    @Override
    public void afterConnectionClosed(
            WebSocketSession session,
            CloseStatus status
    ) {
        String automationSessionId =
                readAutomationSessionId(
                        session
                );

        if (automationSessionId == null) {
            return;
        }

        ConnectionState state =
                connections.get(
                        automationSessionId
                );

        if (state != null
                && state.session() == session) {

            connections.remove(
                    automationSessionId,
                    state
            );
        }
    }

    @Override
    public void handleTransportError(
            WebSocketSession session,
            Throwable exception
    ) {
        String automationSessionId =
                readAutomationSessionId(
                        session
                );

        if (automationSessionId != null) {

            ConnectionState state =
                    connections.get(
                            automationSessionId
                    );

            if (state != null
                    && state.session() == session) {

                connections.remove(
                        automationSessionId,
                        state
                );
            }
        }

        closeQuietly(
                session,
                CloseStatus.SERVER_ERROR
        );
    }

    public boolean hasConnection(
            String automationSessionId
    ) {
        validateAutomationSessionId(
                automationSessionId
        );

        ConnectionState state =
                connections.get(
                        automationSessionId
                );

        return state != null
                && state.session().isOpen();
    }

    public int activeConnectionCount() {
        return (int) connections
                .values()
                .stream()
                .map(
                        ConnectionState::session
                )
                .filter(
                        WebSocketSession::isOpen
                )
                .count();
    }

    private String readAutomationSessionId(
            WebSocketSession session
    ) {
        Object value =
                session
                        .getAttributes()
                        .get(
                                FrameWebSocketHandshakeInterceptor
                                        .SESSION_ID_ATTRIBUTE
                        );

        if (!(value instanceof String sessionId)
                || sessionId.isBlank()) {

            return null;
        }

        return sessionId;
    }

    private void validateAutomationSessionId(
            String automationSessionId
    ) {
        if (automationSessionId == null
                || automationSessionId.isBlank()) {

            throw new IllegalArgumentException(
                    "AutomationSession ID는 비어 있을 수 없습니다."
            );
        }
    }

    private String metadataToJson(
            BrowserFrameMetadata metadata
    ) {
        return "{"
                + "\"type\":"
                + quote(metadata.type())
                + ","
                + "\"sessionId\":"
                + quote(metadata.sessionId())
                + ","
                + "\"frameId\":"
                + quote(metadata.frameId())
                + ","
                + "\"sequence\":"
                + metadata.sequence()
                + ","
                + "\"timestamp\":"
                + metadata.timestamp()
                + ","
                + "\"width\":"
                + metadata.width()
                + ","
                + "\"height\":"
                + metadata.height()
                + ","
                + "\"mimeType\":"
                + quote(metadata.mimeType())
                + ","
                + "\"byteLength\":"
                + metadata.byteLength()
                + "}";
    }

    private String quote(
            String value
    ) {
        if (value == null) {
            return "null";
        }

        StringBuilder builder =
                new StringBuilder();

        builder.append(
                '"'
        );

        for (int index = 0;
             index < value.length();
             index++) {

            char character =
                    value.charAt(
                            index
                    );

            switch (character) {

                case '"' ->
                        builder.append(
                                "\\\""
                        );

                case '\\' ->
                        builder.append(
                                "\\\\"
                        );

                case '\b' ->
                        builder.append(
                                "\\b"
                        );

                case '\f' ->
                        builder.append(
                                "\\f"
                        );

                case '\n' ->
                        builder.append(
                                "\\n"
                        );

                case '\r' ->
                        builder.append(
                                "\\r"
                        );

                case '\t' ->
                        builder.append(
                                "\\t"
                        );

                default -> {

                    if (character < 0x20) {

                        builder.append(
                                String.format(
                                        "\\u%04x",
                                        (int) character
                                )
                        );

                    } else {

                        builder.append(
                                character
                        );
                    }
                }
            }
        }

        builder.append(
                '"'
        );

        return builder.toString();
    }

    private void closeQuietly(
            WebSocketSession session,
            CloseStatus closeStatus
    ) {
        try {

            if (session.isOpen()) {

                session.close(
                        closeStatus
                );
            }

        } catch (IOException ignored) {
            /*
             * cleanup 오류는 무시한다.
             */
        }
    }

    /*
     * D22:
     *
     * Frame Queue 자체를 저장하지 않는다.
     *
     * pending은 단순 boolean이므로
     * 느린 Viewer 때문에 메모리가 무한 증가하지 않는다.
     */
    private static final class ConnectionState {

        private final WebSocketSession session;

        private boolean sending;

        private boolean pending;

        private long lastSentSequence;

        private ConnectionState(
                WebSocketSession session
        ) {
            this.session =
                    Objects.requireNonNull(
                            session
                    );
        }

        private WebSocketSession session() {
            return session;
        }

        private boolean sending() {
            return sending;
        }

        private void startSending() {
            sending = true;
        }

        private void finishSending() {
            sending = false;
            pending = false;
        }

        private boolean pending() {
            return pending;
        }

        private void markPending() {
            pending = true;
        }

        private void clearPending() {
            pending = false;
        }

        private long lastSentSequence() {
            return lastSentSequence;
        }

        private void markSent(
                long sequence
        ) {
            if (sequence > lastSentSequence) {

                lastSentSequence =
                        sequence;
            }
        }
    }
}