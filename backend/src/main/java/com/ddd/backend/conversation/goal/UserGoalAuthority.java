package com.ddd.backend.conversation.goal;

import com.ddd.backend.conversation.ConversationError;
import com.ddd.backend.conversation.ConversationException;
import java.util.List;
import java.util.UUID;

public final class UserGoalAuthority {
    private UserGoal goal = new UserGoal(UUID.randomUUID().toString(), 0, "ACTIVE", "UNKNOWN",
            "pending", null, null, List.of(), null, "INFORMATION_COLLECTION",
            new UserGoal.Safety(false, "NONE", "NONE"), null);

    public synchronized UserGoal snapshot() { return goal; }

    public synchronized void initializeRequest(String request) {
        if (goal.lastAppliedMessageId() == null && "pending".equals(goal.normalizedRequest())) {
            goal = copy(goal.revision(), goal.status(), goal.intent(), request, goal.amount(), goal.duration(),
                    goal.missingFields(), goal.pendingQuestion(), null);
        }
    }

    public synchronized UserGoal apply(String goalId, long revision, String messageId,
                                       UserGoalPatch patch, UserGoal.PendingQuestion question) {
        if (goalId == null || !goal.goalId().equals(goalId)) throw new IllegalArgumentException("Goal identity mismatch");
        if (messageId != null && messageId.equals(goal.lastAppliedMessageId())) return goal;
        if (goal.revision() != revision || patch == null || patch.basedOnRevision() != revision) {
            throw new ConversationException(ConversationError.STALE_GOAL_REVISION);
        }
        if (messageId == null || messageId.isBlank() || patch.isEmpty()) {
            throw new IllegalArgumentException("Non-empty Goal patch and message identity are required");
        }
        goal = copy(revision + 1, choose(patch.status(), goal.status()), choose(patch.intent(), goal.intent()),
                goal.normalizedRequest(), patch.amount() != null ? patch.amount() : goal.amount(),
                patch.duration() != null ? patch.duration() : goal.duration(),
                patch.missingFields() != null ? patch.missingFields() : goal.missingFields(), question, messageId.trim());
        return goal;
    }

    private UserGoal copy(long revision, String status, String intent, String request,
                          UserGoal.Amount amount, UserGoal.Duration duration, List<String> missing,
                          UserGoal.PendingQuestion question, String lastMessage) {
        return new UserGoal(goal.goalId(), revision, status, intent, request, amount, duration, missing,
                question, "INFORMATION_COLLECTION", goal.safety(), lastMessage);
    }
    private String choose(String value, String fallback) { return value == null || value.isBlank() ? fallback : value.trim(); }
}
