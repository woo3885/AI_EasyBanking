package com.ddd.backend.conversation.event;

import com.ddd.backend.domain.session.WorkflowStatus;
import java.time.Instant;

public record UserActionObservedEvent(
        String eventId, long eventSequence, String eventType, String sessionId,
        WorkflowStatus workflowStatus, String observationId, String requestId,
        String targetId, String pageIdentity, String sourceSnapshotId,
        String publicTargetKey,
        String resultingSnapshotId, String status, Instant occurredAt
) implements ConversationEvent {
    public UserActionObservedEvent(String eventId, long eventSequence, String eventType,
            String sessionId, WorkflowStatus workflowStatus, String observationId,
            String requestId, String targetId, String pageIdentity, String sourceSnapshotId,
            String resultingSnapshotId, String status, Instant occurredAt) {
        this(eventId, eventSequence, eventType, sessionId, workflowStatus, observationId,
                requestId, targetId, pageIdentity, sourceSnapshotId, null,
                resultingSnapshotId, status, occurredAt);
    }
}
