package com.ddd.backend.conversation;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/** Day 1 MVP 저장소. 세션 TTL과 같은 설정값을 사용하고 Session별로 완전히 격리한다. */
@Component
public final class ConversationStateStore {

    private final ConcurrentHashMap<String, ConversationState> states = new ConcurrentHashMap<>();
    private final Duration ttl;

    public ConversationStateStore(@Value("${ddd.session-store.ttl:30m}") Duration ttl) {
        if (ttl == null || ttl.isZero() || ttl.isNegative()) {
            throw new IllegalArgumentException("대화 상태 TTL은 0보다 커야 합니다.");
        }
        this.ttl = ttl;
    }

    public ConversationState getOrCreate(String sessionId) {
        Instant now = Instant.now();
        ConversationState state = states.compute(sessionId, (key, current) -> {
            if (current == null || !current.expiresAt().isAfter(now)) {
                return new ConversationState(sessionId, now.plus(ttl));
            }
            current.refreshExpiry(now.plus(ttl));
            return current;
        });
        return state;
    }

    public Optional<ConversationState> find(String sessionId) {
        ConversationState state = states.get(sessionId);
        if (state == null) return Optional.empty();
        Instant now = Instant.now();
        if (!state.expiresAt().isAfter(now)) {
            states.remove(sessionId, state);
            return Optional.empty();
        }
        state.refreshExpiry(now.plus(ttl));
        return Optional.of(state);
    }

    public void removeSession(String sessionId) {
        if (sessionId != null) states.remove(sessionId);
    }
}
