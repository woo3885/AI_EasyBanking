package com.ddd.backend.conversation.goal;

public record GoalPatchContinuationResult(
        String sessionId,
        String requestMessageId,
        String goalId,
        long goalRevision,
        boolean duplicate,
        boolean agentLoopResumeAccepted
) {
}
