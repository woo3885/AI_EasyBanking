package com.ddd.backend.conversation.gate;

import com.ddd.backend.conversation.agent.ConversationAgentDecision;
import com.ddd.backend.conversation.agent.ConversationInteractionMode;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** Secure/Risk/Final 상태에서는 AI와 DOM observation 재진입을 막는 session latch. */
@Component
public final class ConversationProtectedGateRegistry {
    private static final Set<ConversationInteractionMode> PROTECTED_MODES = Set.of(
            ConversationInteractionMode.SECURE_INPUT_REQUIRED,
            ConversationInteractionMode.RISK_WARNING,
            ConversationInteractionMode.FINAL_CONFIRMATION_REQUIRED);

    private final ConcurrentHashMap<String, State> states = new ConcurrentHashMap<>();

    public ConversationProtectedGate activate(String sessionId, ConversationAgentDecision decision) {
        if (!PROTECTED_MODES.contains(decision.mode())) {
            throw new IllegalArgumentException("보호 Gate mode가 아닙니다.");
        }
        ConversationProtectedGate candidate = new ConversationProtectedGate(
                "gate-" + UUID.randomUUID(), sessionId, decision.requestMessageId(),
                decision.mode(), decision.sourceSnapshotId(), Instant.now());
        State state = states.computeIfAbsent(sessionId, ignored -> new State());
        synchronized (state) {
            if (state.active == null) {
                state.active = candidate;
                return candidate;
            }
            if (state.active.requestMessageId().equals(decision.requestMessageId())
                    && state.active.mode() == decision.mode()
                    && state.active.sourceSnapshotId().equals(decision.sourceSnapshotId())) {
                return state.active;
            }
            throw new IllegalStateException("다른 보호 Gate가 이미 활성 상태입니다.");
        }
    }

    public Optional<ConversationProtectedGate> active(String sessionId) {
        State state = states.get(sessionId);
        if (state == null) return Optional.empty();
        synchronized (state) {
            return Optional.ofNullable(state.active);
        }
    }

    public boolean blocksAutomation(String sessionId) {
        return active(sessionId).isPresent();
    }

    public ConversationProtectedGate resolve(
            String sessionId, String gateId, String requestId
    ) {
        if (requestId == null || requestId.isBlank()) {
            throw new IllegalArgumentException("requestId는 필수입니다.");
        }
        State state = states.get(sessionId);
        if (state == null) throw new IllegalStateException("활성 보호 Gate가 없습니다.");
        synchronized (state) {
            if (!state.processedRequestIds.add(requestId)) {
                throw new IllegalStateException("이미 처리한 보호 Gate 요청입니다.");
            }
            if (state.active == null || !state.active.gateId().equals(gateId)) {
                throw new IllegalStateException("보호 Gate identity가 일치하지 않습니다.");
            }
            ConversationProtectedGate resolved = state.active;
            state.active = null;
            return resolved;
        }
    }

    public void removeSession(String sessionId) {
        if (sessionId != null) states.remove(sessionId);
    }

    private static final class State {
        private ConversationProtectedGate active;
        private final Set<String> processedRequestIds = ConcurrentHashMap.newKeySet();
    }
}
