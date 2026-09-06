package com.ddd.backend.automation.dom;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class DomSanitizerNormalizationTest {
    @Test
    void unicode와_연속_공백을_동일한_semantic_text로_정규화한다() {
        DomSanitizer sanitizer = new DomSanitizer();

        assertThat(sanitizer.sanitizeText(" Cafe\u0301   상품 \n 선택 "))
                .isEqualTo("Café 상품 선택");
        assertThat(sanitizer.sanitizeText("Café 상품 선택"))
                .isEqualTo("Café 상품 선택");
    }
}
