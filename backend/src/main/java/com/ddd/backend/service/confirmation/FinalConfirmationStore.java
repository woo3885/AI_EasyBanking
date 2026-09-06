package com.ddd.backend.service.confirmation;

import com.ddd.backend.domain.session.ConfirmationType;
import com.ddd.backend.common.exception.ErrorCode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.function.BiConsumer;

@Component
public final class FinalConfirmationStore {
    private final ConcurrentHashMap<String, State> states = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Set<String>> processedRequestIds =
            new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Set<String>> expiredConfirmationIds =
            new ConcurrentHashMap<>();
    private final Duration timeout;
    private final Clock clock;
    private final ScheduledExecutorService scheduler;
    private volatile BiConsumer<String, FinalConfirmationRequest> expirationListener =
            (sessionId, confirmation) -> { };

    public FinalConfirmationStore() {
        this(Duration.ofMinutes(5), Clock.systemUTC());
    }

    @Autowired
    public FinalConfirmationStore(
            @Value("${ddd.final-confirmation.timeout:5m}") Duration timeout
    ) {
        this(timeout, Clock.systemUTC());
    }

    FinalConfirmationStore(Duration timeout, Clock clock) {
        if (timeout == null || timeout.isZero() || timeout.isNegative()) {
            throw new IllegalArgumentException("최종 확인 timeout은 0보다 커야 합니다.");
        }
        this.timeout = timeout;
        this.clock = clock;
        this.scheduler = Executors.newSingleThreadScheduledExecutor(runnable -> {
            Thread thread = new Thread(runnable, "confirmation-timeout");
            thread.setDaemon(true);
            return thread;
        });
    }

    public void setExpirationListener(
            BiConsumer<String, FinalConfirmationRequest> listener
    ) {
        this.expirationListener = listener == null
                ? (sessionId, confirmation) -> { } : listener;
    }

    public FinalConfirmationRequest activate(String sessionId, ConfirmationType type,
            String targetElementId, String sourceSnapshotId,
            String sourceFrameId, long sourceFrameSequence,
            FinalConfirmationSummary summary) {
        new FinalConfirmationSummaryExtractor().validate(summary);
        if (sourceFrameId == null || sourceFrameId.isBlank()
                || sourceFrameSequence < 1) {
            throw new IllegalArgumentException("최종 확인 source frame이 올바르지 않습니다.");
        }
        FinalConfirmationRequest request = new FinalConfirmationRequest(
                "confirm-" + UUID.randomUUID(), type, targetElementId,
                sourceSnapshotId, sourceFrameId, sourceFrameSequence, summary);
        State state = new State(request, clock.instant().plus(timeout));
        if (states.putIfAbsent(sessionId, state) != null) {
            throw new ConfirmationException(ErrorCode.CONFIRMATION_REQUEST_IN_PROGRESS);
        }
        state.expirationTask = scheduler.schedule(
                () -> expire(sessionId, state), timeout.toMillis(), TimeUnit.MILLISECONDS);
        return request;
    }

    public FinalConfirmationRequest activate(String sessionId, ConfirmationType type,
            String targetElementId, String sourceSnapshotId,
            FinalConfirmationSummary summary) {
        return activate(sessionId, type, targetElementId, sourceSnapshotId,
                "legacy-frame", 1L, summary);
    }

    public Optional<FinalConfirmationRequest> active(String sessionId) {
        State state = states.get(sessionId);
        if (state != null && !clock.instant().isBefore(state.expiresAt)) {
            expire(sessionId, state);
            state = null;
        }
        return state == null || state.consumed ? Optional.empty()
                : Optional.of(state.request);
    }

    public FinalConfirmationRequest requireActive(
            String sessionId, String confirmationId
    ) {
        State state = states.get(sessionId);
        if (state != null && !clock.instant().isBefore(state.expiresAt)) {
            expire(sessionId, state);
            state = null;
        }
        if (state == null) {
            Set<String> expired = expiredConfirmationIds.get(sessionId);
            if (expired != null && expired.contains(confirmationId)) {
                throw new ConfirmationException(ErrorCode.CONFIRMATION_EXPIRED);
            }
            throw new ConfirmationException(ErrorCode.CONFIRMATION_NOT_FOUND);
        }
        if (!state.request.confirmationId().equals(confirmationId)) {
            throw new ConfirmationException(ErrorCode.CONFIRMATION_ID_MISMATCH);
        }
        if (state.consumed) {
            throw new ConfirmationException(ErrorCode.CONFIRMATION_REQUEST_IN_PROGRESS);
        }
        return state.request;
    }

    public FinalConfirmationRequest consume(String sessionId, String confirmationId) {
        return consume(sessionId, confirmationId,
                "legacy-request-" + UUID.randomUUID(),
                active(sessionId).map(FinalConfirmationRequest::sourceFrameId)
                        .orElse("legacy-frame"),
                active(sessionId).map(FinalConfirmationRequest::sourceFrameSequence)
                        .orElse(1L));
    }

    public FinalConfirmationRequest consume(
            String sessionId,
            String confirmationId,
            String requestId,
            String frameId,
            long frameSequence
    ) {
        if (requestId == null || requestId.isBlank()) {
            throw new IllegalArgumentException("requestId는 필수입니다.");
        }
        Set<String> processed = processedRequestIds.computeIfAbsent(
                sessionId, ignored -> ConcurrentHashMap.newKeySet());
        if (!processed.add(requestId)) {
            throw new ConfirmationException(ErrorCode.CONFIRMATION_DUPLICATE_REQUEST);
        }
        State state = states.get(sessionId);
        if (state == null) {
            Set<String> expired = expiredConfirmationIds.get(sessionId);
            if (expired != null && expired.contains(confirmationId)) {
                throw new ConfirmationException(ErrorCode.CONFIRMATION_EXPIRED);
            }
            throw new ConfirmationException(ErrorCode.CONFIRMATION_NOT_FOUND);
        }
        if (!clock.instant().isBefore(state.expiresAt)) {
            expire(sessionId, state);
            throw new ConfirmationException(ErrorCode.CONFIRMATION_EXPIRED);
        }
        if (!state.request.confirmationId().equals(confirmationId)) {
            throw new ConfirmationException(ErrorCode.CONFIRMATION_ID_MISMATCH);
        }
        synchronized (state) {
            if (state.consumed) {
                throw new ConfirmationException(ErrorCode.CONFIRMATION_REQUEST_IN_PROGRESS);
            }
            if (!state.request.sourceFrameId().equals(frameId)
                    || state.request.sourceFrameSequence() != frameSequence) {
                throw new ConfirmationException(ErrorCode.CONFIRMATION_STALE_FRAME);
            }
            state.consumed = true;
            return state.request;
        }
    }

    public Optional<FinalConfirmationRequest> clear(String sessionId) {
        State state = states.remove(sessionId);
        if (state == null) {
            return Optional.empty();
        }
        if (state.expirationTask != null) {
            state.expirationTask.cancel(false);
        }
        return Optional.of(state.request);
    }

    public void removeSession(String sessionId) {
        clear(sessionId);
        processedRequestIds.remove(sessionId);
        expiredConfirmationIds.remove(sessionId);
    }

    private void expire(String sessionId, State expected) {
        if (states.remove(sessionId, expected)) {
            expiredConfirmationIds.computeIfAbsent(
                    sessionId, ignored -> ConcurrentHashMap.newKeySet())
                    .add(expected.request.confirmationId());
            expirationListener.accept(sessionId, expected.request);
        }
    }

    private static final class State {
        private final FinalConfirmationRequest request;
        private final Instant expiresAt;
        private volatile ScheduledFuture<?> expirationTask;
        private boolean consumed;
        private State(FinalConfirmationRequest request, Instant expiresAt) {
            this.request = request;
            this.expiresAt = expiresAt;
        }
    }
}
