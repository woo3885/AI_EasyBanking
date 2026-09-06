package com.ddd.backend.api.dto.conversation;

import java.time.Instant;

public record InteractionObservationAcceptedResponse(
        String sessionId, String requestId, String targetId, String pageIdentity,
        String sourceSnapshotId, String status, Instant acceptedAt
) { }
