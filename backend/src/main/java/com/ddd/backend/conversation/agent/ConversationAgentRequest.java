package com.ddd.backend.conversation.agent;

import com.ddd.backend.automation.dom.SanitizedDomSnapshot;
import com.ddd.backend.conversation.goal.UserGoal;

public record ConversationAgentRequest(
        String sessionId,
        String requestId,
        String requestMessageId,
        long conversationSequence,
        UserGoal goal,
        UserMessage userMessage,
        SnapshotContext snapshot
) {
    public record UserMessage(String content, String answerToQuestionId) { }

    public record SnapshotContext(
            String sourceSnapshotId,
            String pageIdentity,
            SanitizedDomSnapshot sanitizedDomSnapshot
    ) { }
}
