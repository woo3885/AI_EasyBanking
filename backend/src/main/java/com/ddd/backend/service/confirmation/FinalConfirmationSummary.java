package com.ddd.backend.service.confirmation;

import java.util.List;

public record FinalConfirmationSummary(
        String transactionType,
        List<ConfirmationSummaryItem> items
) {
    public FinalConfirmationSummary {
        items = items == null ? null : List.copyOf(items);
    }

    public FinalConfirmationSummary(
            String productName, String productPeriod, String amount
    ) {
        this("정기예금 가입", List.of(
                new ConfirmationSummaryItem("product-name", "상품명", productName),
                new ConfirmationSummaryItem("deposit-amount", "가입 금액", amount),
                new ConfirmationSummaryItem("deposit-period", "가입 기간", productPeriod)
        ));
    }

    public String productName() {
        return valueOf("product-name");
    }

    public String productPeriod() {
        return valueOf("deposit-period");
    }

    public String amount() {
        return valueOf("deposit-amount");
    }

    private String valueOf(String id) {
        if (items == null) {
            return null;
        }
        return items.stream().filter(item -> id.equals(item.id()))
                .map(ConfirmationSummaryItem::value).findFirst().orElse(null);
    }
}
