package com.ddd.backend.service.action;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.concurrent.locks.ReentrantLock;

import static org.assertj.core.api.Assertions.assertThat;

class PublicBrowserActionSessionStateTest {

    private BrowserActionRequestRegistry
            requestRegistry;

    private PublicBrowserActionSessionState
            state;

    @BeforeEach
    void setUp() {
        requestRegistry =
                new BrowserActionRequestRegistry();

        state =
                new PublicBrowserActionSessionState(
                        requestRegistry
                );
    }

    @Test
    void Session_cleanup시_requestId를_삭제한다() {
        String sessionId =
                "session-cleanup";

        state.reserveRequest(
                sessionId,
                "request-001"
        );

        assertThat(
                state.containsRequest(
                        sessionId,
                        "request-001"
                )
        ).isTrue();

        state.removeSession(
                sessionId
        );

        assertThat(
                state.containsRequest(
                        sessionId,
                        "request-001"
                )
        ).isFalse();
    }

    @Test
    void Session_cleanup시_lock도_교체된다() {
        String sessionId =
                "session-cleanup";

        ReentrantLock first =
                state.lockFor(
                        sessionId
                );

        state.removeSession(
                sessionId
        );

        ReentrantLock second =
                state.lockFor(
                        sessionId
                );

        assertThat(
                second
        ).isNotSameAs(
                first
        );
    }

    @Test
    void 존재하지않는_Session_cleanup도_안전하다() {
        state.removeSession(
                "not-created-session"
        );

        assertThat(
                state.lockFor(
                        "not-created-session"
                )
        ).isNotNull();
    }
}