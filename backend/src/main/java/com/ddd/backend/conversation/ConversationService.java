package com.ddd.backend.conversation;

import com.ddd.backend.api.dto.conversation.SubmitSessionMessageRequest;
import com.ddd.backend.common.exception.SessionNotFoundException;
import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.domain.session.AutomationSessionRepository;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Instant;
import java.util.Set;
import com.ddd.backend.domain.session.WorkflowStatus;
import com.ddd.backend.conversation.event.ConversationEventStore;
import com.ddd.backend.conversation.gate.ConversationProtectedGateRegistry;

@Service
public final class ConversationService {

    private static final Set<WorkflowStatus> TERMINAL_STATUSES = Set.of(
            WorkflowStatus.CANCELLED,
            WorkflowStatus.ERROR,
            WorkflowStatus.TERMINATED,
            WorkflowStatus.COMPLETED
    );

    private final AutomationSessionRepository sessionRepository;
    private final ConversationStateStore stateStore;
    private final SessionMessageMailbox mailbox;
    private final ConversationMessagePolicy messagePolicy;
    private final ConversationEventStore eventStore;
    private ConversationProtectedGateRegistry protectedGates;

    @Autowired(required = false)
    void setProtectedGates(ConversationProtectedGateRegistry protectedGates) {
        this.protectedGates = protectedGates;
    }

    @Autowired
    public ConversationService(
            AutomationSessionRepository sessionRepository,
            ConversationStateStore stateStore,
            SessionMessageMailbox mailbox,
            ConversationMessagePolicy messagePolicy,
            ConversationEventStore eventStore
    ) {
        this.sessionRepository = sessionRepository;
        this.stateStore = stateStore;
        this.mailbox = mailbox;
        this.messagePolicy = messagePolicy;
        this.eventStore = eventStore;
    }

    public ConversationService(AutomationSessionRepository sessionRepository,
            ConversationStateStore stateStore, SessionMessageMailbox mailbox,
            ConversationMessagePolicy messagePolicy) {
        this(sessionRepository, stateStore, mailbox, messagePolicy, new ConversationEventStore());
    }

    public MessageAcceptance acceptInitial(
            String sessionId,
            String requestId,
            String messageId,
            String content,
            Instant occurredAt
    ) {
        return accept(sessionId, requestId, messageId, content,
                0, 0, occurredAt);
    }

    public String validateContent(String content) {
        return messagePolicy.sanitize(content);
    }

    public MessageAcceptance acceptFollowUp(
            String sessionId,
            SubmitSessionMessageRequest request
    ) {
        ConversationState state = stateStore.find(sessionId)
                .orElseThrow(() -> new IllegalStateException("Conversation state not found"));
        if (state.activeQuestionId() != null) {
            state.requireActiveQuestion(request.answerToQuestionId());
        }
        return accept(sessionId, request.requestId(), request.messageId(), request.content(),
                request.expectedConversationSequence(), request.expectedGoalRevision(),
                request.clientOccurredAt());
    }

    private MessageAcceptance accept(
            String sessionId,
            String requestId,
            String messageId,
            String rawContent,
            long expectedSequence,
            long expectedGoalRevision,
            Instant occurredAt
    ) {
        AutomationSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new SessionNotFoundException(sessionId));
        if (TERMINAL_STATUSES.contains(session.getStatus())) {
            throw new IllegalStateException("종료된 세션에는 메시지를 보낼 수 없습니다.");
        }
        requireId(requestId, "requestId");
        requireId(messageId, "messageId");
        String safeContent = messagePolicy.sanitize(rawContent);
        ConversationState state = stateStore.find(sessionId).orElseGet(() -> {
            // Conversation TTL이 끝났다면 남아 있을 수 있는 in-memory mailbox도 같이 폐기한다.
            mailbox.removeSession(sessionId);
            return stateStore.getOrCreate(sessionId);
        });

        synchronized (state) {
            MessageAcceptance duplicate = state.duplicateAcceptance(
                    requestId.trim(), messageId.trim());
            if (duplicate != null) return duplicate;
            if (protectedGates != null && protectedGates.blocksAutomation(sessionId)) {
                throw new ConversationException(ConversationError.PROTECTED_GATE_ACTIVE);
            }
            if (state.sequence() != expectedSequence) {
                throw new ConversationException(ConversationError.STALE_SEQUENCE);
            }
            if (state.goalRevision() != expectedGoalRevision) {
                throw new ConversationException(ConversationError.STALE_GOAL_REVISION);
            }
            state.ensureMessageIdAvailable(messageId.trim());
            MessageQueueStatus queueStatus = mailbox.offer(sessionId, messageId);
            try {
                MessageAcceptance acceptance = state.appendUserMessage(
                        requestId.trim(), messageId.trim(), safeContent,
                        Instant.now(),
                        queueStatus);
                return acceptance;
            } catch (RuntimeException exception) {
                if (queueStatus == MessageQueueStatus.ACTIVE) {
                    mailbox.completeActive(sessionId, messageId);
                }
                throw exception;
            }
        }
    }

    public ConversationSnapshot snapshot(String sessionId) {
        AutomationSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new SessionNotFoundException(sessionId));
        return stateStore.find(sessionId)
                .map(state -> state.snapshot(eventStore.lastSequence(sessionId), session.getStatus()))
                .orElseGet(() -> stateStore.getOrCreate(sessionId)
                        .snapshot(eventStore.lastSequence(sessionId), session.getStatus()));
    }

    public ConversationState state(String sessionId) {
        return stateStore.find(sessionId).orElseThrow(() -> new IllegalStateException("Conversation state not found"));
    }

    public ConversationEventStore eventStore() { return eventStore; }

    public void removeSession(String sessionId) {
        mailbox.removeSession(sessionId);
        stateStore.removeSession(sessionId);
        eventStore.removeSession(sessionId);
    }

    private void requireId(String value, String name) {
        if (value == null || value.isBlank() || value.length() > 128) {
            throw new IllegalArgumentException(name + "가 올바르지 않습니다.");
        }
    }
}
