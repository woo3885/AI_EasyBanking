package com.ddd.backend.service.action;

import org.springframework.stereotype.Component;

import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.locks.ReentrantLock;

@Component
public final class PublicBrowserActionSessionState {

    /*
     * Trackpad 등에서 지나치게 빠른 SCROLL 요청이
     * 들어오는 것을 제한한다.
     *
     * 세션당 최대 약 20 request/sec.
     */
    private static final long
            MIN_SCROLL_INTERVAL_NANOS =
            50_000_000L;

    private final BrowserActionRequestRegistry
            requestRegistry;

    private final ConcurrentMap<String, ReentrantLock>
            sessionLocks =
            new ConcurrentHashMap<>();

    private final ConcurrentMap<String, Long>
            lastScrollAcceptedAt =
            new ConcurrentHashMap<>();

    public PublicBrowserActionSessionState(
            BrowserActionRequestRegistry requestRegistry
    ) {
        this.requestRegistry =
                Objects.requireNonNull(
                        requestRegistry,
                        "BrowserActionRequestRegistry는 필수입니다."
                );
    }

    public ReentrantLock lockFor(
            String sessionId
    ) {
        validateSessionId(
                sessionId
        );

        return sessionLocks.computeIfAbsent(
                sessionId,
                ignored ->
                        new ReentrantLock()
        );
    }

    public boolean containsRequest(
            String sessionId,
            String requestId
    ) {
        return requestRegistry.contains(
                sessionId,
                requestId
        );
    }

    public boolean reserveRequest(
            String sessionId,
            String requestId
    ) {
        return requestRegistry.reserve(
                sessionId,
                requestId
        );
    }

    /*
     * 반드시 Session lock을 잡은 상태에서 호출한다.
     */
    public boolean allowScrollNow(
            String sessionId
    ) {
        validateSessionId(
                sessionId
        );

        long now =
                System.nanoTime();

        Long previous =
                lastScrollAcceptedAt.get(
                        sessionId
                );

        if (previous != null
                && now - previous
                < MIN_SCROLL_INTERVAL_NANOS) {

            return false;
        }

        lastScrollAcceptedAt.put(
                sessionId,
                now
        );

        return true;
    }

    public void removeSession(
            String sessionId
    ) {
        if (sessionId == null
                || sessionId.isBlank()) {

            return;
        }

        requestRegistry.removeSession(
                sessionId
        );

        sessionLocks.remove(
                sessionId
        );

        lastScrollAcceptedAt.remove(
                sessionId
        );
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
}