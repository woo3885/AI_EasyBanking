package com.ddd.backend.conversation.agent;

import com.ddd.backend.conversation.ConversationMessagePolicy;
import com.ddd.backend.conversation.goal.UserGoalAuthority;
import com.ddd.backend.conversation.goal.UserGoalPatch;
import com.ddd.backend.conversation.navigation.BrowserNavigationMode;
import com.ddd.backend.conversation.navigation.BrowserSemanticRoute;
import com.ddd.backend.conversation.navigation.PageReadyResumeError;
import com.ddd.backend.conversation.overlay.GuideUserMaterializationException;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ConversationAgentContractValidatorTest {

    private final ConversationAgentContractValidator validator =
            new ConversationAgentContractValidator(new ConversationMessagePolicy());

    @Test
    void ask_user는_snapshot없이_fieldKey만_후보로_반환할_수_있다() {
        var request = request(null);
        var decision = new ConversationAgentDecision(
                "req-1", "msg-1", request.goal().goalId(), 0,
                ConversationInteractionMode.ASK_USER,
                "기간을 알려주세요.", 0.9, "MISSING_FIELD", "USER_ANSWER",
                null,
                new UserGoalPatch(0, "DEPOSIT", new com.ddd.backend.conversation.goal.UserGoal.Amount("1000000", "KRW"),
                        null, List.of("duration"), "duration", null),
                new ConversationAgentDecision.QuestionCandidate("durationMonths"),
                null);

        assertThat(validator.validate(request, decision)).isSameAs(decision);
    }

    @Test
    void dom기반_mode는_동일_sourceSnapshotId가_필수다() {
        var request = request(new ConversationAgentRequest.SnapshotContext(
                "snap-1", "page-1", null));
        var decision = new ConversationAgentDecision(
                "req-1", "msg-1", request.goal().goalId(), 0,
                ConversationInteractionMode.GUIDE_USER,
                "버튼을 직접 눌러주세요.", 0.8, "USER_ACTION_REQUIRED", "DOM_CHANGE",
                null, null, null,
                new ConversationAgentDecision.ActionCandidate("CLICK"));

        assertThatThrownBy(() -> validator.validate(request, decision))
                .isInstanceOfSatisfying(GuideUserMaterializationException.class,
                        error -> assertThat(error.error()).isEqualTo(PageReadyResumeError.GUIDE_USER_TARGET_INVALID));
    }

    @Test
    void guide_user는_selector가_아닌_sanitized_target_reference가_필수다() {
        var request = request(new ConversationAgentRequest.SnapshotContext(
                "snap-1", "page-1", null));
        var valid = new ConversationAgentDecision(
                "req-1", "msg-1", request.goal().goalId(), 0,
                ConversationInteractionMode.GUIDE_USER,
                "버튼을 직접 눌러주세요.", 0.8, "USER_ACTION_REQUIRED", "DOM_CHANGE",
                "snap-1", null, null,
                new ConversationAgentDecision.ActionCandidate(
                        "WAIT_FOR_USER", "el-snap-001", "button",
                        "12개월 상품 선택", "이 버튼을 직접 눌러 주세요."));

        assertThat(validator.validate(request, valid)).isSameAs(valid);

        var missingTarget = new ConversationAgentDecision(
                "req-1", "msg-1", request.goal().goalId(), 0,
                ConversationInteractionMode.GUIDE_USER,
                "버튼을 직접 눌러주세요.", 0.8, "USER_ACTION_REQUIRED", "DOM_CHANGE",
                "snap-1", null, null,
                new ConversationAgentDecision.ActionCandidate("WAIT_FOR_USER"));
        assertThatThrownBy(() -> validator.validate(request, missingTarget))
                .isInstanceOfSatisfying(GuideUserMaterializationException.class,
                        error -> assertThat(error.error()).isEqualTo(PageReadyResumeError.GUIDE_USER_TARGET_INVALID));

        var missingCandidate = new ConversationAgentDecision(
                "req-1", "msg-1", request.goal().goalId(), 0,
                ConversationInteractionMode.GUIDE_USER,
                "버튼을 직접 눌러주세요.", 0.8, "USER_ACTION_REQUIRED", "DOM_CHANGE",
                "snap-1", null, null, null);
        assertThatThrownBy(() -> validator.validate(request, missingCandidate))
                .isInstanceOfSatisfying(GuideUserMaterializationException.class,
                        error -> assertThat(error.error()).isEqualTo(PageReadyResumeError.GUIDE_USER_TARGET_MISSING));
    }

    @Test
    void c가_goal_identity나_base_revision을_바꾸면_거부한다() {
        var request = request(null);
        var decision = new ConversationAgentDecision(
                "req-1", "msg-1", "c-created-goal", 1,
                ConversationInteractionMode.STOP,
                "중단합니다.", 1.0, "POLICY_STOP", "NONE",
                null, null, null, null);

        assertThatThrownBy(() -> validator.validate(request, decision))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("identity");
    }

    @Test
    void goal_patch_proposed는_patch만_허용하고_snapshot_question_action을_금지한다() {
        var request = request(null);
        var valid = new ConversationAgentDecision(
                "req-1", "msg-1", request.goal().goalId(), 0,
                ConversationInteractionMode.GOAL_PATCH_PROPOSED,
                null, 0.95, "ANSWER_PATCHED", "LATEST_DOM_DECISION",
                null,
                new UserGoalPatch(0, null, null,
                        new com.ddd.backend.conversation.goal.UserGoal.Duration(12, "MONTH"),
                        List.of(), null, null),
                null, null);

        assertThat(validator.validate(request, valid)).isSameAs(valid);

        var invalid = new ConversationAgentDecision(
                "req-1", "msg-1", request.goal().goalId(), 0,
                ConversationInteractionMode.GOAL_PATCH_PROPOSED,
                null, 0.95, "ANSWER_PATCHED", "LATEST_DOM_DECISION",
                "snap-old", valid.goalPatch(), null, null);
        assertThatThrownBy(() -> validator.validate(request, invalid))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("GOAL_PATCH_PROPOSED");
    }

    @Test
    void navigation_required는_selector나_url이_아닌_semantic_route만_허용한다() {
        var request = request(new ConversationAgentRequest.SnapshotContext(
                "snap-1", "page-1", null));
        var valid = new ConversationAgentDecision(
                "req-1", "msg-1", request.goal().goalId(), 0,
                ConversationInteractionMode.NAVIGATION_REQUIRED,
                "예금 상품 화면으로 이동합니다.", 0.95, "ROUTE_REQUIRED", "PAGE_READY",
                "snap-1", null, null, null,
                new ConversationAgentDecision.NavigationCandidate("decision-nav-1",
                        BrowserSemanticRoute.DEPOSIT_PRODUCTS, BrowserNavigationMode.SPA_PUSH));

        assertThat(validator.validate(request, valid)).isSameAs(valid);

        var missingDecisionIdentity = new ConversationAgentDecision(
                "req-1", "msg-1", request.goal().goalId(), 0,
                ConversationInteractionMode.NAVIGATION_REQUIRED,
                "이동합니다.", 0.95, "ROUTE_REQUIRED", "PAGE_READY",
                "snap-1", null, null, null,
                new ConversationAgentDecision.NavigationCandidate(null,
                        BrowserSemanticRoute.DEPOSIT_PRODUCTS, BrowserNavigationMode.SPA_PUSH));
        assertThatThrownBy(() -> validator.validate(request, missingDecisionIdentity))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("structured navigationCandidate");
    }

    private ConversationAgentRequest request(
            ConversationAgentRequest.SnapshotContext snapshot
    ) {
        return new ConversationAgentRequest(
                "session-1", "req-1", "msg-1", 1,
                new UserGoalAuthority().snapshot(),
                new ConversationAgentRequest.UserMessage("100만원 예금", null),
                snapshot);
    }
}
