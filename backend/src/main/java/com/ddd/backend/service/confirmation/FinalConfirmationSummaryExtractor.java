package com.ddd.backend.service.confirmation;

import com.ddd.backend.automation.dom.SanitizedDomSnapshot;
import com.ddd.backend.security.SensitiveDataMasker;
import org.springframework.stereotype.Component;

import java.util.Objects;
import java.util.HashSet;
import java.util.regex.Pattern;

@Component
public final class FinalConfirmationSummaryExtractor {
    private static final Pattern PERIOD = Pattern.compile("^[0-9]{1,3}\\s*(개월|년)$");
    private static final Pattern AMOUNT = Pattern.compile(
            "(?<![0-9])([0-9][0-9,]*)\\s*원(?![0-9])");
    private static final Pattern HTML_OR_SCRIPT = Pattern.compile("[<>]");
    private static final Pattern CREDENTIAL_TERM = Pattern.compile(
            "(?i)(?:password|passwd|pwd|비밀번호|비번|otp|one[-_\\s]*time[-_\\s]*password"
                    + "|인증\\s*(?:번호|코드)|verification[-_\\s]*code"
                    + "|auth[-_\\s]*code|(?<![a-z0-9])pin(?![a-z0-9])|핀\\s*번호)");
    private static final Pattern UNMASKED_ACCOUNT_NUMBER = Pattern.compile(
            "(?<![0-9])[0-9]{10,12}(?![0-9])");
    private static final Pattern KEBAB_CASE = Pattern.compile("^[a-z0-9]+(?:-[a-z0-9]+)*$");
    private static final Pattern INTERNAL_TERM = Pattern.compile(
            "(?i)(selector|element[-_]?id|session[-_]?id)");

    public FinalConfirmationSummary extract(SanitizedDomSnapshot snapshot) {
        Objects.requireNonNull(snapshot, "최종 확인 Snapshot은 필수입니다.");
        String amount = snapshot.page().depositAmount() == null
                ? extractAmount(snapshot)
                : safeAmount(snapshot.page().depositAmount());
        String productName = safeRequired(snapshot.page().productName(), "상품명", 100);
        String productPeriod = safeRequired(snapshot.page().productPeriod(), "가입 기간", 20);
        if (!PERIOD.matcher(productPeriod).matches()) {
            throw new IllegalStateException("최종 확인 가입 기간 형식이 올바르지 않습니다.");
        }
        if (amount == null) {
            throw new IllegalStateException("최종 확인 가입 금액을 확인할 수 없습니다.");
        }
        FinalConfirmationSummary summary =
                new FinalConfirmationSummary(productName, productPeriod, amount);
        validate(summary);
        return summary;
    }

    public void validate(FinalConfirmationSummary summary) {
        if (summary == null || !"정기예금 가입".equals(summary.transactionType())
                || summary.items() == null || summary.items().size() != 3) {
            throw new IllegalStateException("최종 확인 요약 형식이 올바르지 않습니다.");
        }
        var ids = new HashSet<String>();
        for (ConfirmationSummaryItem item : summary.items()) {
            if (item == null || item.id() == null || item.label() == null
                    || item.value() == null || item.id().isBlank()
                    || item.label().isBlank() || item.value().isBlank()
                    || !KEBAB_CASE.matcher(item.id()).matches()
                    || item.id().length() > 50 || item.label().length() > 30
                    || item.value().length() > 100 || !ids.add(item.id())) {
                throw new IllegalStateException("최종 확인 요약 형식이 올바르지 않습니다.");
            }
            validateSafeText(item.id(), true);
            validateSafeText(item.label(), true);
            validateSafeText(item.value(), !"deposit-amount".equals(item.id()));
            if (INTERNAL_TERM.matcher(item.id()).find()
                    || INTERNAL_TERM.matcher(item.label()).find()) {
                throw new IllegalStateException("최종 확인 요약에 내부 정보가 포함되어 있습니다.");
            }
        }
        if (!ids.equals(java.util.Set.of(
                "product-name", "deposit-amount", "deposit-period"))) {
            throw new IllegalStateException("최종 확인 요약 항목이 올바르지 않습니다.");
        }
        validateWholeSummary(summary);
    }

    private String safeRequired(String value, String fieldName, int maxLength) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("최종 확인 " + fieldName + "을 확인할 수 없습니다.");
        }
        // trim 전에 검사해야 문자열 양끝의 제어문자도 숨겨지지 않는다.
        validateSafeText(value, true);
        String normalized = value.trim();
        if (normalized.length() > maxLength) {
            throw new IllegalStateException("최종 확인 " + fieldName + " 형식이 올바르지 않습니다.");
        }
        return normalized;
    }

    private String extractAmount(SanitizedDomSnapshot snapshot) {
        for (var element : snapshot.elements()) {
            for (String value : new String[]{element.text(), element.ariaLabel()}) {
                if (value == null || value.isBlank()) {
                    continue;
                }
                var matcher = AMOUNT.matcher(value);
                if (!matcher.find()) {
                    continue;
                }

                // 정상 금액 토큰은 10~12자리일 수도 있으므로 제거한 주변 문맥을 검사한다.
                String amountDigits = matcher.group(1);
                String surroundingText = matcher.replaceFirst(" ");
                validateSafeText(surroundingText, true);
                String amount = amountDigits + "원";
                validateSafeText(amount, false);
                return amount;
            }
        }
        return null;
    }

    private String safeAmount(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("최종 확인 가입 금액을 확인할 수 없습니다.");
        }
        validateSafeText(value, false);
        String normalized = value.trim();
        if (normalized.length() > 30 || !AMOUNT.matcher(normalized).matches()) {
            throw new IllegalStateException("최종 확인 가입 금액 형식이 올바르지 않습니다.");
        }
        return normalized.replaceAll("\\s+", "");
    }

    private void validateWholeSummary(FinalConfirmationSummary summary) {
        validateSafeText(summary.productName(), true);
        validateSafeText(summary.productPeriod(), true);
        // amount 자체의 10~12자리 숫자는 정상적인 고액 금액일 수 있다.
        validateSafeText(summary.amount(), false);
    }

    private void validateSafeText(String value, boolean checkAccountNumber) {
        if (containsControlCharacter(value)
                || HTML_OR_SCRIPT.matcher(value).find()) {
            throw new IllegalStateException("최종 확인 요약 형식이 올바르지 않습니다.");
        }
        if (CREDENTIAL_TERM.matcher(value).find()
                || (checkAccountNumber
                && UNMASKED_ACCOUNT_NUMBER.matcher(value).find())
                || !SensitiveDataMasker.maskFreeText(value).equals(value)) {
            throw new IllegalStateException("최종 확인 요약에 민감정보가 포함되어 있습니다.");
        }
    }

    private boolean containsControlCharacter(String value) {
        return value.codePoints().anyMatch(Character::isISOControl);
    }
}
