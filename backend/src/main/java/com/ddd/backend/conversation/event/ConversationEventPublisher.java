package com.ddd.backend.conversation.event;

import java.time.Instant;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import com.ddd.backend.domain.session.WorkflowStatus;
import com.ddd.backend.conversation.overlay.*;

@Component
public final class ConversationEventPublisher {
    private static final String PREFIX = "/topic/sessions/";
    private static final String SUFFIX = "/events";
    private final ConversationEventStore store;
    private final SimpMessagingTemplate transport;

    public ConversationEventPublisher(ConversationEventStore store, SimpMessagingTemplate transport) {
        this.store = store;
        this.transport = transport;
    }

    public UserMessageAcceptedEvent accepted(String sessionId, String messageId, long sequence,
            WorkflowStatus status, Instant at) {
        return publish(store.accepted(sessionId, messageId, sequence, status, at));
    }

    public AiQuestionEvent question(String sessionId, String messageId, long sequence,
            String questionId, String text, long revision, Instant at) {
        return publish(store.question(sessionId, messageId, sequence, questionId, text, revision, at));
    }

    public AiMessageEvent message(String sessionId, String messageId, long sequence,
            String text, long revision, WorkflowStatus status, String errorCode, Instant at) {
        return publish(store.message(sessionId, messageId, sequence, text, revision, status, errorCode, at));
    }
    public OverlayTargetEvent overlayTarget(PublicOverlayTarget target, Instant at) {
        return publish(store.overlayTarget(target, at));
    }
    public OverlayClearEvent overlayClear(PublicOverlayTarget target, OverlayClearReason reason, Instant at) {
        return publish(store.overlayClear(target, reason, at));
    }
    public UserActionObservedEvent userActionObserved(PublicOverlayTarget target,
            String observationId, String requestId, String resultingSnapshotId, Instant at) {
        return publish(store.userActionObserved(target, observationId, requestId, resultingSnapshotId, at));
    }

    private <T extends ConversationEvent> T publish(T event) {
        transport.convertAndSend(PREFIX + event.sessionId() + SUFFIX, event);
        return event;
    }
}
