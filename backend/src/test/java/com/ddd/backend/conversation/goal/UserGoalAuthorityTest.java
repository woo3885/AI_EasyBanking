package com.ddd.backend.conversation.goal;

import com.ddd.backend.conversation.ConversationError;
import com.ddd.backend.conversation.ConversationException;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class UserGoalAuthorityTest {

    @Test
    void backend가_goalId를_유지하고_patch_적용시에만_revision을_증가시킨다() {
        UserGoalAuthority authority = new UserGoalAuthority();
        UserGoal initial = authority.snapshot();

        UserGoal updated = authority.apply(initial.goalId(), 0, "turn-1",
                new UserGoalPatch(0, "DEPOSIT", new UserGoal.Amount("1000000", "KRW"),
                        null, List.of("duration"), "duration", null), null);

        assertThat(updated.goalId()).isEqualTo(initial.goalId());
        assertThat(updated.revision()).isEqualTo(1);
        assertThat(updated.intent()).isEqualTo("DEPOSIT");
        assertThat(updated.amount().value()).isEqualTo("1000000");
        assertThat(updated.missingFields()).containsExactly("duration");
        assertThat(updated.lastAppliedMessageId()).isEqualTo("turn-1");
    }

    @Test
    void stale_base_revision의_patch는_적용하지_않는다() {
        UserGoalAuthority authority = new UserGoalAuthority();
        UserGoal initial = authority.snapshot();
        authority.apply(initial.goalId(), 0, "turn-1",
                new UserGoalPatch(0, "DEPOSIT", null, null,
                        List.of("duration"), "duration", null), null);

        assertThatThrownBy(() -> authority.apply(initial.goalId(), 0, "turn-2",
                new UserGoalPatch(0, null, null, new UserGoal.Duration(12, "MONTH"),
                        List.of(), null, null), null))
                .isInstanceOf(ConversationException.class)
                .extracting(error -> ((ConversationException) error).error())
                .isEqualTo(ConversationError.STALE_GOAL_REVISION);
        assertThat(authority.snapshot().revision()).isEqualTo(1);
    }
}
