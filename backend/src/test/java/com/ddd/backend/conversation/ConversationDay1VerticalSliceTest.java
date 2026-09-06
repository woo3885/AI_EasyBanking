package com.ddd.backend.conversation;

import com.ddd.backend.conversation.agent.*;
import com.ddd.backend.conversation.event.*;
import com.ddd.backend.conversation.goal.*;
import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.domain.session.WorkflowStatus;
import com.ddd.backend.infrastructure.session.InMemoryAutomationSessionRepository;
import org.junit.jupiter.api.Test;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import org.springframework.messaging.simp.SimpMessagingTemplate;

class ConversationDay1VerticalSliceTest {
    @Test
    void firstMessageProducesOneAcceptedAndOneBackendAuthoritativeQuestion() {
        var sessions = new InMemoryAutomationSessionRepository();
        AutomationSession session = sessions.save(AutomationSession.create("100만원으로 예금 가입해줘"));
        var states = new ConversationStateStore(Duration.ofMinutes(30));
        var mailbox = new SessionMessageMailbox();
        var events = new ConversationEventStore();
        var conversations = new ConversationService(sessions, states, mailbox,
                new ConversationMessagePolicy(), events);
        var calls = new AtomicInteger();
        ConversationAgentClient scripted = request -> {
            calls.incrementAndGet();
            assertThat(request.snapshot()).isNull();
            assertThat(request.userMessage().content()).isEqualTo("100만원으로 예금 가입해줘");
            return new ConversationAgentDecision(request.requestId(), request.requestMessageId(),
                    request.goal().goalId(), 0, ConversationInteractionMode.ASK_USER,
                    "가입 기간은 얼마로 할까요?", 1.0, "MISSING_DURATION", null, null,
                    new UserGoalPatch(0, "DEPOSIT", new UserGoal.Amount("1000000", "KRW"),
                            null, List.of("duration"), "duration", null),
                    new ConversationAgentDecision.QuestionCandidate("duration"), null);
        };
        var publisher = new ConversationEventPublisher(events, mock(SimpMessagingTemplate.class));
        var coordinator = new ConversationAgentCoordinator(conversations, mailbox, sessions, scripted,
                new ConversationAgentContractValidator(new ConversationMessagePolicy()), publisher);

        MessageAcceptance accepted = conversations.acceptInitial(session.getSessionId(),
                "request-1", "user-message-1", "100만원으로 예금 가입해줘", null);
        publisher.accepted(session.getSessionId(), accepted.messageId(), accepted.acceptedSequence(),
                session.getStatus(), accepted.acceptedAt());
        coordinator.process(session.getSessionId(), accepted, "100만원으로 예금 가입해줘", null);

        ConversationSnapshot snapshot = conversations.snapshot(session.getSessionId());
        assertThat(calls).hasValue(1);
        assertThat(snapshot.workflowStatus()).isEqualTo(WorkflowStatus.ADDITIONAL_INFORMATION_REQUIRED);
        assertThat(snapshot.userGoal().revision()).isEqualTo(1);
        assertThat(snapshot.userGoal().intent()).isEqualTo("DEPOSIT");
        assertThat(snapshot.userGoal().amount()).isEqualTo(new UserGoal.Amount("1000000", "KRW"));
        assertThat(snapshot.userGoal().duration()).isNull();
        assertThat(snapshot.userGoal().missingFields()).containsExactly("duration");
        assertThat(snapshot.activeQuestion()).isNotNull();
        assertThat(snapshot.activeQuestion().questionId()).isEqualTo(snapshot.userGoal().pendingQuestion().questionId());
        assertThat(snapshot.activeQuestion().goalRevision()).isEqualTo(1);
        assertThat(snapshot.eventSequence()).isEqualTo(2);
        assertThat(snapshot.conversationSequence()).isEqualTo(2);
        assertThat(events.events(session.getSessionId()))
                .extracting(ConversationEvent::eventType)
                .containsExactly("USER_MESSAGE_ACCEPTED", "AI_QUESTION");

        String questionId = snapshot.activeQuestion().questionId();
        ConversationAgentClient durationScript = request -> new ConversationAgentDecision(
                request.requestId(), request.requestMessageId(), request.goal().goalId(), 1,
                ConversationInteractionMode.GOAL_PATCH_PROPOSED, null, 1.0, "GOAL_UPDATED",
                "LATEST_DOM_DECISION", null,
                new UserGoalPatch(1, null, null, new UserGoal.Duration(12, "MONTH"),
                        List.of(), null, null), null, null);
        var followUpCoordinator = new ConversationAgentCoordinator(conversations, mailbox, sessions,
                durationScript, new ConversationAgentContractValidator(new ConversationMessagePolicy()), publisher);
        var followUp = conversations.acceptFollowUp(session.getSessionId(),
                new com.ddd.backend.api.dto.conversation.SubmitSessionMessageRequest(
                        "request-2", "user-message-2", "12개월", questionId, 2L, 1L, null));
        publisher.accepted(session.getSessionId(), followUp.messageId(), followUp.acceptedSequence(),
                session.getStatus(), followUp.acceptedAt());
        followUpCoordinator.process(session.getSessionId(), followUp, "12개월", questionId);

        ConversationSnapshot updated = conversations.snapshot(session.getSessionId());
        assertThat(updated.userGoal().revision()).isEqualTo(2);
        assertThat(updated.userGoal().duration()).isEqualTo(new UserGoal.Duration(12, "MONTH"));
        assertThat(updated.activeQuestion()).isNull();
        assertThat(updated.workflowStatus()).isEqualTo(WorkflowStatus.AI_EXECUTING);
        assertThat(events.events(session.getSessionId()))
                .extracting(ConversationEvent::eventType)
                .containsExactly("USER_MESSAGE_ACCEPTED", "AI_QUESTION", "USER_MESSAGE_ACCEPTED", "AI_MESSAGE");

        MessageAcceptance duplicate = conversations.acceptInitial(session.getSessionId(),
                "request-1", "user-message-1", "100만원으로 예금 가입해줘", null);
        coordinator.process(session.getSessionId(), duplicate, "100만원으로 예금 가입해줘", null);
        assertThat(calls).hasValue(1);
        assertThat(events.events(session.getSessionId())).hasSize(4);
        assertThat(conversations.snapshot(session.getSessionId()).conversationSequence()).isEqualTo(4);
    }
}
