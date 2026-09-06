package com.ddd.backend.service.decision;

import com.ddd.backend.api.dto.session.SubmitDecisionRequest;
import com.ddd.backend.websocket.dto.AutomationDecisionPrompt;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.Set;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Component
public final class UserDecisionSessionState {

    private final ConcurrentMap<String, SessionState> sessions =
            new ConcurrentHashMap<>();

    public void register(String sessionId, AutomationDecisionPrompt prompt) {
        validateSessionId(sessionId);
        sessions.computeIfAbsent(sessionId, ignored -> new SessionState())
                .register(prompt);
    }

    public void consume(
            String sessionId,
            SubmitDecisionRequest request,
            Runnable acceptedAction
    ) {
        validateSessionId(sessionId);
        SessionState state = sessions.get(sessionId);
        if (state == null) {
            throw new IllegalStateException("대기 중인 사용자 결정이 없습니다.");
        }
        state.consume(request, acceptedAction);
    }

    public void removeSession(String sessionId) {
        if (sessionId != null) {
            sessions.remove(sessionId);
        }
    }

    public Optional<UserDecisionResult> latestResult(String sessionId) {
        validateSessionId(sessionId);
        SessionState state = sessions.get(sessionId);
        return state == null ? Optional.empty() : state.latestResult();
    }

    public Optional<UserDecisionResult> takeLatestResult(String sessionId) {
        validateSessionId(sessionId);
        SessionState state = sessions.get(sessionId);
        return state == null ? Optional.empty() : state.takeLatestResult();
    }

    public AutomationDecisionPrompt pendingPrompt(String sessionId) {
        validateSessionId(sessionId);
        SessionState state = sessions.get(sessionId);
        if (state == null) {
            throw new IllegalStateException("대기 중인 사용자 결정이 없습니다.");
        }
        return state.pendingPrompt();
    }

    public AutomationDecisionPrompt pendingPrompt(
            String sessionId, SubmitDecisionRequest request) {
        validateSessionId(sessionId);
        SessionState state = sessions.get(sessionId);
        if (state == null) {
            throw new IllegalStateException("대기 중인 사용자 결정이 없습니다.");
        }
        return state.pendingPrompt(request);
    }

    private void validateSessionId(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            throw new IllegalArgumentException("세션 ID는 비어 있을 수 없습니다.");
        }
    }

    private static final class SessionState {
        private AutomationDecisionPrompt pending;
        private final Set<String> consumedDecisionIds = new HashSet<>();
        private final Set<String> consumedRequestIds = new HashSet<>();
        private UserDecisionResult latestResult;

        private synchronized void register(AutomationDecisionPrompt prompt) {
            if (pending != null) {
                consumedDecisionIds.add(pending.decisionId());
                consumedRequestIds.add(pending.requestId());
            }
            pending = prompt;
        }

        private synchronized void consume(
                SubmitDecisionRequest request,
                Runnable acceptedAction
        ) {
            if (consumedDecisionIds.contains(request.decisionId())
                    || consumedRequestIds.contains(request.requestId())) {
                throw new IllegalStateException("이미 처리된 사용자 결정 요청입니다.");
            }
            if (pending == null) {
                throw new IllegalStateException("대기 중인 사용자 결정이 없습니다.");
            }
            if (!pending.requestId().equals(request.requestId())
                    || !pending.decisionId().equals(request.decisionId())) {
                throw new IllegalStateException("현재 대기 중인 결정과 일치하지 않습니다.");
            }
            if (pending.decisionType() != request.decisionType()) {
                throw new IllegalArgumentException("사용자 결정 유형이 일치하지 않습니다.");
            }
            if (!pending.frameId().equals(request.expectedFrameId())
                    || pending.frameSequence() != request.expectedSequence()) {
                throw new IllegalStateException("오래된 Viewer Frame의 사용자 결정입니다.");
            }

            Set<String> allowed = pending.options().stream()
                    .filter(option -> !option.disabled())
                    .map(option -> option.id())
                    .collect(java.util.stream.Collectors.toUnmodifiableSet());
            if (!allowed.containsAll(request.selectedOptionIds())) {
                throw new IllegalArgumentException("허용되지 않은 선택 항목입니다.");
            }

            Set<String> required = pending.options().stream()
                    .filter(option -> option.required() && !option.disabled())
                    .map(option -> option.id())
                    .collect(java.util.stream.Collectors.toUnmodifiableSet());
            if (!request.selectedOptionIds().containsAll(required)) {
                throw new IllegalArgumentException("필수 약관 선택이 누락되었습니다.");
            }

            latestResult = new UserDecisionResult(
                    request.requestId(),
                    request.decisionId(),
                    request.decisionType(),
                    request.selectedOptionIds(),
                    request.expectedFrameId(),
                    request.expectedSequence(),
                    pending.sourceSnapshotId(),
                    java.time.Instant.now()
            );
            try {
                acceptedAction.run();
            } catch (RuntimeException exception) {
                latestResult = null;
                throw exception;
            }
            consumedDecisionIds.add(pending.decisionId());
            consumedRequestIds.add(pending.requestId());
            pending = null;
        }

        private synchronized AutomationDecisionPrompt pendingPrompt() {
            if (pending == null) {
                throw new IllegalStateException("대기 중인 사용자 결정이 없습니다.");
            }
            return pending;
        }

        private synchronized AutomationDecisionPrompt pendingPrompt(
                SubmitDecisionRequest request) {
            if (consumedDecisionIds.contains(request.decisionId())
                    || consumedRequestIds.contains(request.requestId())) {
                throw new IllegalStateException("이미 처리된 사용자 결정 요청입니다.");
            }
            return pendingPrompt();
        }

        private synchronized Optional<UserDecisionResult> latestResult() {
            return Optional.ofNullable(latestResult);
        }

        private synchronized Optional<UserDecisionResult> takeLatestResult() {
            UserDecisionResult result = latestResult;
            latestResult = null;
            return Optional.ofNullable(result);
        }
    }
}
