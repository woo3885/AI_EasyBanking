package com.ddd.backend.api.dto.session;

import com.ddd.backend.domain.session.DecisionType;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SubmitDecisionRequestTest {

    private ValidatorFactory validatorFactory;
    private Validator validator;

    @BeforeEach
    void setUp() {
        validatorFactory =
                Validation.buildDefaultValidatorFactory();

        validator =
                validatorFactory.getValidator();
    }

    @AfterEach
    void tearDown() {
        validatorFactory.close();
    }

    @Test
    void 올바른_사용자_결정_요청은_검증을_통과한다() {
        SubmitDecisionRequest request =
                new SubmitDecisionRequest(
                        DecisionType.PRODUCT_SELECTION,
                        List.of("deposit-product-001")
                );

        Set<ConstraintViolation<SubmitDecisionRequest>>
                violations =
                validator.validate(request);

        assertTrue(violations.isEmpty());
    }

    @Test
    void 결정_유형이_없으면_검증에_실패한다() {
        SubmitDecisionRequest request =
                new SubmitDecisionRequest(
                        null,
                        List.of("deposit-product-001")
                );

        Set<ConstraintViolation<SubmitDecisionRequest>>
                violations =
                validator.validate(request);

        assertTrue(
                containsMessage(
                        violations,
                        "사용자 결정 유형은 필수입니다."
                )
        );
    }

    @Test
    void 선택_항목_목록이_없으면_검증에_실패한다() {
        SubmitDecisionRequest request =
                new SubmitDecisionRequest(
                        DecisionType.PRODUCT_SELECTION,
                        null
                );

        Set<ConstraintViolation<SubmitDecisionRequest>>
                violations =
                validator.validate(request);

        assertTrue(
                containsMessage(
                        violations,
                        "선택 항목 목록은 필수입니다."
                )
        );
    }

    @Test
    void 선택_항목이_비어_있어도_DTO_검증을_통과한다() {
        SubmitDecisionRequest request =
                new SubmitDecisionRequest(
                        DecisionType.PRODUCT_SELECTION,
                        List.of()
                );

        Set<ConstraintViolation<SubmitDecisionRequest>>
                violations =
                validator.validate(request);

        assertTrue(violations.isEmpty());
    }

    @Test
    void 선택_항목_ID가_공백이면_검증에_실패한다() {
        SubmitDecisionRequest request =
                new SubmitDecisionRequest(
                        DecisionType.PRODUCT_SELECTION,
                        List.of("   ")
                );

        Set<ConstraintViolation<SubmitDecisionRequest>>
                violations =
                validator.validate(request);

        assertTrue(
                containsMessage(
                        violations,
                        "선택 항목 ID는 비어 있을 수 없습니다."
                )
        );
    }

    @Test
    void 선택_항목이_20개를_초과하면_검증에_실패한다() {
        List<String> optionIds =
                IntStream.rangeClosed(1, 21)
                        .mapToObj(
                                number ->
                                        "option-" + number
                        )
                        .toList();

        SubmitDecisionRequest request =
                new SubmitDecisionRequest(
                        DecisionType.TERMS_AGREEMENT,
                        optionIds
                );

        Set<ConstraintViolation<SubmitDecisionRequest>>
                violations =
                validator.validate(request);

        assertTrue(
                containsMessage(
                        violations,
                        "선택 항목은 20개 이하로 입력해야 합니다."
                )
        );
    }

    @Test
    void 선택_항목_ID의_앞뒤_공백을_제거한다() {
        SubmitDecisionRequest request =
                new SubmitDecisionRequest(
                        DecisionType.PRODUCT_SELECTION,
                        List.of("  product-001  ")
                );

        assertEquals(
                List.of("product-001"),
                request.selectedOptionIds()
        );
    }

    @Test
    void 외부에서_전달한_목록이_변경되어도_요청값은_변경되지_않는다() {
        List<String> optionIds =
                new ArrayList<>();

        optionIds.add("product-001");

        SubmitDecisionRequest request =
                new SubmitDecisionRequest(
                        DecisionType.PRODUCT_SELECTION,
                        optionIds
                );

        optionIds.add("product-002");

        assertEquals(
                List.of("product-001"),
                request.selectedOptionIds()
        );

        assertThrows(
                UnsupportedOperationException.class,
                () -> request
                        .selectedOptionIds()
                        .add("product-003")
        );
    }

    private boolean containsMessage(
            Set<ConstraintViolation<SubmitDecisionRequest>>
                    violations,
            String message
    ) {
        return violations.stream()
                .anyMatch(
                        violation ->
                                violation
                                        .getMessage()
                                        .equals(message)
                );
    }
}
