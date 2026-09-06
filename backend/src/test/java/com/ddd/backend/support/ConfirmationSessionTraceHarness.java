package com.ddd.backend.support;

import com.ddd.backend.frame.BrowserFrameMetadata;
import com.ddd.backend.websocket.dto.AutomationUiEvent;
import com.ddd.backend.websocket.dto.AutomationUiEventSnapshot;
import com.ddd.backend.websocket.dto.AutomationUiEventType;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** D28 confirmation event/snapshot/frame identity를 한 흐름으로 검증한다. */
public final class ConfirmationSessionTraceHarness {
    private final String sessionId;
    private final List<AutomationUiEvent> events;
    private final AutomationUiEventSnapshot snapshot;
    private final BrowserFrameMetadata sourceFrame;
    private final BrowserFrameMetadata latestFrame;

    public ConfirmationSessionTraceHarness(
            String sessionId,
            List<AutomationUiEvent> events,
            AutomationUiEventSnapshot snapshot,
            BrowserFrameMetadata sourceFrame,
            BrowserFrameMetadata latestFrame
    ) {
        this.sessionId = sessionId;
        this.events = List.copyOf(events);
        this.snapshot = snapshot;
        this.sourceFrame = sourceFrame;
        this.latestFrame = latestFrame;
    }

    public void assertApprovedTrace(String confirmationId) {
        assertThat(events).isNotEmpty().allSatisfy(event ->
                assertThat(event.sessionId()).isEqualTo(sessionId));
        for (int index = 1; index < events.size(); index++) {
            assertThat(events.get(index).eventSequence())
                    .isGreaterThan(events.get(index - 1).eventSequence());
        }

        AutomationUiEvent required = event(AutomationUiEventType.CONFIRMATION_REQUIRED);
        AutomationUiEvent resolved = event(AutomationUiEventType.CONFIRMATION_RESOLVED);
        AutomationUiEvent clear = event(AutomationUiEventType.CONFIRMATION_CLEAR);
        assertIdentity(required, confirmationId);
        assertIdentity(resolved, confirmationId);
        assertIdentity(clear, confirmationId);

        assertThat(required.confirmation().frameId()).isEqualTo(sourceFrame.frameId());
        assertThat(required.confirmation().frameSequence()).isEqualTo(sourceFrame.sequence());
        assertThat(latestFrame.sequence()).isGreaterThan(sourceFrame.sequence());
        assertThat(latestFrame.frameId()).isNotEqualTo(sourceFrame.frameId());
        assertThat(snapshot.latestEventSequence())
                .isGreaterThanOrEqualTo(clear.eventSequence());
        assertThat(snapshot.confirmation()).isNull();
    }

    private AutomationUiEvent event(AutomationUiEventType type) {
        return events.stream().filter(event -> event.eventType() == type)
                .findFirst().orElseThrow(() -> new AssertionError(type + " event가 없습니다."));
    }

    private void assertIdentity(AutomationUiEvent event, String confirmationId) {
        assertThat(event.confirmation()).isNotNull();
        assertThat(event.confirmation().confirmationId()).isEqualTo(confirmationId);
        assertThat(event.confirmation().sourceSnapshotId()).isEqualTo("snap-d28");
        assertThat(event.confirmation().frameId()).isEqualTo(sourceFrame.frameId());
        assertThat(event.confirmation().frameSequence()).isEqualTo(sourceFrame.sequence());
    }
}
