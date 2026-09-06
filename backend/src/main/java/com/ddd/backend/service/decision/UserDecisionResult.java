package com.ddd.backend.service.decision;

import com.ddd.backend.domain.session.DecisionType;

import java.time.Instant;
import java.util.List;

public record UserDecisionResult(
        String requestId,
        String decisionId,
        DecisionType decisionType,
        List<String> selectedOptionIds,
        String frameId,
        long frameSequence,
        String sourceSnapshotId,
        Instant decidedAt
) {
    public UserDecisionResult {
        selectedOptionIds = List.copyOf(selectedOptionIds);
    }
}
