package com.ddd.backend.conversation.agent;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import com.ddd.backend.conversation.*;
import com.ddd.backend.conversation.event.ConversationEventPublisher;
import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.infrastructure.session.InMemoryAutomationSessionRepository;
import java.time.Instant;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;

class ConversationAgentAsyncProcessorTest {
    @Test
    void ackSchedulingDoesNotWaitForSlowAgentAndDuplicateIsNotCalledTwice() throws Exception {
        var coordinator = mock(ConversationAgentCoordinator.class);
        var events = mock(ConversationEventPublisher.class);
        var mailbox = mock(SessionMessageMailbox.class);
        when(mailbox.isActive(anyString(), anyString())).thenReturn(true);
        var sessions = new InMemoryAutomationSessionRepository();
        AutomationSession session = sessions.save(AutomationSession.create("예금 가입"));
        CountDownLatch finished = new CountDownLatch(1);
        doAnswer(invocation -> {
            Thread.sleep(300);
            finished.countDown();
            return null;
        }).when(coordinator).process(anyString(), any(), anyString(), isNull());
        var processor = new ConversationAgentAsyncProcessor(coordinator, events, sessions, mailbox);
        var accepted = new MessageAcceptance(session.getSessionId(), "request-1", "message-1",
                1, MessageQueueStatus.ACTIVE, Instant.now(), false);

        long started = System.nanoTime();
        processor.submit(session.getSessionId(), accepted, "예금 가입", null);
        long elapsedMillis = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started);
        processor.submit(session.getSessionId(), accepted, "예금 가입", null);

        assertThat(elapsedMillis).isLessThan(100);
        assertThat(finished.await(2, TimeUnit.SECONDS)).isTrue();
        verify(coordinator, times(1)).process(session.getSessionId(), accepted, "예금 가입", null);
        verify(events, times(1)).accepted(eq(session.getSessionId()), eq("message-1"), eq(1L),
                any(), any());
        processor.close();
    }
}
