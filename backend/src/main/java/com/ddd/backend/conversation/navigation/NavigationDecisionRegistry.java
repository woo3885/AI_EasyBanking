package com.ddd.backend.conversation.navigation;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

import static com.ddd.backend.conversation.navigation.BrowserNavigationError.*;

@Component
public final class NavigationDecisionRegistry {
    private final ConcurrentHashMap<String, Map<String, NavigationDecisionContext>> decisions =
            new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, NavigationDecisionContext> byNavigationId =
            new ConcurrentHashMap<>();

    public synchronized NavigationDecisionContext startOnce(
            NavigationDecisionContext proposed,
            Supplier<PendingBrowserNavigation> navigationFactory) {
        Map<String, NavigationDecisionContext> sessionDecisions = decisions.computeIfAbsent(
                proposed.sessionId(), ignored -> new ConcurrentHashMap<>());
        NavigationDecisionContext existing = sessionDecisions.get(proposed.decisionId());
        if (existing != null) {
            if (sameDecision(existing, proposed)) return existing;
            throw new BrowserNavigationException(NAVIGATION_STALE);
        }
        PendingBrowserNavigation navigation = navigationFactory.get();
        NavigationDecisionContext stored = proposed.withNavigationId(navigation.navigationId());
        sessionDecisions.put(stored.decisionId(), stored);
        byNavigationId.put(stored.navigationId(), stored);
        return stored;
    }

    public synchronized NavigationDecisionContext claimResume(String navigationId) {
        NavigationDecisionContext value = byNavigationId.get(navigationId);
        if (value == null) throw new BrowserNavigationException(NAVIGATION_NOT_FOUND);
        if (value.resumeStatus() != NavigationDecisionContext.ResumeStatus.PENDING) {
            throw new BrowserNavigationException(PAGE_READY_ALREADY_ACCEPTED);
        }
        NavigationDecisionContext claimed = value.withResumeStatus(
                NavigationDecisionContext.ResumeStatus.IN_PROGRESS);
        replace(claimed);
        return claimed;
    }

    public synchronized void completeResume(String navigationId) {
        updateResume(navigationId, NavigationDecisionContext.ResumeStatus.COMPLETED);
    }

    public synchronized void failResume(String navigationId) {
        updateResume(navigationId, NavigationDecisionContext.ResumeStatus.FAILED);
    }

    public synchronized void removeSession(String sessionId) {
        Map<String, NavigationDecisionContext> removed = decisions.remove(sessionId);
        if (removed != null) removed.values().forEach(value -> byNavigationId.remove(value.navigationId()));
    }

    private void updateResume(String navigationId, NavigationDecisionContext.ResumeStatus status) {
        NavigationDecisionContext value = byNavigationId.get(navigationId);
        if (value == null) throw new BrowserNavigationException(NAVIGATION_NOT_FOUND);
        replace(value.withResumeStatus(status));
    }

    private void replace(NavigationDecisionContext value) {
        decisions.get(value.sessionId()).put(value.decisionId(), value);
        byNavigationId.put(value.navigationId(), value);
    }

    private boolean sameDecision(NavigationDecisionContext left, NavigationDecisionContext right) {
        return Objects.equals(left.requestMessageId(), right.requestMessageId())
                && left.goalRevision() == right.goalRevision()
                && Objects.equals(left.sourceSnapshotId(), right.sourceSnapshotId())
                && left.semanticRoute() == right.semanticRoute()
                && left.navigationMode() == right.navigationMode();
    }
}
