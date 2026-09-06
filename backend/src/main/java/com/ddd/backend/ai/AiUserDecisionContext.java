package com.ddd.backend.ai;

import com.ddd.backend.domain.session.DecisionType;

import java.util.List;
import java.util.Objects;

public record AiUserDecisionContext(
        String decisionId,
        DecisionType decisionType,
        List<String> selectedOptionIds,
        String sourceSnapshotId
) {
    public AiUserDecisionContext {
        if (decisionId == null || decisionId.isBlank()
                || sourceSnapshotId == null || sourceSnapshotId.isBlank()) {
            throw new IllegalArgumentException("결정 ID와 원본 Snapshot ID는 필수입니다.");
        }
        Objects.requireNonNull(decisionType, "결정 유형은 필수입니다.");
        selectedOptionIds = List.copyOf(selectedOptionIds);
        decisionId = decisionId.trim();
        sourceSnapshotId = sourceSnapshotId.trim();
    }
}
