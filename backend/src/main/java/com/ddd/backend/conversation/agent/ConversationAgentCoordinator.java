package com.ddd.backend.conversation.agent;

import com.ddd.backend.conversation.*;
import com.ddd.backend.conversation.goal.UserGoal;
import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.domain.session.AutomationSessionRepository;
import com.ddd.backend.domain.session.WorkflowStatus;
import java.time.Instant;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.ddd.backend.conversation.event.ConversationEventPublisher;

/** Day 1 ASK_USER orchestration. It never invokes Browser Action execution. */
@Service
public final class ConversationAgentCoordinator {
    private final ConversationService conversations;
    private final SessionMessageMailbox mailbox;
    private final AutomationSessionRepository sessions;
    private final ConversationAgentClient client;
    private final ConversationAgentContractValidator validator;
    private final ConversationEventPublisher events;
    private ConversationAgentDomDecisionService domDecisionService;

    public ConversationAgentCoordinator(ConversationService conversations, SessionMessageMailbox mailbox,
            AutomationSessionRepository sessions, ConversationAgentClient client,
            ConversationAgentContractValidator validator, ConversationEventPublisher events) {
        this.conversations = conversations; this.mailbox = mailbox; this.sessions = sessions;
        this.client = client; this.validator = validator; this.events = events;
    }

    @Autowired(required = false)
    void setDomDecisionService(ConversationAgentDomDecisionService domDecisionService) {
        this.domDecisionService = domDecisionService;
    }

    public ConversationAgentDecision process(String sessionId, MessageAcceptance acceptance,
            String content, String answerToQuestionId) {
        if (acceptance.duplicate() || acceptance.queueStatus() != MessageQueueStatus.ACTIVE) return null;
        ConversationState state = conversations.state(sessionId);
        ConversationAgentRequest request = new ConversationAgentRequest(sessionId, acceptance.requestId(),
                acceptance.messageId(), state.sequence(), state.goal(),
                new ConversationAgentRequest.UserMessage(content, answerToQuestionId), null);
        ConversationAgentDecision decision = validator.validate(request, client.decide(request));
        synchronized (state) {
            if (!mailbox.isActive(sessionId, acceptance.messageId()))
                throw new IllegalStateException("Stale AI decision for inactive message");
            AutomationSession session = sessions.findById(sessionId)
                    .orElseThrow(() -> new IllegalStateException("Session not found"));
            if (decision.mode() == ConversationInteractionMode.ASK_USER) {
                String questionId = UUID.randomUUID().toString();
                String assistantMessageId = UUID.randomUUID().toString();
                UserGoal.PendingQuestion pending = new UserGoal.PendingQuestion(
                        questionId, decision.question().fieldKey());
                UserGoal applied = state.applyGoalPatch(decision.goalId(), decision.baseGoalRevision(),
                        decision.requestMessageId(), decision.goalPatch(), pending);
                Instant now = Instant.now();
                ConversationSnapshot.ActiveQuestion question = state.appendQuestion(
                        assistantMessageId, questionId, decision.message(), applied.revision(), now);
                session.transitionTo(WorkflowStatus.ADDITIONAL_INFORMATION_REQUIRED);
                sessions.save(session);
                events.question(sessionId, assistantMessageId, question.sequence(), questionId,
                        decision.message(), applied.revision(), now);
            } else if (decision.mode() == ConversationInteractionMode.GOAL_PATCH_PROPOSED) {
                String answeredQuestionId = state.activeQuestionId();
                UserGoal applied = state.applyGoalPatch(decision.goalId(), decision.baseGoalRevision(),
                        decision.requestMessageId(), decision.goalPatch(), null);
                state.clearQuestion(answeredQuestionId);
                session.transitionTo(WorkflowStatus.AI_EXECUTING);
                sessions.save(session);
                Instant now = Instant.now();
                String assistantMessageId = UUID.randomUUID().toString();
                ConversationMessage message = state.appendAiMessage(assistantMessageId,
                        "요청 정보를 반영했습니다.", applied.revision(), now);
                events.message(sessionId, assistantMessageId, message.sequence(), message.content(),
                        applied.revision(), WorkflowStatus.AI_EXECUTING, null, now);
                if (domDecisionService != null && domDecisionService.canContinue(sessionId)) {
                    decision = domDecisionService.decideOnce(
                            sessionId, acceptance, state, content, answerToQuestionId);
                    applyDomDecision(sessionId, state, session, decision);
                }
            } else {
                throw new IllegalArgumentException("Unsupported conversation decision mode");
            }
            mailbox.completeActive(sessionId, acceptance.messageId());
        }
        return decision;
    }

    private void applyDomDecision(String sessionId, ConversationState state,
            AutomationSession session, ConversationAgentDecision decision) {
        if (decision.mode() == ConversationInteractionMode.ASK_USER
                || decision.mode() == ConversationInteractionMode.GOAL_PATCH_PROPOSED) {
            throw new IllegalArgumentException("Latest DOM decision cannot start another goal update in the same turn");
        }
        WorkflowStatus status = switch (decision.mode()) {
            case GUIDE_USER -> WorkflowStatus.USER_DECISION_REQUIRED;
            case SECURE_INPUT_REQUIRED -> WorkflowStatus.SECURE_INPUT_REQUIRED;
            case RISK_WARNING -> WorkflowStatus.RISK_WARNING;
            case FINAL_CONFIRMATION_REQUIRED -> WorkflowStatus.FINAL_CONFIRMATION_REQUIRED;
            case COMPLETE -> WorkflowStatus.COMPLETED;
            case STOP -> WorkflowStatus.TERMINATED;
            case AUTO_EXECUTE -> WorkflowStatus.AI_EXECUTING;
            default -> throw new IllegalArgumentException("Unsupported latest DOM decision mode");
        };
        session.transitionTo(status);
        sessions.save(session);
        if (decision.message() != null && !decision.message().isBlank()) {
            Instant now = Instant.now();
            String assistantMessageId = UUID.randomUUID().toString();
            ConversationMessage message = state.appendAiMessage(assistantMessageId,
                    decision.message(), state.goal().revision(), now);
            events.message(sessionId, assistantMessageId, message.sequence(), message.content(),
                    state.goal().revision(), status, decision.reasonCode(), now);
        }
    }
}
