package com.ddd.backend.service.validation;

import com.ddd.backend.domain.session.DecisionType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class UserDecisionValidatorTest {

    private UserDecisionValidator validator;

    @BeforeEach
    void setUp() {
        validator =
                new UserDecisionValidator();
    }

    @ParameterizedTest
    @EnumSource(
            value = DecisionType.class,
            names = {
                    "PRODUCT_SELECTION",
                    "SOURCE_ACCOUNT_SELECTION",
                    "RECIPIENT_SELECTION",
                    "ADDITIONAL_INFORMATION"
            }
    )
    void 단일_선택_유형은_한_개의_항목을_허용한다(
            DecisionType decisionType
    ) {
        assertDoesNotThrow(
                () -> validator.validate(
                        decisionType,
                        List.of("option-001")
                )
        );
    }

    @ParameterizedTest
    @EnumSource(
            value = DecisionType.class,
            names = {
                    "PRODUCT_SELECTION",
                    "SOURCE_ACCOUNT_SELECTION",
                    "RECIPIENT_SELECTION",
                    "ADDITIONAL_INFORMATION"
            }
    )
    void 단일_선택_유형에_여러_항목을_전달하면_실패한다(
            DecisionType decisionType
    ) {
        IllegalArgumentException exception =
                assertThrows(
                        IllegalArgumentException.class,
                        () -> validator.validate(
                                decisionType,
                                List.of(
                                        "option-001",
                                        "option-002"
                                )
                        )
                );

        assertEquals(
                "해당 결정 유형은 한 개의 항목만 선택할 수 있습니다.",
                exception.getMessage()
        );
    }

    @Test
    void 약관_동의는_여러_항목을_선택할_수_있다() {
        assertDoesNotThrow(
                () -> validator.validate(
                        DecisionType.TERMS_AGREEMENT,
                        List.of(
                                "required-term-001",
                                "required-term-002",
                                "optional-term-001"
                        )
                )
        );
    }

    @Test
    void 결정_유형이_없으면_실패한다() {
        IllegalArgumentException exception =
                assertThrows(
                        IllegalArgumentException.class,
                        () -> validator.validate(
                                null,
                                List.of("option-001")
                        )
                );

        assertEquals(
                "사용자 결정 유형은 필수입니다.",
                exception.getMessage()
        );
    }

    @Test
    void 선택_항목_목록이_없으면_실패한다() {
        IllegalArgumentException exception =
                assertThrows(
                        IllegalArgumentException.class,
                        () -> validator.validate(
                                DecisionType.PRODUCT_SELECTION,
                                null
                        )
                );

        assertEquals(
                "선택 항목 목록은 필수입니다.",
                exception.getMessage()
        );
    }

    @Test
    void 선택_항목이_비어_있으면_실패한다() {
        IllegalArgumentException exception =
                assertThrows(
                        IllegalArgumentException.class,
                        () -> validator.validate(
                                DecisionType.PRODUCT_SELECTION,
                                List.of()
                        )
                );

        assertEquals(
                "선택 항목은 한 개 이상이어야 합니다.",
                exception.getMessage()
        );
    }

    @Test
    void 선택_항목_ID가_공백이면_실패한다() {
        IllegalArgumentException exception =
                assertThrows(
                        IllegalArgumentException.class,
                        () -> validator.validate(
                                DecisionType.PRODUCT_SELECTION,
                                List.of("   ")
                        )
                );

        assertEquals(
                "선택 항목 ID는 비어 있을 수 없습니다.",
                exception.getMessage()
        );
    }

    @Test
    void 선택_항목_ID가_null이면_실패한다() {
        List<String> optionIds =
                new ArrayList<>();

        optionIds.add(null);

        IllegalArgumentException exception =
                assertThrows(
                        IllegalArgumentException.class,
                        () -> validator.validate(
                                DecisionType.PRODUCT_SELECTION,
                                optionIds
                        )
                );

        assertEquals(
                "선택 항목 ID는 비어 있을 수 없습니다.",
                exception.getMessage()
        );
    }

    @Test
    void 동일한_선택_항목_ID를_중복해서_전달하면_실패한다() {
        IllegalArgumentException exception =
                assertThrows(
                        IllegalArgumentException.class,
                        () -> validator.validate(
                                DecisionType.TERMS_AGREEMENT,
                                List.of(
                                        "term-001",
                                        "term-001"
                                )
                        )
                );

        assertEquals(
                "동일한 선택 항목을 중복해서 전달할 수 없습니다.",
                exception.getMessage()
        );
    }

    @Test
    void 공백을_제거했을_때_같은_ID도_중복으로_판정한다() {
        IllegalArgumentException exception =
                assertThrows(
                        IllegalArgumentException.class,
                        () -> validator.validate(
                                DecisionType.TERMS_AGREEMENT,
                                List.of(
                                        "term-001",
                                        "  term-001  "
                                )
                        )
                );

        assertEquals(
                "동일한 선택 항목을 중복해서 전달할 수 없습니다.",
                exception.getMessage()
        );
    }

    @Test
    void 선택_항목이_20개를_초과하면_실패한다() {
        List<String> optionIds =
                new ArrayList<>();

        for (int index = 1; index <= 21; index++) {
            optionIds.add(
                    "term-" + index
            );
        }

        IllegalArgumentException exception =
                assertThrows(
                        IllegalArgumentException.class,
                        () -> validator.validate(
                                DecisionType.TERMS_AGREEMENT,
                                optionIds
                        )
                );

        assertEquals(
                "선택 항목은 20개를 초과할 수 없습니다.",
                exception.getMessage()
        );
    }
}