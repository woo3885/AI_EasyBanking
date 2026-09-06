package com.ddd.backend.service.confirmation;

import com.ddd.backend.domain.session.ConfirmationType;

public record FinalConfirmationRequest(
        String confirmationId,
        ConfirmationType confirmationType,
        String confirmationTargetElementId,
        String sourceSnapshotId,
        String sourceFrameId,
        long sourceFrameSequence,
        FinalConfirmationSummary summary
) {
    public FinalConfirmationRequest(
            String confirmationId,
            ConfirmationType confirmationType,
            String confirmationTargetElementId,
            String sourceSnapshotId,
            FinalConfirmationSummary summary
    ) {
        this(confirmationId, confirmationType, confirmationTargetElementId,
                sourceSnapshotId, "legacy-frame", 1L, summary);
    }
}
