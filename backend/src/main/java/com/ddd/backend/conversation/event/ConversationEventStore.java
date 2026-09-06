package com.ddd.backend.conversation.event;
import com.ddd.backend.domain.session.WorkflowStatus;
import org.springframework.stereotype.Component;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import com.ddd.backend.conversation.overlay.*;
@Component
public final class ConversationEventStore {
    private final ConcurrentHashMap<String, List<ConversationEvent>> events = new ConcurrentHashMap<>();
    public synchronized UserMessageAcceptedEvent accepted(String sessionId, String messageId,
            long acceptedSequence, WorkflowStatus status, Instant at) {
        var event = new UserMessageAcceptedEvent(UUID.randomUUID().toString(), lastSequence(sessionId) + 1,
                "USER_MESSAGE_ACCEPTED", sessionId, messageId, acceptedSequence, status, at);
        events.computeIfAbsent(sessionId, ignored -> new ArrayList<>()).add(event); return event;
    }
    public synchronized AiQuestionEvent question(String sessionId, String messageId, long messageSequence,
            String questionId, String text, long goalRevision, Instant at) {
        var event = new AiQuestionEvent(UUID.randomUUID().toString(), lastSequence(sessionId) + 1,
                "AI_QUESTION", sessionId, WorkflowStatus.ADDITIONAL_INFORMATION_REQUIRED, messageId,
                messageSequence, questionId, text, "QUESTION", goalRevision, at);
        events.computeIfAbsent(sessionId, ignored -> new ArrayList<>()).add(event); return event;
    }
    public synchronized AiMessageEvent message(String sessionId, String messageId, long messageSequence,
            String text, long goalRevision, WorkflowStatus status, String errorCode, Instant at) {
        var event = new AiMessageEvent(UUID.randomUUID().toString(), lastSequence(sessionId) + 1,
                "AI_MESSAGE", sessionId, status, messageId, messageSequence, text, "MESSAGE",
                goalRevision, errorCode, at);
        events.computeIfAbsent(sessionId, ignored -> new ArrayList<>()).add(event); return event;
    }
    public synchronized OverlayTargetEvent overlayTarget(PublicOverlayTarget target, Instant at) {
        var event = new OverlayTargetEvent(UUID.randomUUID().toString(), lastSequence(target.sessionId()) + 1,
                "OVERLAY_TARGET", target.sessionId(), WorkflowStatus.USER_DECISION_REQUIRED,
                target.targetId(), target.pageIdentity(), target.sourceSnapshotId(), target.coordinateSpace(),
                target.rectangle(), target.viewport(), target.role(), target.label(), target.guide(),
                target.actionMode(), target.expiresAt(), at);
        events.computeIfAbsent(target.sessionId(), ignored -> new ArrayList<>()).add(event); return event;
    }
    public synchronized OverlayClearEvent overlayClear(PublicOverlayTarget target, OverlayClearReason reason, Instant at) {
        var event = new OverlayClearEvent(UUID.randomUUID().toString(), lastSequence(target.sessionId()) + 1,
                "OVERLAY_CLEAR", target.sessionId(), target.targetId(), target.pageIdentity(),
                target.sourceSnapshotId(), reason, at);
        events.computeIfAbsent(target.sessionId(), ignored -> new ArrayList<>()).add(event); return event;
    }
    public synchronized UserActionObservedEvent userActionObserved(PublicOverlayTarget target,
            String observationId, String requestId, String resultingSnapshotId, Instant at) {
        var event = new UserActionObservedEvent(UUID.randomUUID().toString(), lastSequence(target.sessionId()) + 1,
                "USER_ACTION_OBSERVED", target.sessionId(), WorkflowStatus.AI_EXECUTING,
                observationId, requestId, target.targetId(), target.pageIdentity(), target.sourceSnapshotId(),
                resultingSnapshotId, "DOM_CHANGE_CONFIRMED", at);
        events.computeIfAbsent(target.sessionId(), ignored -> new ArrayList<>()).add(event); return event;
    }
    public synchronized long lastSequence(String sessionId) {
        var values = events.get(sessionId); return values == null || values.isEmpty() ? 0 : values.getLast().eventSequence();
    }
    public synchronized List<ConversationEvent> events(String sessionId) {
        return List.copyOf(events.getOrDefault(sessionId, List.of()));
    }
    public void removeSession(String sessionId) { events.remove(sessionId); }
}
