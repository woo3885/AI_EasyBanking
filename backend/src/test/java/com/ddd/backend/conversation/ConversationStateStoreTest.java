package com.ddd.backend.conversation;

import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

class ConversationStateStoreTest {

    @Test
    void session별로_격리하고_같은_session_TTL을_적용한다() throws Exception {
        ConversationStateStore store = new ConversationStateStore(Duration.ofMillis(20));

        ConversationState first = store.getOrCreate("session-1");
        ConversationState second = store.getOrCreate("session-2");

        assertThat(first).isNotSameAs(second);
        assertThat(first.snapshot().sessionId()).isEqualTo("session-1");

        Thread.sleep(30);

        assertThat(store.find("session-1")).isEmpty();
        assertThat(store.find("session-2")).isEmpty();
    }
}
