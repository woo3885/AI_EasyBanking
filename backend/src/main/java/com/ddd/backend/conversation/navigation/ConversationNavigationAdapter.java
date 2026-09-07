package com.ddd.backend.conversation.navigation;

import com.ddd.backend.automation.dom.SanitizedDomSnapshot;
import com.ddd.backend.conversation.ConversationState;
import com.ddd.backend.conversation.agent.ConversationAgentDecision;
import com.ddd.backend.conversation.bridge.UserBrowserBridgeRegistry;
import com.ddd.backend.conversation.goal.GoalRouteCompatibilityPolicy;
import org.springframework.stereotype.Service;

import java.net.URI;

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
            String sessionId, ConversationState state, ConversationAgentDecision decision,
            SanitizedDomSnapshot snapshot) {
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
        String observedRoute = routeFromSnapshot(snapshot);
        if (expectedRoute == null || !expectedRoute.equals(candidateRoute)
                || observedRoute == null || expectedRoute.equals(observedRoute)) {
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

    private String routeFromSnapshot(SanitizedDomSnapshot snapshot) {
        if (snapshot == null || snapshot.page() == null
                || snapshot.page().url() == null || snapshot.page().url().isBlank()) return null;
        try {
            String path = URI.create(snapshot.page().url()).getPath();
            if (path == null || path.isBlank()) return "/";
            return path.length() > 1 && path.endsWith("/")
                    ? path.substring(0, path.length() - 1) : path;
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }
}
