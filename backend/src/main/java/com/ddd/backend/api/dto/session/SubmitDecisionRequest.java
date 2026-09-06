package com.ddd.backend.api.dto.session;

import com.ddd.backend.domain.session.DecisionType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public record SubmitDecisionRequest(

        @NotBlank(message = "requestId는 필수입니다.")
        @Size(max = 100, message = "requestId는 100자를 초과할 수 없습니다.")
        String requestId,

        @NotBlank(message = "decisionId는 필수입니다.")
        @Size(max = 100, message = "decisionId는 100자를 초과할 수 없습니다.")
        String decisionId,

        @NotNull(
                message = "사용자 결정 유형은 필수입니다."
        )
        DecisionType decisionType,

        @NotNull(
                message = "선택 항목 목록은 필수입니다."
        )
        @Size(
                max = 20,
                message = "선택 항목은 20개 이하로 입력해야 합니다."
        )
        List<
                @NotBlank(
                        message = "선택 항목 ID는 비어 있을 수 없습니다."
                )
                @Size(
                        max = 100,
                        message = "선택 항목 ID는 100자를 초과할 수 없습니다."
                )
                        String
                > selectedOptionIds,

        @NotBlank(message = "expectedFrameId는 필수입니다.")
        @Size(max = 100, message = "expectedFrameId는 100자를 초과할 수 없습니다.")
        String expectedFrameId,

        @NotNull(message = "expectedSequence는 필수입니다.")
        @jakarta.validation.constraints.Positive(
                message = "expectedSequence는 1 이상이어야 합니다."
        )
        Long expectedSequence
) {

    public SubmitDecisionRequest {
        requestId = normalize(requestId);
        decisionId = normalize(decisionId);
        expectedFrameId = normalize(expectedFrameId);
        if (selectedOptionIds != null) {
            List<String> normalizedOptionIds =
                    new ArrayList<>(
                            selectedOptionIds.size()
                    );

            for (String optionId : selectedOptionIds) {
                normalizedOptionIds.add(
                        optionId == null
                                ? null
                                : optionId.trim()
                );
            }

            selectedOptionIds =
                    Collections.unmodifiableList(
                            normalizedOptionIds
                    );
        }
    }

    public SubmitDecisionRequest(
            DecisionType decisionType,
            List<String> selectedOptionIds
    ) {
        this(
                "legacy-request",
                "legacy-decision",
                decisionType,
                selectedOptionIds,
                "legacy-frame",
                1L
        );
    }

    private static String normalize(String value) {
        return value == null ? null : value.trim();
    }
}
