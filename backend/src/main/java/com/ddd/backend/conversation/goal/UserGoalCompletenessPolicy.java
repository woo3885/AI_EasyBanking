package com.ddd.backend.conversation.goal;

import org.springframework.stereotype.Component;

import java.util.List;

@Component
public final class UserGoalCompletenessPolicy {
    public static final String INFORMATION_COLLECTION = "INFORMATION_COLLECTION";
    public static final String DEPOSIT_ENTRY = "DEPOSIT_ENTRY";
    public static final String TRANSFER_ENTRY = "TRANSFER_ENTRY";

    public String stage(String status, String intent, UserGoal.Amount amount, UserGoal.Duration duration,
            List<String> missingFields, UserGoal.PendingQuestion pendingQuestion) {
        if (!"ACTIVE".equals(status) || pendingQuestion != null
                || missingFields == null || !missingFields.isEmpty()) {
            return INFORMATION_COLLECTION;
        }
        if ("DEPOSIT".equals(intent) && amount != null && duration != null) {
            return DEPOSIT_ENTRY;
        }
        if ("TRANSFER".equals(intent)) {
            return TRANSFER_ENTRY;
        }
        return INFORMATION_COLLECTION;
    }
}
