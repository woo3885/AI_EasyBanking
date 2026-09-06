package com.ddd.backend.ai;

import com.ddd.backend.automation.BrowserActionExecutionResult;
import com.ddd.backend.automation.BrowserActionExecutionStatus;
import com.ddd.backend.automation.BrowserActionType;
import com.ddd.backend.automation.dom.SanitizedDomSnapshot;

import java.util.Objects;

public record AiDecisionExecutionResult(
        String snapshotId,
        BrowserActionType aiActionType,
        BrowserActionType executedActionType,
        BrowserActionExecutionStatus status,
        String message,
        String actionKey
) {

    public AiDecisionExecutionResult {

        if (snapshotId == null
                || snapshotId.isBlank()) {

            throw new IllegalArgumentException(
                    "snapshotId는 필수입니다."
            );
        }

        Objects.requireNonNull(
                aiActionType,
                "AI Action Type은 필수입니다."
        );

        Objects.requireNonNull(
                executedActionType,
                "실제 처리 Action Type은 필수입니다."
        );

        Objects.requireNonNull(
                status,
                "실행 상태는 필수입니다."
        );

        if (actionKey == null || actionKey.isBlank()) {
            throw new IllegalArgumentException("actionKey는 필수입니다.");
        }
    }

    public static AiDecisionExecutionResult from(
            SanitizedDomSnapshot snapshot,
            AiDecisionResponse aiResponse,
            BrowserActionExecutionResult executionResult
    ) {
        Objects.requireNonNull(
                snapshot,
                "SanitizedDomSnapshot은 필수입니다."
        );

        Objects.requireNonNull(
                aiResponse,
                "AiDecisionResponse는 필수입니다."
        );

        Objects.requireNonNull(
                executionResult,
                "BrowserActionExecutionResult는 필수입니다."
        );

        return new AiDecisionExecutionResult(
                snapshot.snapshotId(),
                aiResponse.actionType(),
                executionResult.actionType(),
                executionResult.status(),
                executionResult.message(),
                actionKey(snapshot, aiResponse)
        );
    }

    private static String actionKey(
            SanitizedDomSnapshot snapshot,
            AiDecisionResponse response
    ) {
        String page = snapshot.page() == null ? "" : snapshot.page().url();
        String target = response.elementId() == null ? "" : response.elementId()
                .replaceFirst("^el-[a-zA-Z0-9]+-", "el-");
        return Integer.toHexString(Objects.hash(
                page, response.actionType(), target, response.value()));
    }
}
