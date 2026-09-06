package com.ddd.backend.conversation.goal;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class GoalRouteCompatibilityPolicyTest {
    private final GoalRouteCompatibilityPolicy policy = new GoalRouteCompatibilityPolicy();

    @Test
    void entry_stage와_user_route와_snapshot_route가_모두_일치해야_overlay를_허용한다() {
        UserGoalAuthority authority = new UserGoalAuthority();
        UserGoal initial = authority.snapshot();
        UserGoal deposit = authority.apply(initial.goalId(), 0, "message-1",
                new UserGoalPatch(0, "DEPOSIT", new UserGoal.Amount("1000000", "KRW"),
                        new UserGoal.Duration(12, "MONTH"), List.of(), null, null), null);

        assertThat(policy.allowsOverlay(deposit, "/deposit/products",
                "http://localhost:3000/deposit/products")).isTrue();
        assertThat(policy.allowsOverlay(deposit, "/transfer/accounts",
                "http://localhost:3000/transfer/accounts")).isFalse();
        assertThat(policy.allowsOverlay(deposit, "/deposit/products",
                "http://localhost:3000/transfer/accounts")).isFalse();
    }
}
