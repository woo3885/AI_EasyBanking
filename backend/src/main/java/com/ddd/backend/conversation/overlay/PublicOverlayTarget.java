package com.ddd.backend.conversation.overlay;

import java.time.Instant;

public record PublicOverlayTarget(
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
        OverlayActionMode actionMode,
        Instant createdAt,
        Instant expiresAt,
        Instant consumedAt
) {
    public record Rectangle(double x, double y, double width, double height) { }
    public record Viewport(double width, double height) { }
}
