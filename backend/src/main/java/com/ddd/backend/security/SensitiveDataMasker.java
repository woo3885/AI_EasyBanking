package com.ddd.backend.security;

import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

public final class SensitiveDataMasker {

    private static final String MASKED_VALUE =
            "******";

    private static final Set<String> SENSITIVE_FIELD_NAMES =
            Set.of(
                    "password",
                    "passwd",
                    "pin",
                    "otp",
                    "authcode",
                    "verificationcode",
                    "securitycode",
                    "residentregistrationnumber",
                    "rrn",
                    "cardnumber",
                    "accountnumber",
                    "certificatepassword"
            );

    /*
     * D15
     *
     * DOM의 text / aria-label / placeholder / title에
     * 개인정보가 노출되는 경우를 대비한
     * 보수적인 Free Text masking.
     */

    private static final Pattern RRN_PATTERN =
            Pattern.compile(
                    "(?<!\\d)\\d{6}[- ]?[1-4]\\d{6}(?!\\d)"
            );

    private static final Pattern EMAIL_PATTERN =
            Pattern.compile(
                    "(?i)(?<![a-z0-9._%+-])"
                            + "[a-z0-9._%+-]+"
                            + "@"
                            + "[a-z0-9.-]+\\.[a-z]{2,}"
                            + "(?![a-z0-9._%+-])"
            );

    private static final Pattern PHONE_PATTERN =
            Pattern.compile(
                    "(?<!\\d)"
                            + "01[016789]"
                            + "[- ]?"
                            + "\\d{3,4}"
                            + "[- ]?"
                            + "\\d{4}"
                            + "(?!\\d)"
            );

    private static final Pattern SECURITY_CODE_PATTERN =
            Pattern.compile(
                    "(?i)"
                            + "(?:otp"
                            + "|verification\\s*code"
                            + "|auth\\s*code"
                            + "|인증번호"
                            + "|인증\\s*코드)"
                            + "\\s*[:=]?\\s*"
                            + "\\d{4,8}"
            );

    /*
     * 하이픈으로 구분된 계좌/카드 계열 숫자.
     */
    private static final Pattern FINANCIAL_NUMBER_PATTERN =
            Pattern.compile(
                    "(?<!\\d)"
                            + "\\d{2,6}"
                            + "(?:-\\d{2,6}){2,4}"
                            + "(?!\\d)"
            );

    /*
     * 구분자 없이 매우 긴 금융번호가
     * 화면 text에 노출되는 경우.
     */
    private static final Pattern LONG_NUMBER_PATTERN =
            Pattern.compile(
                    "(?<!\\d)\\d{13,19}(?!\\d)"
            );

    private SensitiveDataMasker() {
    }

    /*
     * 기존 기능 유지.
     */
    public static String mask(
            String fieldName,
            String value
    ) {
        if (value == null) {
            return null;
        }

        if (isSensitiveField(
                fieldName
        )) {
            return MASKED_VALUE;
        }

        return value;
    }

    /*
     * D15
     *
     * 화면에 이미 렌더링된 일반 문자열 내부에서
     * 개인정보 패턴만 제거한다.
     */
    public static String maskFreeText(
            String value
    ) {
        if (value == null) {
            return null;
        }

        String masked =
                value;

        masked =
                RRN_PATTERN
                        .matcher(
                                masked
                        )
                        .replaceAll(
                                "[RRN]"
                        );

        masked =
                EMAIL_PATTERN
                        .matcher(
                                masked
                        )
                        .replaceAll(
                                "[EMAIL]"
                        );

        masked =
                PHONE_PATTERN
                        .matcher(
                                masked
                        )
                        .replaceAll(
                                "[PHONE]"
                        );

        masked =
                SECURITY_CODE_PATTERN
                        .matcher(
                                masked
                        )
                        .replaceAll(
                                "[SECURE_CODE]"
                        );

        masked =
                FINANCIAL_NUMBER_PATTERN
                        .matcher(
                                masked
                        )
                        .replaceAll(
                                "[FINANCIAL_NUMBER]"
                        );

        masked =
                LONG_NUMBER_PATTERN
                        .matcher(
                                masked
                        )
                        .replaceAll(
                                "[FINANCIAL_NUMBER]"
                        );

        return masked;
    }

    public static boolean isSensitiveField(
            String fieldName
    ) {
        if (fieldName == null
                || fieldName.isBlank()) {

            return false;
        }

        String normalizedFieldName =
                fieldName
                        .replaceAll(
                                "[^a-zA-Z0-9]",
                                ""
                        )
                        .toLowerCase(
                                Locale.ROOT
                        );

        return SENSITIVE_FIELD_NAMES
                .contains(
                        normalizedFieldName
                );
    }
}