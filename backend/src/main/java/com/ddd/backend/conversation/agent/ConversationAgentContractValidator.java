package com.ddd.backend.conversation.agent;
import com.ddd.backend.conversation.ConversationMessagePolicy;
import com.ddd.backend.conversation.navigation.PageReadyResumeError;
import com.ddd.backend.conversation.overlay.GuideUserMaterializationException;
import org.springframework.stereotype.Component;
import java.util.*;

@Component
public final class ConversationAgentContractValidator {
    private static final Set<ConversationInteractionMode> SNAPSHOT_REQUIRED = EnumSet.of(
            ConversationInteractionMode.AUTO_EXECUTE, ConversationInteractionMode.GUIDE_USER,
            ConversationInteractionMode.NAVIGATION_REQUIRED,
            ConversationInteractionMode.SECURE_INPUT_REQUIRED, ConversationInteractionMode.RISK_WARNING,
            ConversationInteractionMode.FINAL_CONFIRMATION_REQUIRED, ConversationInteractionMode.COMPLETE);
    private final ConversationMessagePolicy messagePolicy;
    public ConversationAgentContractValidator(ConversationMessagePolicy messagePolicy) { this.messagePolicy = messagePolicy; }

    public ConversationAgentDecision validate(ConversationAgentRequest request, ConversationAgentDecision decision) {
        Objects.requireNonNull(request); Objects.requireNonNull(decision);
        if (!request.requestId().equals(decision.requestId())
                || !request.requestMessageId().equals(decision.requestMessageId())
                || !request.goal().goalId().equals(decision.goalId())) throw new IllegalArgumentException("Agent identity mismatch");
        if (request.goal().revision() != decision.baseGoalRevision()) throw new IllegalArgumentException("Stale Agent decision");
        if (decision.mode() == null || !Double.isFinite(decision.confidence())
                || decision.confidence() < 0 || decision.confidence() > 1) throw new IllegalArgumentException("Invalid mode/confidence");
        if (decision.message() != null) {
            messagePolicy.sanitize(decision.message());
            if (decision.message().contains("\n") || decision.message().contains("\r"))
                throw new IllegalArgumentException("Agent message must be one line");
        }
        if (SNAPSHOT_REQUIRED.contains(decision.mode())) {
            String expected = request.snapshot() == null ? null : request.snapshot().sourceSnapshotId();
            if (expected == null || !expected.equals(decision.sourceSnapshotId())) {
                if (decision.mode() == ConversationInteractionMode.GUIDE_USER) {
                    throw new GuideUserMaterializationException(PageReadyResumeError.GUIDE_USER_TARGET_INVALID);
                }
                throw new IllegalArgumentException("Invalid sourceSnapshotId");
            }
        }
        if (decision.goalPatch() != null
                && decision.goalPatch().basedOnRevision() != decision.baseGoalRevision())
            throw new IllegalArgumentException("goalPatch basedOnRevision mismatch");
        if (decision.mode() == ConversationInteractionMode.ASK_USER) {
            if (decision.question() == null || blank(decision.question().fieldKey())
                    || decision.message() == null || decision.goalPatch() == null || decision.goalPatch().isEmpty())
                throw new IllegalArgumentException("ASK_USER requires message, question, and patch");
            if (decision.actionCandidate() != null) throw new IllegalArgumentException("ASK_USER cannot execute action");
        } else if (decision.question() != null) throw new IllegalArgumentException("Question only allowed for ASK_USER");
        if (decision.mode() == ConversationInteractionMode.GOAL_PATCH_PROPOSED) {
            if (decision.goalPatch() == null || decision.goalPatch().isEmpty() || decision.message() != null
                    || decision.sourceSnapshotId() != null || decision.question() != null
                    || decision.actionCandidate() != null
                    || !"LATEST_DOM_DECISION".equals(decision.nextCondition()))
                throw new IllegalArgumentException("Invalid GOAL_PATCH_PROPOSED");
        }
        if (decision.actionCandidate() != null && request.snapshot() == null)
            throw new IllegalArgumentException("Action candidate requires snapshot");
        if (decision.mode() == ConversationInteractionMode.GUIDE_USER) {
            var candidate = decision.actionCandidate();
            if (candidate == null) {
                throw new GuideUserMaterializationException(PageReadyResumeError.GUIDE_USER_TARGET_MISSING);
            }
            if (!"WAIT_FOR_USER".equals(candidate.actionType())
                    || blank(candidate.targetElementId()) || blank(candidate.role())
                    || blank(candidate.accessibleLabel()) || blank(candidate.guide())
                    || candidate.targetElementId().length() > 128
                    || candidate.role().length() > 32
                    || candidate.accessibleLabel().length() > 120
                    || candidate.guide().length() > 200) {
                throw new GuideUserMaterializationException(PageReadyResumeError.GUIDE_USER_TARGET_INVALID);
            }
        }
        if (decision.mode() == ConversationInteractionMode.NAVIGATION_REQUIRED) {
            if (decision.navigationCandidate() == null
                    || blank(decision.navigationCandidate().decisionId())
                    || decision.navigationCandidate().semanticRoute() == null
                    || decision.navigationCandidate().navigationMode() == null
                    || decision.actionCandidate() != null || decision.question() != null) {
                throw new IllegalArgumentException("NAVIGATION_REQUIRED requires a structured navigationCandidate");
            }
        } else if (decision.navigationCandidate() != null) {
            throw new IllegalArgumentException("Navigation identity is only allowed for NAVIGATION_REQUIRED");
        }
        if ((decision.mode() == ConversationInteractionMode.SECURE_INPUT_REQUIRED
                || decision.mode() == ConversationInteractionMode.RISK_WARNING
                || decision.mode() == ConversationInteractionMode.FINAL_CONFIRMATION_REQUIRED)
                && decision.actionCandidate() != null) {
            throw new IllegalArgumentException("Protected mode cannot create GUIDE_USER target");
        }
        return decision;
    }
    private boolean blank(String value) { return value == null || value.isBlank(); }
}
