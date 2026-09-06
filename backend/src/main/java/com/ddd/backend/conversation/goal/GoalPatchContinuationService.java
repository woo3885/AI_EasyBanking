package com.ddd.backend.conversation.goal;

import com.ddd.backend.ai.AgentLoopService;
import com.ddd.backend.automation.dom.SanitizedDomSnapshotService;
import com.ddd.backend.common.exception.SessionNotFoundException;
import com.ddd.backend.conversation.ConversationState;
import com.ddd.backend.conversation.ConversationStateStore;
import com.ddd.backend.conversation.SessionMessageMailbox;
import com.ddd.backend.conversation.agent.ConversationAgentDecision;
import com.ddd.backend.conversation.agent.ConversationInteractionMode;
import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.domain.session.AutomationSessionRepository;
import com.ddd.backend.domain.session.WorkflowStatus;
import org.springframework.stereotype.Service;

import java.util.Set;

/** 사용자 답변 patch 적용과 다음 DOM 판단 사이의 Backend authoritative 경계. */
@Service
public final class GoalPatchContinuationService {

    private static final Set<WorkflowStatus> PROTECTED_OR_TERMINAL = Set.of(
            WorkflowStatus.SECURE_INPUT_REQUIRED,
            WorkflowStatus.RISK_WARNING,
            WorkflowStatus.FINAL_CONFIRMATION_REQUIRED,
            WorkflowStatus.CANCELLED,
            WorkflowStatus.ERROR,
            WorkflowStatus.TERMINATED,
            WorkflowStatus.COMPLETED
    );

    private final AutomationSessionRepository sessionRepository;
    private final ConversationStateStore stateStore;
    private final SessionMessageMailbox mailbox;
    private final SanitizedDomSnapshotService snapshotService;
    private final AgentLoopService agentLoopService;

    public GoalPatchContinuationService(
            AutomationSessionRepository sessionRepository,
            ConversationStateStore stateStore,
            SessionMessageMailbox mailbox,
            SanitizedDomSnapshotService snapshotService,
            AgentLoopService agentLoopService
    ) {
        this.sessionRepository = sessionRepository;
        this.stateStore = stateStore;
        this.mailbox = mailbox;
        this.snapshotService = snapshotService;
        this.agentLoopService = agentLoopService;
    }

    public GoalPatchContinuationResult applyAndResume(
            String sessionId,
            String answerToQuestionId,
            ConversationAgentDecision decision
    ) {
        if (decision == null
                || decision.mode() != ConversationInteractionMode.GOAL_PATCH_PROPOSED) {
            throw new IllegalArgumentException("GOAL_PATCH_PROPOSED decision이 필요합니다.");
        }
        AutomationSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new SessionNotFoundException(sessionId));
        ConversationState state = stateStore.find(sessionId)
                .orElseThrow(() -> new IllegalStateException("대화 상태를 찾을 수 없습니다."));
        UserGoal currentGoal = state.goal();
        if (decision.requestMessageId().equals(currentGoal.lastAppliedMessageId())) {
            return new GoalPatchContinuationResult(
                    sessionId, decision.requestMessageId(), currentGoal.goalId(),
                    currentGoal.revision(), true, false);
        }
        if (PROTECTED_OR_TERMINAL.contains(session.getStatus())) {
            throw new IllegalStateException("보호 또는 종료 상태에서는 Goal patch를 적용할 수 없습니다.");
        }
        if (session.getStatus() != WorkflowStatus.ADDITIONAL_INFORMATION_REQUIRED) {
            throw new IllegalStateException("추가 정보 답변을 기다리는 상태가 아닙니다.");
        }
        if (!mailbox.isActive(sessionId, decision.requestMessageId())) {
            throw new IllegalStateException("현재 active turn과 requestMessageId가 일치하지 않습니다.");
        }

        synchronized (state) {
            state.requireActiveQuestion(answerToQuestionId);
            state.applyGoalPatch(
                    decision.goalId(), decision.baseGoalRevision(),
                    decision.requestMessageId(), decision.goalPatch(), null);
            state.clearQuestion(answerToQuestionId);
            session.submitDecision();
            sessionRepository.save(session);
            mailbox.completeActive(sessionId, decision.requestMessageId());
            snapshotService.createSnapshot(sessionId);
            boolean resumed = agentLoopService.resume(sessionId);
            UserGoal applied = state.goal();
            return new GoalPatchContinuationResult(
                    sessionId, decision.requestMessageId(), applied.goalId(),
                    applied.revision(), false, resumed);
        }
    }
}
