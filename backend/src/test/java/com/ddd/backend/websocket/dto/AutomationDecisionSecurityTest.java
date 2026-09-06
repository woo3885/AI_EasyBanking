package com.ddd.backend.websocket.dto;

import com.ddd.backend.domain.session.DecisionType;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AutomationDecisionSecurityTest {

    @Test
    void 중복_option_ID는_event_생성_시_차단한다() {
        assertThatThrownBy(() -> new AutomationDecisionPrompt(
                "req-1", "dec-1", DecisionType.PRODUCT_SELECTION,
                List.of(
                        new AutomationDecisionOption("same", "하나"),
                        new AutomationDecisionOption("same", "둘")),
                "frm-1", 1L, "snap-1"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("중복");
    }

    @Test
    void option_label의_민감정보_HTML_제어문자를_정제한다() {
        AutomationDecisionOption financial = new AutomationDecisionOption(
                "account", "<b>계좌 123-456-789012</b>\n");
        AutomationDecisionOption secure = new AutomationDecisionOption(
                "otp", "OTP 123456");

        assertThat(financial.label()).doesNotContain("<b>", "123-456-789012", "\n");
        assertThat(secure.label()).isEqualTo("[SENSITIVE]");
    }
}
