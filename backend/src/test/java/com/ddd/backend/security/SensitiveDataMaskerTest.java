package com.ddd.backend.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SensitiveDataMaskerTest {

    @Test
    void 비밀번호는_마스킹된다() {
        String result = SensitiveDataMasker.mask(
                "password",
                "myPassword123"
        );

        assertThat(result).isEqualTo("******");
    }

    @Test
    void OTP는_마스킹된다() {
        String result = SensitiveDataMasker.mask(
                "otp",
                "123456"
        );

        assertThat(result).isEqualTo("******");
    }

    @Test
    void 언더바가_포함된_민감정보_필드도_마스킹된다() {
        String result = SensitiveDataMasker.mask(
                "account_number",
                "123456789012"
        );

        assertThat(result).isEqualTo("******");
    }

    @Test
    void 대소문자가_달라도_민감정보로_판단한다() {
        boolean result = SensitiveDataMasker.isSensitiveField(
                "CertificatePassword"
        );

        assertThat(result).isTrue();
    }

    @Test
    void 일반_요청값은_마스킹하지_않는다() {
        String result = SensitiveDataMasker.mask(
                "userRequest",
                "적금 상품을 비교해 줘"
        );

        assertThat(result).isEqualTo("적금 상품을 비교해 줘");
    }

    @Test
    void 값이_null이면_null을_반환한다() {
        String result = SensitiveDataMasker.mask(
                "password",
                null
        );

        assertThat(result).isNull();
    }

    @Test
    void 필드명이_null이면_민감정보로_판단하지_않는다() {
        boolean result = SensitiveDataMasker.isSensitiveField(null);

        assertThat(result).isFalse();
    }
}