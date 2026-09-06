package com.ddd.backend.conversation.event;

import com.ddd.backend.conversation.overlay.OverlayClearReason;
import java.time.Instant;

public record OverlayClearEvent(
        String eventId, long eventSequence, String eventType, String sessionId,
        String targetId, String pageIdentity, String sourceSnapshotId,
        OverlayClearReason reason, Instant occurredAt
) implements ConversationEvent { }
