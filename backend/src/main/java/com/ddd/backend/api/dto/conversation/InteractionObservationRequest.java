package com.ddd.backend.api.dto.conversation;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import com.ddd.backend.conversation.overlay.OverlayActionMode;

public record InteractionObservationRequest(
        @NotBlank @Size(max = 128) String requestId,
        @NotBlank @Size(max = 128) String targetId,
        @NotBlank @Size(max = 128) String sourceSnapshotId,
        @Size(max = 96) String publicTargetKey,
        @Size(max = 32) String role,
        OverlayActionMode actionMode,
        LocalRectangle localRectangle,
        ClickPosition clickPosition,
        @NotBlank @Pattern(regexp = "USER_CLICK") String observationType,
        @NotNull Instant clientOccurredAt
) {
    public InteractionObservationRequest(String requestId, String targetId,
            String sourceSnapshotId, String observationType, Instant clientOccurredAt) {
        this(requestId, targetId, sourceSnapshotId, null, null, null,
                null, null, observationType, clientOccurredAt);
    }

    public record LocalRectangle(double x, double y, double width, double height) { }
    public record ClickPosition(double clientX, double clientY) { }
}
