package com.ddd.backend.conversation.navigation;

public record NavigationDecisionContext(
        String sessionId,
        String decisionId,
        String requestId,
        String requestMessageId,
        long goalRevision,
        String sourceSnapshotId,
        BrowserSemanticRoute semanticRoute,
        BrowserNavigationMode navigationMode,
        String navigationId,
        ResumeStatus resumeStatus
) {
    public enum ResumeStatus { PENDING, IN_PROGRESS, COMPLETED, FAILED }
    public NavigationDecisionContext withNavigationId(String value) {
        return new NavigationDecisionContext(sessionId, decisionId, requestId, requestMessageId,
                goalRevision, sourceSnapshotId, semanticRoute, navigationMode, value, resumeStatus);
    }
    public NavigationDecisionContext withResumeStatus(ResumeStatus value) {
        return new NavigationDecisionContext(sessionId, decisionId, requestId, requestMessageId,
                goalRevision, sourceSnapshotId, semanticRoute, navigationMode, navigationId, value);
    }
}
