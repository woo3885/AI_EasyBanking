package com.ddd.backend.conversation.goal;

import com.ddd.backend.ai.AgentLoopService;
import com.ddd.backend.automation.dom.SanitizedDomSnapshotService;
import com.ddd.backend.conversation.ConversationError;
import com.ddd.backend.conversation.ConversationException;
import com.ddd.backend.conversation.ConversationState;
import com.ddd.backend.conversation.ConversationStateStore;
import com.ddd.backend.conversation.SessionMessageMailbox;
import com.ddd.backend.conversation.agent.ConversationAgentDecision;
import com.ddd.backend.conversation.agent.ConversationInteractionMode;
import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.domain.session.WorkflowStatus;
import com.ddd.backend.infrastructure.session.InMemoryAutomationSessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class GoalPatchContinuationServiceTest {

    private InMemoryAutomationSessionRepository sessions;
    private ConversationStateStore states;
    private SessionMessageMailbox mailbox;
    private SanitizedDomSnapshotService snapshotService;
    private AgentLoopService agentLoopService;
    private GoalPatchContinuationService service;
    private AutomationSession session;
    private ConversationState state;

    @BeforeEach
    void setUp() {
        sessions = new InMemoryAutomationSessionRepository();
        states = new ConversationStateStore(Duration.ofMinutes(30));
        mailbox = new SessionMessageMailbox();
        snapshotService = mock(SanitizedDomSnapshotService.class);
        agentLoopService = mock(AgentLoopService.class);
        service = new GoalPatchContinuationService(
                sessions, states, mailbox, snapshotService, agentLoopService);

        session = AutomationSession.create("100만원 예금");
        session.transitionTo(WorkflowStatus.ADDITIONAL_INFORMATION_REQUIRED);
        sessions.save(session);
        state = states.getOrCreate(session.getSessionId());
        state.activateQuestion("question-duration");
        mailbox.offer(session.getSessionId(), "msg-answer");
        when(agentLoopService.resume(session.getSessionId())).thenReturn(true);
    }

    @Test
    void patch를_적용하고_question을_clear한_뒤_최신DOM과_loop를_한번만_재개한다() {
        GoalPatchContinuationResult result = service.applyAndResume(
                session.getSessionId(), "question-duration", decision(0));

        assertThat(result.goalRevision()).isEqualTo(1);
        assertThat(result.duplicate()).isFalse();
        assertThat(result.agentLoopResumeAccepted()).isTrue();
        assertThat(state.snapshot().activeQuestionId()).isNull();
        assertThat(state.snapshot().goal().duration().value()).isEqualTo(12);
        assertThat(session.getStatus()).isEqualTo(WorkflowStatus.AI_EXECUTING);
        verify(snapshotService).createSnapshot(session.getSessionId());
        verify(agentLoopService).resume(session.getSessionId());

        GoalPatchContinuationResult duplicate = service.applyAndResume(
                session.getSessionId(), "question-duration", decision(0));
        assertThat(duplicate.duplicate()).isTrue();
        assertThat(duplicate.agentLoopResumeAccepted()).isFalse();
        verify(snapshotService, times(1)).createSnapshot(session.getSessionId());
        verify(agentLoopService, times(1)).resume(session.getSessionId());
    }

    @Test
    void stale_revision은_question과_goal을_변경하지_않고_폐기한다() {
        assertThatThrownBy(() -> service.applyAndResume(
                session.getSessionId(), "question-duration", decision(1)))
                .isInstanceOf(ConversationException.class)
                .extracting(error -> ((ConversationException) error).error())
                .isEqualTo(ConversationError.STALE_GOAL_REVISION);

        assertThat(state.snapshot().activeQuestionId()).isEqualTo("question-duration");
        assertThat(state.snapshot().goal().revision()).isZero();
        verify(snapshotService, never()).createSnapshot(session.getSessionId());
        verify(agentLoopService, never()).resume(session.getSessionId());
    }

    private ConversationAgentDecision decision(long baseRevision) {
        return new ConversationAgentDecision(
                "req-answer", "msg-answer", state.snapshot().goal().goalId(), baseRevision,
                ConversationInteractionMode.GOAL_PATCH_PROPOSED,
                null, 1.0, "ANSWER_PATCHED", "LATEST_DOM_DECISION",
                null,
                new UserGoalPatch(baseRevision, null, null,
                        new UserGoal.Duration(12, "MONTH"), List.of(), null, null),
                null, null);
    }
}
