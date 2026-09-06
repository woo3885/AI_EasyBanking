package com.ddd.backend.service.decision;

import com.ddd.backend.api.dto.session.SubmitDecisionRequest;
import com.ddd.backend.domain.session.DecisionType;
import com.ddd.backend.websocket.dto.AutomationDecisionOption;
import com.ddd.backend.websocket.dto.AutomationDecisionPrompt;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class UserDecisionSessionStateTest {

    private UserDecisionSessionState state;

    @BeforeEach
    void setUp() {
        state = new UserDecisionSessionState();
        state.register("session-001", prompt());
    }

    @Test
    void 현재_Decision과_Frame이_일치하면_한번만_소비한다() {
        AtomicInteger executions = new AtomicInteger();
        SubmitDecisionRequest request = request(
                "req-001", "dec-001", "frm-001", 7L, "option-001");

        state.consume("session-001", request, executions::incrementAndGet);

        assertThat(executions.get()).isEqualTo(1);
        assertThat(state.latestResult("session-001").orElseThrow()
                .selectedOptionIds()).containsExactly("option-001");
        assertThat(state.takeLatestResult("session-001")).isPresent();
        assertThat(state.takeLatestResult("session-001")).isEmpty();
        assertThatThrownBy(() -> state.consume(
                "session-001", request, executions::incrementAndGet))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("이미 처리된 사용자 결정 요청입니다.");
        assertThat(executions.get()).isEqualTo(1);
    }

    @Test
    void 오래된_Frame은_소비하지_않는다() {
        assertThatThrownBy(() -> state.consume(
                "session-001",
                request("req-001", "dec-001", "frm-old", 6L, "option-001"),
                () -> { throw new AssertionError("실행되면 안 됩니다."); }))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("오래된 Viewer Frame의 사용자 결정입니다.");
    }

    @Test
    void 다른_Session과_허용되지_않은_선택을_차단한다() {
        assertThatThrownBy(() -> state.consume(
                "session-002", request("req-001", "dec-001", "frm-001", 7L, "option-001"),
                () -> {}))
                .isInstanceOf(IllegalStateException.class);

        assertThatThrownBy(() -> state.consume(
                "session-001", request("req-001", "dec-001", "frm-001", 7L, "forged"),
                () -> {}))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("허용되지 않은 선택 항목입니다.");
    }

    @Test
    void 후속처리가_실패하면_Decision을_소비하지_않는다() {
        SubmitDecisionRequest request = request(
                "req-001", "dec-001", "frm-001", 7L, "option-001");

        assertThatThrownBy(() -> state.consume(
                "session-001", request,
                () -> { throw new IllegalStateException("save failed"); }))
                .hasMessage("save failed");

        AtomicInteger executions = new AtomicInteger();
        state.consume("session-001", request, executions::incrementAndGet);
        assertThat(executions.get()).isEqualTo(1);
    }

    @Test
    void 필수_약관을_누락하거나_비활성_항목을_선택하면_차단한다() {
        state = new UserDecisionSessionState();
        state.register("session-001", new AutomationDecisionPrompt(
                "req-terms", "dec-terms", DecisionType.TERMS_AGREEMENT,
                List.of(
                        new AutomationDecisionOption("required", "[필수] 서비스", true, false, false),
                        new AutomationDecisionOption("disabled", "[선택] 마케팅", false, false, true)),
                "frm-001", 7L));

        assertThatThrownBy(() -> state.consume("session-001", new SubmitDecisionRequest(
                "req-terms", "dec-terms", DecisionType.TERMS_AGREEMENT,
                List.of(), "frm-001", 7L), () -> {}))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("필수 약관 선택이 누락되었습니다.");

        assertThatThrownBy(() -> state.consume("session-001", new SubmitDecisionRequest(
                "req-terms", "dec-terms", DecisionType.TERMS_AGREEMENT,
                List.of("required", "disabled"), "frm-001", 7L), () -> {}))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("허용되지 않은 선택 항목입니다.");
    }

    private AutomationDecisionPrompt prompt() {
        return new AutomationDecisionPrompt(
                "req-001", "dec-001", DecisionType.PRODUCT_SELECTION,
                List.of(new AutomationDecisionOption("option-001", "정기예금")),
                "frm-001", 7L);
    }

    private SubmitDecisionRequest request(
            String requestId, String decisionId,
            String frameId, long sequence, String optionId
    ) {
        return new SubmitDecisionRequest(
                requestId, decisionId, DecisionType.PRODUCT_SELECTION,
                List.of(optionId), frameId, sequence);
    }
}
