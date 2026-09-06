package com.ddd.backend.conversation.goal;

import org.springframework.stereotype.Component;

import java.net.URI;

@Component
public final class GoalRouteCompatibilityPolicy {
    public String expectedRoute(UserGoal goal) {
        if (goal == null) return null;
        return switch (goal.stage()) {
            case UserGoalCompletenessPolicy.DEPOSIT_ENTRY -> "/deposit/products";
            case UserGoalCompletenessPolicy.TRANSFER_ENTRY -> "/transfer/accounts";
            default -> null;
        };
    }

    public boolean allowsOverlay(UserGoal goal, String userRoute, String snapshotUrl) {
        String expected = expectedRoute(goal);
        return expected != null && expected.equals(normalizeRoute(userRoute))
                && expected.equals(routeFromUrl(snapshotUrl));
    }

    private String routeFromUrl(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return normalizeRoute(URI.create(value).getPath());
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    private String normalizeRoute(String value) {
        if (value == null || value.isBlank()) return null;
        if (!value.startsWith("/") || value.contains("?") || value.contains("#")) return null;
        return value.length() > 1 && value.endsWith("/")
                ? value.substring(0, value.length() - 1) : value;
    }
}
