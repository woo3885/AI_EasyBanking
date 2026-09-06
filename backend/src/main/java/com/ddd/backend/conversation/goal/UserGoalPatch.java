package com.ddd.backend.conversation.goal;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

public record UserGoalPatch(
        long basedOnRevision, String intent, UserGoal.Amount amount,
        UserGoal.Duration duration, List<String> missingFields,
        String pendingQuestionFieldKey, String status
) {
    private static final Set<String> INTENTS = Set.of("DEPOSIT", "TRANSFER", "INQUIRY", "CHANGE", "UNKNOWN");
    private static final Set<String> STATUSES = Set.of("ACTIVE", "CANCELLED", "SUPERSEDED");
    public UserGoalPatch {
        if (basedOnRevision < 0) throw new IllegalArgumentException("basedOnRevision must be non-negative");
        if (intent != null && !INTENTS.contains(intent)) throw new IllegalArgumentException("Unknown goal intent");
        if (status != null && !STATUSES.contains(status)) throw new IllegalArgumentException("Unknown goal status");
        if (amount != null && (amount.value() == null || !amount.value().matches("[0-9]+")
                || "0".equals(amount.value()) || !"KRW".equals(amount.currency()))) {
            throw new IllegalArgumentException("Invalid KRW amount");
        }
        if (duration != null && (duration.value() <= 0 || !"MONTH".equals(duration.unit()))) {
            throw new IllegalArgumentException("Invalid duration");
        }
        missingFields = missingFields == null ? null : List.copyOf(missingFields);
        if (missingFields != null && new HashSet<>(missingFields).size() != missingFields.size()) {
            throw new IllegalArgumentException("Duplicate missingFields");
        }
    }
    public boolean isEmpty() {
        return intent == null && amount == null && duration == null && missingFields == null
                && pendingQuestionFieldKey == null && status == null;
    }
}
