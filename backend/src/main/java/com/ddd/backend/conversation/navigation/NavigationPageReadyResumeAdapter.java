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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Set;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@Service
public final class NavigationPageReadyResumeAdapter implements BrowserPageReadyResumePort {
    private static final Logger log = LoggerFactory.getLogger(NavigationPageReadyResumeAdapter.class);
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
        String decisionType = "NOT_DECIDED";
        String screenType = screenType(navigation.destinationRoute());
        String snapshotId = null;
        String failureStage = "DESTINATION_SYNC";
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
                failureStage = "DESTINATION_SNAPSHOT_OR_AI";
                var result = domDecisions.decideAfterNavigation(navigation.sessionId(), context, state);
                snapshotId = result.snapshot().snapshotId();
                decisionType = result.decision().mode().name();
                failureStage = "DECISION_MATERIALIZATION";
                coordinator.applyObservedDomDecision(
                        navigation.sessionId(), result.decision(), result.snapshot());
            }
            decisions.completeResume(navigation.navigationId());
        } catch (RuntimeException exception) {
            decisions.failResume(navigation.navigationId());
            PageReadyResumeError domainError = PageReadyResumeErrors.classify(exception);
            log.error("Page-ready resume failed. sessionRef={} navigationRef={} pageRef={} "
                            + "snapshotRef={} decisionType={} screenType={} domainError={} failureStage={}",
                    safeRef(navigation.sessionId()), safeRef(navigation.navigationId()),
                    safeRef(navigation.destinationPageIdentity()), safeRef(snapshotId),
                    decisionType, screenType, domainError.name(), failureStage);
            sessions.findById(navigation.sessionId()).ifPresent(session -> {
                if (!BLOCKED.contains(session.getStatus())) {
                    session.transitionTo(WorkflowStatus.ERROR);
                    sessions.save(session);
                }
            });
            throw exception;
        }
    }

    private String screenType(String route) {
        return "/deposit/products".equals(route) ? "D25_PRODUCT_LIST"
                : "/transfer/accounts".equals(route) ? "TRANSFER_ACCOUNT_LIST" : "UNKNOWN";
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
}
