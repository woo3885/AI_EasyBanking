package com.ddd.backend.conversation;

import com.ddd.backend.conversation.goal.UserGoal;
import com.ddd.backend.conversation.goal.UserGoalAuthority;
import com.ddd.backend.conversation.goal.UserGoalPatch;
import com.ddd.backend.domain.session.WorkflowStatus;
import java.time.Instant;
import java.util.*;

public final class ConversationState {
    private static final int MAX_MESSAGES = 50;
    private final String sessionId;
    private final List<ConversationMessage> messages = new ArrayList<>();
    private final Map<String, MessageAcceptance> acceptedRequests = new LinkedHashMap<>();
    private final UserGoalAuthority goalAuthority = new UserGoalAuthority();
    private long sequence;
    private ConversationSnapshot.ActiveQuestion activeQuestion;
    private Instant expiresAt;

    public ConversationState(String sessionId, Instant expiresAt) {
        if (sessionId == null || sessionId.isBlank()) throw new IllegalArgumentException("sessionId is required");
        this.sessionId = sessionId.trim(); this.expiresAt = expiresAt;
    }

    public synchronized MessageAcceptance appendUserMessage(String requestId, String messageId,
            String content, Instant occurredAt, MessageQueueStatus queueStatus) {
        MessageAcceptance duplicate = acceptedRequests.get(requestId);
        if (duplicate != null) {
            if (!duplicate.messageId().equals(messageId)) throw new ConversationException(ConversationError.DUPLICATE_REQUEST);
            return duplicate.asDuplicate();
        }
        ensureMessageIdAvailable(messageId);
        goalAuthority.initializeRequest(content);
        long acceptedSequence = ++sequence;
        messages.add(new ConversationMessage(messageId, requestId, acceptedSequence,
                ConversationRole.USER, content, "MESSAGE", null, null, occurredAt));
        trim();
        var acceptance = new MessageAcceptance(sessionId, requestId, messageId, acceptedSequence,
                queueStatus, occurredAt, false);
        acceptedRequests.put(requestId, acceptance);
        while (acceptedRequests.size() > MAX_MESSAGES) acceptedRequests.remove(acceptedRequests.keySet().iterator().next());
        return acceptance;
    }

    public synchronized ConversationSnapshot.ActiveQuestion appendQuestion(
            String messageId, String questionId, String text, long goalRevision, Instant at) {
        long messageSequence = ++sequence;
        messages.add(new ConversationMessage(messageId, null, messageSequence, ConversationRole.AI,
                text, "QUESTION", questionId, goalRevision, at));
        trim();
        activeQuestion = new ConversationSnapshot.ActiveQuestion(
                questionId, messageId, messageSequence, text, goalRevision, at);
        return activeQuestion;
    }

    public synchronized ConversationMessage appendAiMessage(
            String messageId, String text, long goalRevision, Instant at) {
        long messageSequence = ++sequence;
        ConversationMessage message = new ConversationMessage(messageId, null, messageSequence,
                ConversationRole.AI, text, "MESSAGE", null, goalRevision, at);
        messages.add(message);
        trim();
        return message;
    }

    public synchronized ConversationSnapshot snapshot(long eventSequence, WorkflowStatus status) {
        UserGoal goal = goalAuthority.snapshot();
        return new ConversationSnapshot(UUID.randomUUID().toString(), sessionId, eventSequence, sequence,
                goal.revision(), goal, activeQuestion, List.copyOf(messages), status, expiresAt);
    }
    public synchronized ConversationSnapshot snapshot() { return snapshot(0, WorkflowStatus.SESSION_CREATED); }
    public synchronized void activateQuestion(String questionId) {
        activeQuestion = new ConversationSnapshot.ActiveQuestion(questionId, "legacy-question", sequence,
                "pending question", goalRevision(), Instant.now());
    }
    public synchronized long sequence() { return sequence; }
    public synchronized long goalRevision() { return goalAuthority.snapshot().revision(); }
    public synchronized UserGoal goal() { return goalAuthority.snapshot(); }
    public synchronized MessageAcceptance duplicateAcceptance(String requestId, String messageId) {
        MessageAcceptance value = acceptedRequests.get(requestId);
        if (value == null) return null;
        if (!value.messageId().equals(messageId)) throw new ConversationException(ConversationError.DUPLICATE_REQUEST);
        return value.asDuplicate();
    }
    public synchronized void ensureMessageIdAvailable(String messageId) {
        if (messages.stream().anyMatch(message -> message.messageId().equals(messageId)))
            throw new ConversationException(ConversationError.DUPLICATE_MESSAGE);
    }
    public synchronized UserGoal applyGoalPatch(String goalId, long revision, String messageId,
                                                 UserGoalPatch patch, UserGoal.PendingQuestion question) {
        return goalAuthority.apply(goalId, revision, messageId, patch, question);
    }
    public synchronized void requireActiveQuestion(String id) {
        if (activeQuestion == null || id == null || !activeQuestion.questionId().equals(id))
            throw new ConversationException(ConversationError.QUESTION_MISMATCH);
    }
    public synchronized void clearQuestion(String id) { requireActiveQuestion(id); activeQuestion = null; }
    public synchronized String activeQuestionId() { return activeQuestion == null ? null : activeQuestion.questionId(); }
    public synchronized void refreshExpiry(Instant value) { expiresAt = value; }
    public synchronized Instant expiresAt() { return expiresAt; }
    private void trim() { while (messages.size() > MAX_MESSAGES) messages.removeFirst(); }
}
