package com.ddd.backend.conversation.event;

import com.ddd.backend.conversation.overlay.OverlayActionMode;
import com.ddd.backend.conversation.overlay.OverlayCoordinateSpace;
import com.ddd.backend.conversation.overlay.PublicOverlayTarget;
import com.ddd.backend.conversation.overlay.OverlayMaterializationMode;
import com.ddd.backend.conversation.overlay.PublicTargetLocator;
import com.ddd.backend.domain.session.WorkflowStatus;

import java.time.Instant;
import com.fasterxml.jackson.annotation.JsonInclude;

public record OverlayTargetEvent(
        String eventId, long eventSequence, String eventType, String sessionId,
        WorkflowStatus workflowStatus, String targetId, String pageIdentity,
        int contractVersion, OverlayMaterializationMode materializationMode,
        String sourceSnapshotId, OverlayCoordinateSpace coordinateSpace,
        PublicOverlayTarget.Rectangle rectangle, PublicOverlayTarget.Viewport viewport,
        String role, String label, String guide,
        @JsonInclude(JsonInclude.Include.NON_NULL) PublicTargetLocator locator,
        OverlayActionMode actionMode,
        Instant expiresAt, Instant occurredAt
) implements ConversationEvent {
    public OverlayTargetEvent(String eventId, long eventSequence, String eventType, String sessionId,
            WorkflowStatus workflowStatus, String targetId, String pageIdentity,
            String sourceSnapshotId, OverlayCoordinateSpace coordinateSpace,
            PublicOverlayTarget.Rectangle rectangle, PublicOverlayTarget.Viewport viewport,
            String role, String label, String guide, OverlayActionMode actionMode,
            Instant expiresAt, Instant occurredAt) {
        this(eventId, eventSequence, eventType, sessionId, workflowStatus, targetId, pageIdentity,
                1, OverlayMaterializationMode.BACKEND_VIEWPORT_RECT, sourceSnapshotId,
                coordinateSpace, rectangle, viewport, role, label, guide, null,
                actionMode, expiresAt, occurredAt);
    }
}
