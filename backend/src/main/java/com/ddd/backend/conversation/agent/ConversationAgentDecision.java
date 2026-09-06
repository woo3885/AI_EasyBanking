package com.ddd.backend.conversation.agent;
import com.ddd.backend.conversation.goal.UserGoalPatch;
import com.ddd.backend.conversation.navigation.BrowserNavigationMode;
import com.ddd.backend.conversation.navigation.BrowserSemanticRoute;
public record ConversationAgentDecision(
        String requestId, String requestMessageId, String goalId, long baseGoalRevision,
        ConversationInteractionMode mode, String message, double confidence, String reasonCode,
        String nextCondition, String sourceSnapshotId, UserGoalPatch goalPatch,
        QuestionCandidate question, ActionCandidate actionCandidate,
        String decisionId, NavigationCandidate navigationCandidate
) {
    public ConversationAgentDecision(
            String requestId, String requestMessageId, String goalId, long baseGoalRevision,
            ConversationInteractionMode mode, String message, double confidence, String reasonCode,
            String nextCondition, String sourceSnapshotId, UserGoalPatch goalPatch,
            QuestionCandidate question, ActionCandidate actionCandidate) {
        this(requestId, requestMessageId, goalId, baseGoalRevision, mode, message, confidence,
                reasonCode, nextCondition, sourceSnapshotId, goalPatch, question, actionCandidate,
                null, null);
    }

    public record QuestionCandidate(String fieldKey) { }
    public record NavigationCandidate(
            BrowserSemanticRoute semanticRoute,
            BrowserNavigationMode navigationMode
    ) { }
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
