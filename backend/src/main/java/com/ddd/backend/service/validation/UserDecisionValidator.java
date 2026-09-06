package com.ddd.backend.service.validation;

import com.ddd.backend.domain.session.DecisionType;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Component
public class UserDecisionValidator {

    private static final int MAX_OPTION_COUNT = 20;

    public void validate(
            DecisionType decisionType,
            List<String> selectedOptionIds
    ) {
        validateRequiredValues(
                decisionType,
                selectedOptionIds
        );

        validateOptionIds(
                selectedOptionIds
        );

        validateSelectionCount(
                decisionType,
                selectedOptionIds.size()
        );
    }

    private void validateRequiredValues(
            DecisionType decisionType,
            List<String> selectedOptionIds
    ) {
        if (decisionType == null) {
            throw new IllegalArgumentException(
                    "사용자 결정 유형은 필수입니다."
            );
        }

        if (selectedOptionIds == null) {
            throw new IllegalArgumentException(
                    "선택 항목 목록은 필수입니다."
            );
        }

        if (selectedOptionIds.isEmpty()
                && decisionType != DecisionType.TERMS_AGREEMENT) {
            throw new IllegalArgumentException(
                    "선택 항목은 한 개 이상이어야 합니다."
            );
        }

        if (selectedOptionIds.size() > MAX_OPTION_COUNT) {
            throw new IllegalArgumentException(
                    "선택 항목은 20개를 초과할 수 없습니다."
            );
        }
    }

    private void validateOptionIds(
            List<String> selectedOptionIds
    ) {
        Set<String> uniqueOptionIds =
                new HashSet<>();

        for (String optionId : selectedOptionIds) {
            if (optionId == null
                    || optionId.isBlank()) {

                throw new IllegalArgumentException(
                        "선택 항목 ID는 비어 있을 수 없습니다."
                );
            }

            String normalizedOptionId =
                    optionId.trim();

            if (!uniqueOptionIds.add(
                    normalizedOptionId
            )) {
                throw new IllegalArgumentException(
                        "동일한 선택 항목을 중복해서 전달할 수 없습니다."
                );
            }
        }
    }

    private void validateSelectionCount(
            DecisionType decisionType,
            int selectedOptionCount
    ) {
        switch (decisionType) {
            case PRODUCT_SELECTION,
                 SOURCE_ACCOUNT_SELECTION,
                 RECIPIENT_SELECTION,
                 ADDITIONAL_INFORMATION -> {
                if (selectedOptionCount != 1) {
                    throw new IllegalArgumentException(
                            "해당 결정 유형은 한 개의 항목만 선택할 수 있습니다."
                    );
                }
            }

            case TERMS_AGREEMENT -> {
                // 약관은 필수·선택 항목을 각각 선택할 수 있어 복수 선택을 허용한다.
            }
        }
    }
}
