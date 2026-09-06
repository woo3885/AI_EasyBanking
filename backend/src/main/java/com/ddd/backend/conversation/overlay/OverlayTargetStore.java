package com.ddd.backend.conversation.overlay;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.BiConsumer;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import jakarta.annotation.PreDestroy;

import static com.ddd.backend.conversation.overlay.OverlayTargetError.*;

/** Public DTO와 내부 elementId를 분리해 보관하는 session별 active-target store. */
@Component
public final class OverlayTargetStore {
    private final ConcurrentHashMap<String, Entry> entries = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Set<String>> processedRequests = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Set<String>> consumedTargetIds = new ConcurrentHashMap<>();
    private final Duration ttl;
    private final Clock clock;
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(runnable -> {
        Thread thread = new Thread(runnable, "overlay-target-expiration");
        thread.setDaemon(true);
        return thread;
    });
    private volatile BiConsumer<PublicOverlayTarget, OverlayClearReason> clearListener = (target, reason) -> { };

    @Autowired
    public OverlayTargetStore(@Value("${ddd.overlay-target.ttl:2m}") Duration ttl) {
        this(ttl, Clock.systemUTC());
    }

    OverlayTargetStore(Duration ttl, Clock clock) {
        if (ttl == null || ttl.isZero() || ttl.isNegative()) throw new IllegalArgumentException("target TTL은 0보다 커야 합니다.");
        this.ttl = ttl;
        this.clock = clock;
    }

    public void setClearListener(BiConsumer<PublicOverlayTarget, OverlayClearReason> listener) {
        this.clearListener = listener == null ? (target, reason) -> { } : listener;
    }

    public PublicOverlayTarget replace(PublicOverlayTarget target, String internalElementId, String sourceFingerprint) {
        validateTarget(target);
        if (internalElementId == null || internalElementId.isBlank()) throw new IllegalArgumentException("internalElementId는 필수입니다.");
        if (sourceFingerprint == null || sourceFingerprint.isBlank()) throw new IllegalArgumentException("sourceFingerprint는 필수입니다.");
        Entry replacement = new Entry(target, internalElementId, sourceFingerprint);
        Entry previous = entries.put(target.sessionId(), replacement);
        if (previous != null && previous.consumedAt == null) {
            previous.cancelExpiration();
            clearListener.accept(previous.publicView(), OverlayClearReason.REPLACED);
        }
        long delay = Math.max(0, Duration.between(clock.instant(), target.expiresAt()).toMillis());
        replacement.expirationTask = scheduler.schedule(
                () -> expire(target.sessionId(), replacement), delay, TimeUnit.MILLISECONDS);
        return replacement.publicView();
    }

    public Optional<PublicOverlayTarget> active(String sessionId, String pageIdentity) {
        Entry entry = entries.get(sessionId);
        if (entry == null) return Optional.empty();
        synchronized (entry) {
            if (!entry.target.expiresAt().isAfter(clock.instant())) {
                entries.remove(sessionId, entry);
                entry.cancelExpiration();
                clearListener.accept(entry.publicView(), OverlayClearReason.EXPIRED);
                return Optional.empty();
            }
            if (entry.consumedAt != null || !entry.target.pageIdentity().equals(pageIdentity)) return Optional.empty();
            return Optional.of(entry.publicView());
        }
    }

    public ClaimedTarget claim(String sessionId, String requestId, String targetId,
            String pageIdentity, String sourceSnapshotId) {
        requireText(sessionId); requireText(requestId); requireText(targetId);
        requireText(pageIdentity); requireText(sourceSnapshotId);
        if (!processedRequests.computeIfAbsent(sessionId, ignored -> ConcurrentHashMap.newKeySet()).add(requestId)) {
            throw new OverlayTargetException(OBSERVATION_DUPLICATE_REQUEST);
        }
        Entry entry = entries.get(sessionId);
        if (entry == null) {
            if (consumedTargetIds.getOrDefault(sessionId, Set.of()).contains(targetId)) {
                throw new OverlayTargetException(TARGET_ALREADY_CONSUMED);
            }
            throw new OverlayTargetException(TARGET_NOT_FOUND);
        }
        synchronized (entry) {
            if (!entry.target.expiresAt().isAfter(clock.instant())) {
                entries.remove(sessionId, entry);
                entry.cancelExpiration();
                clearListener.accept(entry.publicView(), OverlayClearReason.EXPIRED);
                throw new OverlayTargetException(TARGET_EXPIRED);
            }
            if (entry.consumedAt != null) throw new OverlayTargetException(TARGET_ALREADY_CONSUMED);
            if (entry.inProgress) throw new OverlayTargetException(OBSERVATION_IN_PROGRESS);
            if (!entry.target.targetId().equals(targetId)) throw new OverlayTargetException(TARGET_ID_MISMATCH);
            if (!entry.target.pageIdentity().equals(pageIdentity)) throw new OverlayTargetException(TARGET_STALE_PAGE);
            if (!entry.target.sourceSnapshotId().equals(sourceSnapshotId)) throw new OverlayTargetException(TARGET_STALE_SNAPSHOT);
            entry.inProgress = true;
            return new ClaimedTarget(entry.publicView(), entry.internalElementId, entry.sourceFingerprint);
        }
    }

    public PublicOverlayTarget consume(String sessionId, String targetId) {
        Entry entry = entries.get(sessionId);
        if (entry == null) throw new OverlayTargetException(TARGET_NOT_FOUND);
        synchronized (entry) {
            if (!entry.target.targetId().equals(targetId)) throw new OverlayTargetException(TARGET_ID_MISMATCH);
            if (entry.consumedAt != null) throw new OverlayTargetException(TARGET_ALREADY_CONSUMED);
            entry.consumedAt = clock.instant();
            entry.inProgress = false;
            PublicOverlayTarget consumed = entry.publicView();
            entries.remove(sessionId, entry);
            entry.cancelExpiration();
            consumedTargetIds.computeIfAbsent(sessionId, ignored -> ConcurrentHashMap.newKeySet())
                    .add(targetId);
            clearListener.accept(consumed, OverlayClearReason.USER_ACTION);
            return consumed;
        }
    }

    public Optional<PublicOverlayTarget> clear(String sessionId, OverlayClearReason reason) {
        Entry removed = entries.remove(sessionId);
        if (removed == null) return Optional.empty();
        removed.cancelExpiration();
        PublicOverlayTarget target = removed.publicView();
        clearListener.accept(target, reason);
        return Optional.of(target);
    }

    public void clearIfSnapshotChanged(String sessionId, String currentSnapshotId) {
        Entry entry = entries.get(sessionId);
        if (entry != null && !entry.target.sourceSnapshotId().equals(currentSnapshotId)) {
            clear(sessionId, OverlayClearReason.SNAPSHOT_CHANGED);
        }
    }

    public void removeSession(String sessionId) {
        clear(sessionId, OverlayClearReason.SESSION_TERMINATED);
        processedRequests.remove(sessionId);
        consumedTargetIds.remove(sessionId);
    }

    private void expire(String sessionId, Entry expected) {
        if (entries.remove(sessionId, expected)) {
            clearListener.accept(expected.publicView(), OverlayClearReason.EXPIRED);
        }
    }

    @PreDestroy
    void close() { scheduler.shutdownNow(); }

    public Instant expiresAt() { return clock.instant().plus(ttl); }

    private void validateTarget(PublicOverlayTarget target) {
        if (target == null || target.coordinateSpace() != OverlayCoordinateSpace.VIEWPORT_CSS_PX) throw new IllegalArgumentException("target 좌표계가 올바르지 않습니다.");
        requireText(target.targetId()); requireText(target.sessionId()); requireText(target.pageIdentity());
        requireText(target.sourceSnapshotId()); requireText(target.role()); requireText(target.label()); requireText(target.guide());
        if (target.actionMode() != OverlayActionMode.GUIDE_USER_CLICK
                || target.label().length() > 120 || target.guide().length() > 200
                || target.label().contains("<") || target.label().contains(">")
                || target.guide().contains("<") || target.guide().contains(">")) {
            throw new IllegalArgumentException("target 공개 문자열이 올바르지 않습니다.");
        }
        var r = target.rectangle(); var v = target.viewport();
        if (r == null || v == null || !finite(r.x(), r.y(), r.width(), r.height(), v.width(), v.height())
                || r.width() <= 0 || r.height() <= 0 || v.width() <= 0 || v.height() <= 0
                || r.x() < -r.width() || r.y() < -r.height() || r.x() > v.width() || r.y() > v.height()) {
            throw new IllegalArgumentException("target rectangle 또는 viewport가 올바르지 않습니다.");
        }
        if (target.expiresAt() == null || !target.expiresAt().isAfter(target.createdAt())) throw new IllegalArgumentException("target 만료시각이 올바르지 않습니다.");
    }

    private boolean finite(double... values) {
        for (double value : values) if (!Double.isFinite(value)) return false;
        return true;
    }
    private void requireText(String value) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException("target identity가 올바르지 않습니다.");
    }

    public record ClaimedTarget(PublicOverlayTarget target, String internalElementId, String sourceFingerprint) { }
    private static final class Entry {
        private final PublicOverlayTarget target;
        private final String internalElementId;
        private final String sourceFingerprint;
        private Instant consumedAt;
        private boolean inProgress;
        private ScheduledFuture<?> expirationTask;
        private Entry(PublicOverlayTarget target, String internalElementId, String sourceFingerprint) { this.target = target; this.internalElementId = internalElementId; this.sourceFingerprint = sourceFingerprint; }
        private PublicOverlayTarget publicView() { return new PublicOverlayTarget(target.targetId(), target.sessionId(), target.pageIdentity(), target.sourceSnapshotId(), target.coordinateSpace(), target.rectangle(), target.viewport(), target.role(), target.label(), target.guide(), target.actionMode(), target.createdAt(), target.expiresAt(), consumedAt); }
        private void cancelExpiration() { if (expirationTask != null) expirationTask.cancel(false); }
    }
}
