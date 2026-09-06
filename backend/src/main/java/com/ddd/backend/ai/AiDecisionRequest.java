package com.ddd.backend.ai;

import com.ddd.backend.automation.dom.SanitizedDomSnapshot;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.Objects;

public record AiDecisionRequest(
        String userRequest,
        SanitizedDomSnapshot snapshot,
        @JsonInclude(JsonInclude.Include.NON_NULL)
        AiUserDecisionContext userDecision
) {

    public AiDecisionRequest {

        if (userRequest == null
                || userRequest.isBlank()) {

            throw new IllegalArgumentException(
                    "사용자 요청은 비어 있을 수 없습니다."
            );
        }

        userRequest =
                userRequest.trim();

        Objects.requireNonNull(
                snapshot,
                "Sanitized DOM Snapshot은 필수입니다."
        );
    }

    public AiDecisionRequest(String userRequest, SanitizedDomSnapshot snapshot) {
        this(userRequest, snapshot, null);
    }
}
