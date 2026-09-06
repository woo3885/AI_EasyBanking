package com.ddd.backend.conversation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import org.junit.jupiter.api.Test;

class ConversationMessagePolicyDay2Test {
    private final ConversationMessagePolicy policy = new ConversationMessagePolicy();

    @Test
    void acceptsBoundariesAndCommonFinanceInputs() {
        assertThat(policy.sanitize("1000000원")).isEqualTo("1000000원");
        assertThat(policy.sanitize("100만 원")).isEqualTo("100만 원");
        assertThat(policy.sanitize("12개월")).isEqualTo("12개월");
        assertThat(policy.sanitize("😀".repeat(500))).hasSize(1000);
        assertThat(policy.sanitize("1\r\n2\r\n3\n4\n5")).isNotBlank();
    }

    @Test
    void rejectsMoreThan500CodePointsOr5LinesAndUnsafeContent() {
        assertRejected("😀".repeat(501), ConversationError.INVALID_CONTENT);
        assertRejected("1\n2\n3\n4\n5\n6", ConversationError.INVALID_CONTENT);
        assertRejected("OTP 123456", ConversationError.SENSITIVE_CONTENT);
        assertRejected("PIN=1234", ConversationError.SENSITIVE_CONTENT);
        assertRejected("인증번호: 123456", ConversationError.SENSITIVE_CONTENT);
        assertRejected("abc\u0000def", ConversationError.INVALID_CONTENT);
    }

    private void assertRejected(String input, ConversationError expected) {
        assertThatThrownBy(() -> policy.sanitize(input))
                .isInstanceOf(ConversationException.class)
                .extracting(error -> ((ConversationException) error).error())
                .isEqualTo(expected);
    }
}
