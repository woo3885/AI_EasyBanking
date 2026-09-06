package com.ddd.backend.conversation.event;

import com.ddd.backend.conversation.overlay.OverlayActionMode;
import com.ddd.backend.conversation.overlay.OverlayCoordinateSpace;
import com.ddd.backend.conversation.overlay.PublicOverlayTarget;
import com.ddd.backend.domain.session.WorkflowStatus;

import java.time.Instant;

public record OverlayTargetEvent(
        String eventId, long eventSequence, String eventType, String sessionId,
        WorkflowStatus workflowStatus, String targetId, String pageIdentity,
        String sourceSnapshotId, OverlayCoordinateSpace coordinateSpace,
        PublicOverlayTarget.Rectangle rectangle, PublicOverlayTarget.Viewport viewport,
        String role, String label, String guide, OverlayActionMode actionMode,
        Instant expiresAt, Instant occurredAt
) implements ConversationEvent { }
