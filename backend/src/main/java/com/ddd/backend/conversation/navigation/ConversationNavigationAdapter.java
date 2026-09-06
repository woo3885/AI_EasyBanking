package com.ddd.backend.conversation.navigation;

import com.ddd.backend.conversation.ConversationState;
import com.ddd.backend.conversation.agent.ConversationAgentDecision;
import com.ddd.backend.conversation.bridge.UserBrowserBridgeRegistry;
import org.springframework.stereotype.Service;

@Service
public final class ConversationNavigationAdapter {
    private final BrowserNavigationService navigations;
    private final BrowserSemanticRouteMapper routes;
    private final NavigationDecisionRegistry decisions;
    private final UserBrowserBridgeRegistry bindings;

    public ConversationNavigationAdapter(BrowserNavigationService navigations,
            BrowserSemanticRouteMapper routes, NavigationDecisionRegistry decisions,
            UserBrowserBridgeRegistry bindings) {
        this.navigations = navigations;
        this.routes = routes;
        this.decisions = decisions;
        this.bindings = bindings;
    }

    public NavigationDecisionContext start(
            String sessionId, ConversationState state, ConversationAgentDecision decision) {
        var candidate = decision.navigationCandidate();
        if (candidate == null || decision.decisionId() == null || decision.decisionId().isBlank()) {
            throw new IllegalArgumentException("구조화된 navigation intent가 필요합니다.");
        }
        if (state.goalRevision() != decision.baseGoalRevision()) {
            throw new BrowserNavigationException(BrowserNavigationError.NAVIGATION_STALE);
        }
        bindings.find(sessionId).orElseThrow(() -> new BrowserNavigationException(
                BrowserNavigationError.BROWSER_BINDING_NOT_FOUND));
        NavigationDecisionContext proposed = new NavigationDecisionContext(
                sessionId, decision.decisionId(), decision.requestId(), decision.requestMessageId(),
                decision.baseGoalRevision(), decision.sourceSnapshotId(), candidate.semanticRoute(),
                candidate.navigationMode(), null, NavigationDecisionContext.ResumeStatus.PENDING);
        return decisions.startOnce(proposed, () -> navigations.requireNavigation(
                sessionId, routes.toPath(candidate.semanticRoute()),
                decision.baseGoalRevision(), candidate.navigationMode(), decision.message()));
    }
}
