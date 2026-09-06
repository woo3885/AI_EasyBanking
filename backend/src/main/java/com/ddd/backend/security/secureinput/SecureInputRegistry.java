package com.ddd.backend.security.secureinput;

import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.List;
import java.time.Duration;
import java.time.Instant;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import static com.ddd.backend.common.exception.ErrorCode.*;

/** 원문을 저장하지 않는 session별 D26 secure latch. */
@Component
public final class SecureInputRegistry {
    private final ConcurrentMap<String, State> states = new ConcurrentHashMap<>();
    private final Duration completionTimeout;

    public SecureInputRegistry() {
        this(Duration.ofMinutes(5));
    }

    @Autowired
    public SecureInputRegistry(
            @Value("${ddd.secure-takeover.completion-timeout:5m}")
            Duration completionTimeout
    ) {
        this.completionTimeout = completionTimeout;
    }

    public SecureInputRequest activate(
            String sessionId, SecureInputType type, String frameId, long frameSequence,
            String pageUrl
    ) {
        State state = states.computeIfAbsent(sessionId, ignored -> new State());
        synchronized (state) {
            if (state.active != null) return state.active;
            state.active = new SecureInputRequest(
                    "sec-" + UUID.randomUUID(), type, frameId, frameSequence,
                    "민감정보는 전용 보안 입력 화면에서 직접 입력해 주세요.");
            state.pageUrl = pageUrl;
            state.expiresAt = Instant.now().plus(completionTimeout);
            return state.active;
        }
    }

    public Optional<SecureInputRequest> active(String sessionId) {
        State state = states.get(sessionId);
        if (state == null) return Optional.empty();
        synchronized (state) {
            return Optional.ofNullable(state.active);
        }
    }

    public boolean isActive(String sessionId) {
        return active(sessionId).isPresent();
    }

    public boolean blocksCapture(String sessionId) {
        State state = states.get(sessionId);
        if (state == null) return false;
        synchronized (state) {
            return state.active != null && !state.safeCaptureAllowed;
        }
    }

    public void allowSingleSafeCapture(String sessionId, String secureRequestId) {
        State state = states.get(sessionId);
        if (state == null) throw new SecureInputException(SECURE_REQUEST_NOT_FOUND);
        synchronized (state) {
            if (state.active == null) throw new SecureInputException(SECURE_REQUEST_NOT_FOUND);
            if (!state.active.secureRequestId().equals(secureRequestId)) {
                throw new SecureInputException(SECURE_REQUEST_MISMATCH);
            }
            if (!state.inFlight) throw new SecureInputException(SECURE_REQUEST_ABORTED);
            state.safeCaptureAllowed = true;
        }
    }

    public void finishSafeCapture(String sessionId) {
        State state = states.get(sessionId);
        if (state != null) synchronized (state) { state.safeCaptureAllowed = false; }
    }

    public String activePageUrl(String sessionId) {
        State state = states.get(sessionId);
        if (state == null) throw new SecureInputException(SECURE_REQUEST_NOT_FOUND);
        synchronized (state) {
            if (state.active == null) throw new SecureInputException(SECURE_REQUEST_NOT_FOUND);
            return state.pageUrl;
        }
    }

    public SecureInputRequest claim(
            String sessionId, String secureRequestId, String requestId,
            String expectedFrameId, long expectedSequence
    ) {
        State state = states.get(sessionId);
        if (state == null) throw new SecureInputException(SECURE_REQUEST_NOT_FOUND);
        synchronized (state) {
            SecureInputRequest active = state.active;
            if (active == null) throw new SecureInputException(SECURE_REQUEST_NOT_FOUND);
            if (Instant.now().isAfter(state.expiresAt)) {
                throw new SecureInputException(SECURE_COMPLETION_TIMEOUT);
            }
            if (!active.secureRequestId().equals(secureRequestId)) {
                throw new SecureInputException(SECURE_REQUEST_MISMATCH);
            }
            if (!active.frameId().equals(expectedFrameId)
                    || active.frameSequence() != expectedSequence) {
                throw new SecureInputException(SECURE_STALE_FRAME);
            }
            if (state.processedRequestIds.contains(requestId)) {
                throw new SecureInputException(SECURE_DUPLICATE_REQUEST);
            }
            if (state.inFlight) throw new SecureInputException(SECURE_COMPLETION_BUSY);
            state.inFlight = true;
            state.processedRequestIds.add(requestId);
            return active;
        }
    }

    public SecureInputRequest resolve(String sessionId, String secureRequestId) {
        State state = states.get(sessionId);
        if (state == null) throw new SecureInputException(SECURE_REQUEST_NOT_FOUND);
        synchronized (state) {
            if (state.active == null) throw new SecureInputException(SECURE_REQUEST_NOT_FOUND);
            if (!state.active.secureRequestId().equals(secureRequestId)) {
                throw new SecureInputException(SECURE_REQUEST_MISMATCH);
            }
            SecureInputRequest resolved = state.active;
            state.active = null;
            state.pageUrl = null;
            state.inFlight = false;
            state.safeCaptureAllowed = false;
            return resolved;
        }
    }

    public void releaseFailedSubmission(String sessionId) {
        State state = states.get(sessionId);
        if (state != null) synchronized (state) { state.inFlight = false; }
    }

    public void removeSession(String sessionId) {
        if (sessionId != null) states.remove(sessionId);
    }

    public List<String> removeExpired() {
        Instant now = Instant.now();
        java.util.ArrayList<String> expired = new java.util.ArrayList<>();
        states.forEach((sessionId, state) -> {
            synchronized (state) {
                if (state.active != null && !state.inFlight
                        && now.isAfter(state.expiresAt)
                        && states.remove(sessionId, state)) {
                    expired.add(sessionId);
                }
            }
        });
        return List.copyOf(expired);
    }

    private static final class State {
        private SecureInputRequest active;
        private boolean inFlight;
        private String pageUrl;
        private boolean safeCaptureAllowed;
        private Instant expiresAt;
        private final Set<String> processedRequestIds = new HashSet<>();
    }
}
