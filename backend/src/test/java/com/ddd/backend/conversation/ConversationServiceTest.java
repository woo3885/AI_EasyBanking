package com.ddd.backend.conversation;

import com.ddd.backend.api.dto.conversation.SubmitSessionMessageRequest;
import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.infrastructure.session.InMemoryAutomationSessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ConversationServiceTest {

    private ConversationService service;
    private String sessionId;

    @BeforeEach
    void setUp() {
        var sessions = new InMemoryAutomationSessionRepository();
        AutomationSession session = sessions.save(AutomationSession.create("예금 찾기"));
        sessionId = session.getSessionId();
        service = new ConversationService(
                sessions,
                new ConversationStateStore(Duration.ofMinutes(30)),
                new SessionMessageMailbox(),
                new ConversationMessagePolicy());
    }

    @Test
    void 최초_메시지는_active로_접수하고_ACK는_실행완료를_나타내지_않는다() {
        MessageAcceptance accepted = service.acceptInitial(
                sessionId, "req-1", "msg-1", "100만원 예금", null);

        assertThat(accepted.acceptedSequence()).isEqualTo(1);
        assertThat(accepted.queueStatus()).isEqualTo(MessageQueueStatus.ACTIVE);
        assertThat(accepted.duplicate()).isFalse();
        assertThat(service.snapshot(sessionId).recentSafeMessages())
                .extracting(ConversationMessage::content)
                .containsExactly("100만원 예금");
        assertThat(service.snapshot(sessionId).goal().goalId()).isNotBlank();
        assertThat(service.snapshot(sessionId).goal().revision()).isZero();
    }

    @Test
    void 같은_request와_message_재전송은_기존_sequence로_duplicate_ACK한다() {
        MessageAcceptance first = service.acceptInitial(
                sessionId, "req-1", "msg-1", "100만원 예금", null);
        MessageAcceptance duplicate = service.acceptInitial(
                sessionId, "req-1", "msg-1", "100만원 예금", null);

        assertThat(duplicate.acceptedSequence()).isEqualTo(first.acceptedSequence());
        assertThat(duplicate.queueStatus()).isEqualTo(MessageQueueStatus.DUPLICATE);
        assertThat(duplicate.duplicate()).isTrue();
        assertThat(service.snapshot(sessionId).recentSafeMessages()).hasSize(1);
    }

    @Test
    void 세션별_active_하나_pending_하나만_허용한다() {
        service.acceptInitial(sessionId, "req-1", "msg-1", "100만원 예금", null);

        MessageAcceptance pending = service.acceptFollowUp(sessionId,
                request("req-2", "msg-2", "12개월", 1));

        assertThat(pending.queueStatus()).isEqualTo(MessageQueueStatus.PENDING);
        assertThatThrownBy(() -> service.acceptFollowUp(sessionId,
                request("req-3", "msg-3", "추가 답변", 2)))
                .isInstanceOf(ConversationException.class)
                .extracting(error -> ((ConversationException) error).error())
                .isEqualTo(ConversationError.BUSY);
        assertThat(service.snapshot(sessionId).recentSafeMessages()).hasSize(2);
    }

    @Test
    void stale_sequence와_credential은_fail_closed한다() {
        service.acceptInitial(sessionId, "req-1", "msg-1", "100만원 예금", null);

        assertThatThrownBy(() -> service.acceptFollowUp(sessionId,
                request("req-2", "msg-2", "12개월", 0)))
                .isInstanceOf(ConversationException.class)
                .extracting(error -> ((ConversationException) error).error())
                .isEqualTo(ConversationError.STALE_SEQUENCE);

        assertThatThrownBy(() -> service.acceptFollowUp(sessionId,
                request("req-3", "msg-3", "OTP 123456", 1)))
                .isInstanceOf(ConversationException.class)
                .extracting(error -> ((ConversationException) error).error())
                .isEqualTo(ConversationError.SENSITIVE_CONTENT);
    }

    private SubmitSessionMessageRequest request(
            String requestId,
            String messageId,
            String content,
            long expectedSequence
    ) {
        return new SubmitSessionMessageRequest(
                requestId, messageId, content, null,
                Long.valueOf(expectedSequence), 0L, null);
    }
}
