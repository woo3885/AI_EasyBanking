package com.ddd.backend.service.decision;

import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.Set;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** 검증된 PRODUCT_SELECTION과 실제 상세 DOM 기간을 세션별로 결합한다. */
@Component
public final class SelectedDepositProductStore {

    private static final Pattern PRODUCT_BUTTON =
            Pattern.compile("^btn-select-(deposit-[a-zA-Z0-9-]+)$");
    private static final Pattern REQUEST_PERIOD =
            Pattern.compile("(?<![0-9])([0-9]{1,3})\\s*개월");
    private static final Pattern WON_AMOUNT =
            Pattern.compile("(?<![0-9])([0-9][0-9,]*)\\s*원(?![0-9])");
    private static final Set<String> SUPPORTED_PRODUCTS =
            Set.of("deposit-12m", "deposit-preferred");
    private static final Map<String, String> PRODUCT_NAMES = Map.of(
            "deposit-12m", "12개월 정기예금",
            "deposit-preferred", "우대금리 정기예금");
    private final ConcurrentMap<String, Context> contexts = new ConcurrentHashMap<>();

    public void select(String sessionId, String domId, String sourceSnapshotId) {
        Matcher matcher = PRODUCT_BUTTON.matcher(domId == null ? "" : domId);
        if (!matcher.matches() || !SUPPORTED_PRODUCTS.contains(matcher.group(1))
                || sourceSnapshotId == null || sourceSnapshotId.isBlank()) {
            throw new IllegalStateException("선택 상품의 Snapshot context를 확인할 수 없습니다.");
        }
        contexts.put(sessionId, new Context(
                matcher.group(1), sourceSnapshotId, null, null, null));
    }

    public Verification observeDetail(
            String sessionId,
            String productId,
            String productName,
            String periodLabel,
            String userRequest
    ) {
        Context selected = contexts.get(sessionId);
        if (selected == null || !selected.productId().equals(productId)
                || !PRODUCT_NAMES.get(selected.productId()).equals(productName)
                || periodLabel == null || periodLabel.isBlank()) {
            return Verification.INVALID;
        }
        Matcher actual = REQUEST_PERIOD.matcher(periodLabel);
        if (!actual.find()) return Verification.INVALID;
        Matcher requested = REQUEST_PERIOD.matcher(userRequest == null ? "" : userRequest);
        if (requested.find() && !actual.group(1).equals(requested.group(1))) {
            return Verification.PERIOD_CONFLICT;
        }
        contexts.put(sessionId, new Context(selected.productId(),
                selected.sourceSnapshotId(), productName.trim(),
                periodLabel.trim(), selected.amount()));
        return Verification.VALID;
    }

    public boolean observeAmount(String sessionId, String productId, String amountText) {
        Context context = contexts.get(sessionId);
        if (context == null || context.productName() == null
                || !context.productId().equals(productId)
                || amountText == null) {
            return false;
        }
        Matcher amount = WON_AMOUNT.matcher(amountText.trim());
        if (!amount.find()) {
            return false;
        }
        String canonicalAmount = amount.group(1) + "원";
        contexts.put(sessionId, new Context(
                context.productId(), context.sourceSnapshotId(),
                context.productName(), context.periodLabel(), canonicalAmount));
        return true;
    }

    public boolean validatesFinalContext(
            String sessionId, String productId, String productName,
            String periodLabel, String amount
    ) {
        Context context = contexts.get(sessionId);
        return context != null
                && context.productId().equals(productId)
                && java.util.Objects.equals(context.productName(), productName)
                && java.util.Objects.equals(context.periodLabel(), periodLabel)
                && java.util.Objects.equals(context.amount(), amount);
    }

    public boolean validatesAmountPage(String sessionId, String productId) {
        Context context = contexts.get(sessionId);
        return context != null && context.periodLabel() != null
                && context.productId().equals(productId);
    }

    public java.util.Optional<Context> find(String sessionId) {
        return java.util.Optional.ofNullable(contexts.get(sessionId));
    }

    public void removeSession(String sessionId) {
        if (sessionId != null) contexts.remove(sessionId);
    }

    public enum Verification { VALID, PERIOD_CONFLICT, INVALID }

    public record Context(
            String productId,
            String sourceSnapshotId,
            String productName,
            String periodLabel,
            String amount
    ) {}
}
