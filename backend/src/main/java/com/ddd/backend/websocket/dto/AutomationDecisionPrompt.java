package com.ddd.backend.websocket.dto;

import com.ddd.backend.domain.session.DecisionType;

import java.util.List;
import java.util.Objects;

public record AutomationDecisionPrompt(
        String requestId,
        String decisionId,
        DecisionType decisionType,
        List<AutomationDecisionOption> options,
        String frameId,
        long frameSequence,
        String sourceSnapshotId
) {
    public AutomationDecisionPrompt {
        if (requestId == null || requestId.isBlank()
                || decisionId == null || decisionId.isBlank()) {
            throw new IllegalArgumentException("결정 requestId와 decisionId는 필수입니다.");
        }
        Objects.requireNonNull(decisionType, "결정 유형은 필수입니다.");
        options = List.copyOf(options);
        if (options.isEmpty() || options.size() > 20) {
            throw new IllegalArgumentException("결정 선택 항목은 1개 이상 20개 이하여야 합니다.");
        }
        if (options.stream().map(AutomationDecisionOption::id).distinct().count()
                != options.size()) {
            throw new IllegalArgumentException("결정 선택 항목 ID는 중복될 수 없습니다.");
        }
        if (frameId == null || frameId.isBlank() || frameSequence < 1) {
            throw new IllegalArgumentException("결정 Frame 정보가 올바르지 않습니다.");
        }
        if (sourceSnapshotId == null || sourceSnapshotId.isBlank()) {
            throw new IllegalArgumentException("원본 Snapshot ID는 필수입니다.");
        }
        requestId = requestId.trim();
        decisionId = decisionId.trim();
        frameId = frameId.trim();
        sourceSnapshotId = sourceSnapshotId.trim();
    }

    public AutomationDecisionPrompt(
            String requestId, String decisionId, DecisionType decisionType,
            List<AutomationDecisionOption> options, String frameId, long frameSequence
    ) {
        this(requestId, decisionId, decisionType, options, frameId,
                frameSequence, "legacy-snapshot");
    }
}
