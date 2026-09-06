package com.ddd.backend.conversation.agent;
import com.ddd.backend.conversation.goal.UserGoalPatch;
public record ConversationAgentDecision(
        String requestId, String requestMessageId, String goalId, long baseGoalRevision,
        ConversationInteractionMode mode, String message, double confidence, String reasonCode,
        String nextCondition, String sourceSnapshotId, UserGoalPatch goalPatch,
        QuestionCandidate question, ActionCandidate actionCandidate
) {
    public record QuestionCandidate(String fieldKey) { }
    public record ActionCandidate(
            String actionType,
            String targetElementId,
            String role,
            String accessibleLabel,
            String guide
    ) {
        public ActionCandidate(String actionType) {
            this(actionType, null, null, null, null);
        }
    }
}
