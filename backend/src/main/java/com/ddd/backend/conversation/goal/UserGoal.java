package com.ddd.backend.conversation.goal;

import java.util.List;

public record UserGoal(
        String goalId, long revision, String status, String intent,
        String normalizedRequest, Amount amount, Duration duration,
        List<String> missingFields, PendingQuestion pendingQuestion,
        String stage, Safety safety, String lastAppliedMessageId
) {
    public UserGoal { missingFields = missingFields == null ? List.of() : List.copyOf(missingFields); }
    public record Amount(String value, String currency) { }
    public record Duration(int value, String unit) { }
    public record PendingQuestion(String questionId, String fieldKey) { }
    public record Safety(boolean secureInputActive, String riskState, String confirmationState) { }
}
