package com.ddd.backend.conversation.navigation;

import com.ddd.backend.automation.session.BrowserSessionManager;
import com.ddd.backend.conversation.ConversationService;
import com.ddd.backend.conversation.ConversationState;
import com.ddd.backend.conversation.agent.ConversationAgentCoordinator;
import com.ddd.backend.conversation.agent.ConversationAgentDomDecisionService;
import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.domain.session.AutomationSessionRepository;
import com.ddd.backend.domain.session.WorkflowStatus;
import com.ddd.backend.security.navigation.DemoNavigationPolicy;
import com.ddd.backend.security.navigation.DemoNavigationTarget;
import org.springframework.stereotype.Service;

import java.util.Set;

@Service
public final class NavigationPageReadyResumeAdapter implements BrowserPageReadyResumePort {
    private static final Set<WorkflowStatus> BLOCKED = Set.of(
            WorkflowStatus.SECURE_INPUT_REQUIRED, WorkflowStatus.RISK_WARNING,
            WorkflowStatus.FINAL_CONFIRMATION_REQUIRED, WorkflowStatus.COMPLETED,
            WorkflowStatus.CANCELLED, WorkflowStatus.ERROR, WorkflowStatus.TERMINATED);

    private final NavigationDecisionRegistry decisions;
    private final AutomationSessionRepository sessions;
    private final ConversationService conversations;
    private final BrowserSessionManager browserSessions;
    private final DemoNavigationPolicy navigationPolicy;
    private final ConversationAgentDomDecisionService domDecisions;
    private final ConversationAgentCoordinator coordinator;

    public NavigationPageReadyResumeAdapter(
            NavigationDecisionRegistry decisions,
            AutomationSessionRepository sessions,
            ConversationService conversations,
            BrowserSessionManager browserSessions,
            DemoNavigationPolicy navigationPolicy,
            ConversationAgentDomDecisionService domDecisions,
            ConversationAgentCoordinator coordinator) {
        this.decisions = decisions;
        this.sessions = sessions;
        this.conversations = conversations;
        this.browserSessions = browserSessions;
        this.navigationPolicy = navigationPolicy;
        this.domDecisions = domDecisions;
        this.coordinator = coordinator;
    }

    @Override
    public void resumeOnce(PendingBrowserNavigation navigation) {
        NavigationDecisionContext context = decisions.claimResume(navigation.navigationId());
        try {
            AutomationSession session = sessions.findById(navigation.sessionId())
                    .orElseThrow(() -> new BrowserNavigationException(BrowserNavigationError.NAVIGATION_NOT_FOUND));
            if (BLOCKED.contains(session.getStatus()) || session.getStatus() != WorkflowStatus.PAGE_LOADING) {
                throw new BrowserNavigationException(BrowserNavigationError.NAVIGATION_WORKFLOW_CONFLICT);
            }
            ConversationState state = conversations.state(navigation.sessionId());
            synchronized (state) {
                if (state.goalRevision() != context.goalRevision()) {
                    throw new BrowserNavigationException(BrowserNavigationError.NAVIGATION_STALE);
                }
                DemoNavigationTarget target = navigationPolicy.resolve(
                        DemoNavigationPolicy.DEMO_BANK_SITE_ID, navigation.destinationRoute());
                String finalUrl = browserSessions.navigate(navigation.sessionId(), target.targetUri());
                navigationPolicy.validateNavigatedTarget(target, finalUrl);
                session.updateCurrentUrl(finalUrl);
                session.transitionTo(WorkflowStatus.AI_EXECUTING);
                sessions.save(session);
                var result = domDecisions.decideAfterNavigation(navigation.sessionId(), context, state);
                coordinator.applyObservedDomDecision(
                        navigation.sessionId(), result.decision(), result.snapshot());
            }
            decisions.completeResume(navigation.navigationId());
        } catch (RuntimeException exception) {
            decisions.failResume(navigation.navigationId());
            throw exception;
        }
    }
}
