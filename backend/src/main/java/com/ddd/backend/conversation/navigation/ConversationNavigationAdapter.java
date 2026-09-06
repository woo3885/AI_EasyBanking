package com.ddd.backend.conversation.navigation;

import com.ddd.backend.conversation.ConversationState;
import com.ddd.backend.conversation.agent.ConversationAgentDecision;
import com.ddd.backend.conversation.bridge.UserBrowserBridgeRegistry;
import com.ddd.backend.conversation.goal.GoalRouteCompatibilityPolicy;
import org.springframework.stereotype.Service;

@Service
public final class ConversationNavigationAdapter {
    private final BrowserNavigationService navigations;
    private final BrowserSemanticRouteMapper routes;
    private final NavigationDecisionRegistry decisions;
    private final UserBrowserBridgeRegistry bindings;
    private final GoalRouteCompatibilityPolicy goalRoutes;

    public ConversationNavigationAdapter(BrowserNavigationService navigations,
            BrowserSemanticRouteMapper routes, NavigationDecisionRegistry decisions,
            UserBrowserBridgeRegistry bindings, GoalRouteCompatibilityPolicy goalRoutes) {
        this.navigations = navigations;
        this.routes = routes;
        this.decisions = decisions;
        this.bindings = bindings;
        this.goalRoutes = goalRoutes;
    }

    public NavigationDecisionContext start(
            String sessionId, ConversationState state, ConversationAgentDecision decision) {
        var candidate = decision.navigationCandidate();
        if (candidate == null || candidate.decisionId() == null || candidate.decisionId().isBlank()) {
            throw new IllegalArgumentException("구조화된 navigation intent가 필요합니다.");
        }
        if (state.goalRevision() != decision.baseGoalRevision()) {
            throw new BrowserNavigationException(BrowserNavigationError.NAVIGATION_STALE);
        }
        var binding = bindings.find(sessionId).orElseThrow(() -> new BrowserNavigationException(
                BrowserNavigationError.BROWSER_BINDING_NOT_FOUND));
        String expectedRoute = goalRoutes.expectedRoute(state.goal());
        String candidateRoute = routes.toPath(candidate.semanticRoute());
        if (expectedRoute == null || !expectedRoute.equals(candidateRoute)
                || binding.currentRoute() == null || expectedRoute.equals(binding.currentRoute())) {
            throw new BrowserNavigationException(BrowserNavigationError.NAVIGATION_WORKFLOW_CONFLICT);
        }
        NavigationDecisionContext proposed = new NavigationDecisionContext(
                sessionId, candidate.decisionId(), decision.requestId(), decision.requestMessageId(),
                decision.baseGoalRevision(), decision.sourceSnapshotId(), candidate.semanticRoute(),
                candidate.navigationMode(), null, NavigationDecisionContext.ResumeStatus.PENDING);
        return decisions.startOnce(proposed, () -> navigations.requireNavigation(
                sessionId, candidateRoute,
                decision.baseGoalRevision(), candidate.navigationMode(), decision.message()));
    }
}
