package com.ddd.backend.conversation.agent;

import com.ddd.backend.conversation.MessageAcceptance;
import com.ddd.backend.conversation.SessionMessageMailbox;
import com.ddd.backend.conversation.event.ConversationEventPublisher;
import com.ddd.backend.conversation.navigation.PageReadyResumeError;
import com.ddd.backend.conversation.navigation.PageReadyResumeErrors;
import com.ddd.backend.domain.session.AutomationSessionRepository;
import com.ddd.backend.domain.session.WorkflowStatus;
import jakarta.annotation.PreDestroy;
import java.time.Instant;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import tools.jackson.core.JacksonException;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public final class ConversationAgentAsyncProcessor {
    private static final Logger log = LoggerFactory.getLogger(ConversationAgentAsyncProcessor.class);
    private final ConversationAgentCoordinator coordinator;
    private final ConversationEventPublisher events;
    private final AutomationSessionRepository sessions;
    private final SessionMessageMailbox mailbox;
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();
    private final Set<String> scheduledMessages = ConcurrentHashMap.newKeySet();

    public ConversationAgentAsyncProcessor(ConversationAgentCoordinator coordinator,
            ConversationEventPublisher events, AutomationSessionRepository sessions,
            SessionMessageMailbox mailbox) {
        this.coordinator = coordinator;
        this.events = events;
        this.sessions = sessions;
        this.mailbox = mailbox;
    }

    public void submit(String sessionId, MessageAcceptance acceptance, String content,
            String answerToQuestionId) {
        if (acceptance.duplicate() || !scheduledMessages.add(sessionId + ":" + acceptance.messageId())) return;
        executor.submit(() -> process(sessionId, acceptance, content, answerToQuestionId));
    }

    private void process(String sessionId, MessageAcceptance acceptance, String content,
            String answerToQuestionId) {
        var session = sessions.findById(sessionId).orElse(null);
        if (session == null) return;
        try {
            events.accepted(sessionId, acceptance.messageId(), acceptance.acceptedSequence(),
                    session.getStatus(), acceptance.acceptedAt());
            while (!mailbox.isActive(sessionId, acceptance.messageId())) {
                Thread.sleep(10);
            }
            coordinator.process(sessionId, acceptance, content, answerToQuestionId);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
        } catch (RuntimeException exception) {
            String errorCode = classify(exception);
            log.warn("Conversation AI processing failed. sessionRef={} messageRef={} decisionType={} "
                            + "screenType={} errorCode={} failureStage={}",
                    safeRef(sessionId), safeRef(acceptance.messageId()), "UNKNOWN", "UNKNOWN",
                    errorCode, "DECISION_MATERIALIZATION");
            session.transitionTo(WorkflowStatus.ERROR);
            sessions.save(session);
            events.message(sessionId, java.util.UUID.randomUUID().toString(),
                    acceptance.acceptedSequence(), "AI 판단을 완료하지 못했습니다.",
                    0, WorkflowStatus.ERROR, errorCode, Instant.now());
        }
    }

    private String classify(Throwable error) {
        PageReadyResumeError materialization = PageReadyResumeErrors.classify(error);
        if (materialization != PageReadyResumeError.PAGE_READY_RESUME_FAILED) {
            return materialization.name();
        }
        for (Throwable current = error; current != null; current = current.getCause()) {
            if (current instanceof HttpTimeoutException) return "CONVERSATION_504_AI_TIMEOUT";
            if (current instanceof JacksonException || current instanceof IllegalArgumentException)
                return "CONVERSATION_502_INVALID_AI_RESPONSE";
        }
        return "CONVERSATION_502_AI_UNAVAILABLE";
    }

    private String safeRef(String value) {
        if (value == null) return "none";
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(digest, 0, 6);
        } catch (java.security.NoSuchAlgorithmException impossible) {
            return "unavailable";
        }
    }

    @PreDestroy
    void close() { executor.close(); }
}
