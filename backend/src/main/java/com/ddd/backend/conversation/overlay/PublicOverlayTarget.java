package com.ddd.backend.conversation.overlay;

import java.time.Instant;
import com.fasterxml.jackson.annotation.JsonInclude;

public record PublicOverlayTarget(
        int contractVersion,
        OverlayMaterializationMode materializationMode,
        String targetId,
        String sessionId,
        String pageIdentity,
        String sourceSnapshotId,
        OverlayCoordinateSpace coordinateSpace,
        Rectangle rectangle,
        Viewport viewport,
        String role,
        String label,
        String guide,
        @JsonInclude(JsonInclude.Include.NON_NULL) PublicTargetLocator locator,
        OverlayActionMode actionMode,
        Instant createdAt,
        Instant expiresAt,
        Instant consumedAt
) {
    public PublicOverlayTarget(
            String targetId, String sessionId, String pageIdentity, String sourceSnapshotId,
            OverlayCoordinateSpace coordinateSpace, Rectangle rectangle, Viewport viewport,
            String role, String label, String guide, OverlayActionMode actionMode,
            Instant createdAt, Instant expiresAt, Instant consumedAt
    ) {
        this(1, OverlayMaterializationMode.BACKEND_VIEWPORT_RECT, targetId, sessionId,
                pageIdentity, sourceSnapshotId, coordinateSpace, rectangle, viewport,
                role, label, guide, null, actionMode, createdAt, expiresAt, consumedAt);
    }

    public record Rectangle(double x, double y, double width, double height) { }
    public record Viewport(double width, double height) { }
}
