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
        assertThat(updated.stage()).isEqualTo(UserGoalCompletenessPolicy.INFORMATION_COLLECTION);
    }

    @Test
    void 완성된_예금과_이체_goal만_entry_stage로_전환한다() {
        UserGoalAuthority deposit = new UserGoalAuthority();
        UserGoal depositGoal = deposit.snapshot();
        UserGoal completeDeposit = deposit.apply(depositGoal.goalId(), 0, "deposit-message",
                new UserGoalPatch(0, "DEPOSIT", new UserGoal.Amount("1000000", "KRW"),
                        new UserGoal.Duration(12, "MONTH"), List.of(), null, null), null);
        assertThat(completeDeposit.stage()).isEqualTo(UserGoalCompletenessPolicy.DEPOSIT_ENTRY);

        UserGoalAuthority transfer = new UserGoalAuthority();
        UserGoal transferGoal = transfer.snapshot();
        UserGoal completeTransfer = transfer.apply(transferGoal.goalId(), 0, "transfer-message",
                new UserGoalPatch(0, "TRANSFER", null, null, List.of(), null, null), null);
        assertThat(completeTransfer.stage()).isEqualTo(UserGoalCompletenessPolicy.TRANSFER_ENTRY);
    }

    @Test
    void 동일_message_patch는_revision과_stage를_다시_변경하지_않는다() {
        UserGoalAuthority authority = new UserGoalAuthority();
        UserGoal initial = authority.snapshot();
        UserGoalPatch patch = new UserGoalPatch(0, "DEPOSIT",
                new UserGoal.Amount("1000000", "KRW"),
                new UserGoal.Duration(12, "MONTH"), List.of(), null, null);
        UserGoal first = authority.apply(initial.goalId(), 0, "same-message", patch, null);
        UserGoal duplicate = authority.apply(initial.goalId(), 0, "same-message", patch, null);

        assertThat(duplicate).isEqualTo(first);
        assertThat(duplicate.revision()).isEqualTo(1);
        assertThat(duplicate.stage()).isEqualTo(UserGoalCompletenessPolicy.DEPOSIT_ENTRY);
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
