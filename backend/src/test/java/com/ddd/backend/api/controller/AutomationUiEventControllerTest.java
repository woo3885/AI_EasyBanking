package com.ddd.backend.api.controller;

import com.ddd.backend.common.response.ApiResponse;
import com.ddd.backend.service.AutomationSessionService;
import com.ddd.backend.websocket.dto.AutomationUiEventSnapshot;
import com.ddd.backend.websocket.publisher.AutomationStatusEventPublisher;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AutomationUiEventControllerTest {

    @Test
    void reconnect를_위해_최신_UI_Event_snapshot을_반환한다() {
        AutomationSessionService sessionService = mock(AutomationSessionService.class);
        AutomationStatusEventPublisher publisher =
                mock(AutomationStatusEventPublisher.class);
        AutomationUiEventSnapshot expected = new AutomationUiEventSnapshot(
                "session-001", 7L, null, null, null);
        when(publisher.latestSnapshot("session-001"))
                .thenReturn(Optional.of(expected));

        AutomationUiEventController controller =
                new AutomationUiEventController(sessionService, publisher);

        ApiResponse<AutomationUiEventSnapshot> response =
                controller.latest("session-001");

        assertThat(response.success()).isTrue();
        assertThat(response.data()).isEqualTo(expected);
        verify(sessionService).getSession("session-001");
    }
}
