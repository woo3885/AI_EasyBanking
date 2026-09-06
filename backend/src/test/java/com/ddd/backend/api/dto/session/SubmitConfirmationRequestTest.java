package com.ddd.backend.api.dto.session;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SubmitConfirmationRequestTest {

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
    void 승인_요청은_검증을_통과한다() {
        SubmitConfirmationRequest request =
                new SubmitConfirmationRequest(
                        "confirm-001",
                        true
                );

        Set<ConstraintViolation<SubmitConfirmationRequest>>
                violations =
                validator.validate(request);

        assertTrue(violations.isEmpty());
    }

    @Test
    void 거절_요청도_검증을_통과한다() {
        SubmitConfirmationRequest request =
                new SubmitConfirmationRequest(
                        "confirm-001",
                        false
                );

        Set<ConstraintViolation<SubmitConfirmationRequest>>
                violations =
                validator.validate(request);

        assertTrue(violations.isEmpty());
    }

    @Test
    void 최종_확인_ID가_공백이면_검증에_실패한다() {
        SubmitConfirmationRequest request =
                new SubmitConfirmationRequest(
                        "   ",
                        true
                );

        Set<ConstraintViolation<SubmitConfirmationRequest>>
                violations =
                validator.validate(request);

        assertTrue(
                containsMessage(
                        violations,
                        "최종 확인 ID는 필수입니다."
                )
        );
    }

    @Test
    void 승인_여부가_없으면_검증에_실패한다() {
        SubmitConfirmationRequest request =
                new SubmitConfirmationRequest(
                        "confirm-001",
                        null
                );

        Set<ConstraintViolation<SubmitConfirmationRequest>>
                violations =
                validator.validate(request);

        assertTrue(
                containsMessage(
                        violations,
                        "승인 여부는 필수입니다."
                )
        );
    }

    @Test
    void 최종_확인_ID의_앞뒤_공백을_제거한다() {
        SubmitConfirmationRequest request =
                new SubmitConfirmationRequest(
                        "  confirm-001  ",
                        true
                );

        assertEquals(
                "confirm-001",
                request.confirmationId()
        );
    }

    @Test
    void 최종_확인_ID가_100자를_초과하면_검증에_실패한다() {
        SubmitConfirmationRequest request =
                new SubmitConfirmationRequest(
                        "a".repeat(101),
                        true
                );

        Set<ConstraintViolation<SubmitConfirmationRequest>>
                violations =
                validator.validate(request);

        assertTrue(
                containsMessage(
                        violations,
                        "최종 확인 ID는 100자를 초과할 수 없습니다."
                )
        );
    }

    @Test
    void frame_identity와_requestId가_없으면_검증에_실패한다() {
        SubmitConfirmationRequest request = new SubmitConfirmationRequest(
                null, "confirm-001", true, null, null);

        Set<ConstraintViolation<SubmitConfirmationRequest>> violations =
                validator.validate(request);

        assertTrue(containsMessage(violations, "requestId는 필수입니다."));
        assertTrue(containsMessage(violations, "expectedFrameId는 필수입니다."));
        assertTrue(containsMessage(violations, "expectedSequence는 필수입니다."));
    }

    @Test
    void expectedSequence는_양수여야_한다() {
        SubmitConfirmationRequest request = new SubmitConfirmationRequest(
                "req-001", "confirm-001", true, "frm-001", 0L);

        assertTrue(containsMessage(
                validator.validate(request),
                "expectedSequence는 1 이상이어야 합니다."));
    }

    private boolean containsMessage(
            Set<ConstraintViolation<SubmitConfirmationRequest>>
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
