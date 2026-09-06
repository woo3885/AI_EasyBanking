package com.ddd.backend.websocket.dto;

import com.ddd.backend.domain.session.ConfirmationType;
import com.ddd.backend.service.confirmation.FinalConfirmationRequest;
import com.ddd.backend.service.confirmation.FinalConfirmationSummary;

public record ConfirmationEventPayload(
        String confirmationId,
        ConfirmationType confirmationType,
        String sourceSnapshotId,
        String frameId,
        long frameSequence,
        FinalConfirmationSummary summary
) {
    public static ConfirmationEventPayload from(FinalConfirmationRequest request) {
        return new ConfirmationEventPayload(
                request.confirmationId(), request.confirmationType(),
                request.sourceSnapshotId(), request.sourceFrameId(),
                request.sourceFrameSequence(), request.summary());
    }

    public ConfirmationEventPayload identityOnly() {
        return new ConfirmationEventPayload(confirmationId, confirmationType,
                sourceSnapshotId, frameId, frameSequence, null);
    }
}
