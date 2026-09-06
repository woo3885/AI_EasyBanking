package com.ddd.backend.conversation;
import com.ddd.backend.conversation.goal.UserGoal;
import com.ddd.backend.domain.session.WorkflowStatus;
import java.time.Instant;
import java.util.List;
public record ConversationSnapshot(
        String snapshotId, String sessionId, long eventSequence, long conversationSequence,
        long goalRevision, UserGoal userGoal, ActiveQuestion activeQuestion,
        List<ConversationMessage> recentSafeMessages, WorkflowStatus workflowStatus, Instant expiresAt
) {
    public UserGoal goal() { return userGoal; }
    public String activeQuestionId() { return activeQuestion == null ? null : activeQuestion.questionId(); }
    public record ActiveQuestion(String questionId, String messageId, long sequence, String text,
                                 long goalRevision, Instant occurredAt) { }
}
