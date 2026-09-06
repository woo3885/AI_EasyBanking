package com.ddd.backend.conversation.overlay;

import com.ddd.backend.automation.dom.SanitizedDomSnapshot;
import com.ddd.backend.conversation.ConversationMessagePolicy;
import com.ddd.backend.conversation.ConversationService;
import com.ddd.backend.conversation.ConversationState;
import com.ddd.backend.conversation.agent.*;
import com.ddd.backend.domain.session.WorkflowStatus;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ConversationObservationResumeAdapterTest {
    @Test
    void 같은_observation_request는_AI판단을_한번만_재개한다() {
        ConversationService conversations = mock(ConversationService.class);
        ConversationState state = new ConversationState("session-1", Instant.now().plusSeconds(60));
        when(conversations.state("session-1")).thenReturn(state);
        ConversationAgentClient client = mock(ConversationAgentClient.class);
        when(client.decide(any())).thenAnswer(invocation -> {
            ConversationAgentRequest request = invocation.getArgument(0);
            return new ConversationAgentDecision(request.requestId(), request.requestMessageId(),
                    request.goal().goalId(), request.goal().revision(), ConversationInteractionMode.COMPLETE,
                    "화면 변경을 확인했습니다.", 1.0, "VERIFIED_COMPLETION", null,
                    request.snapshot().sourceSnapshotId(), null, null, null);
        });
        ConversationAgentCoordinator coordinator = mock(ConversationAgentCoordinator.class);
        var adapter = new ConversationObservationResumeAdapter(conversations, client,
                new ConversationAgentContractValidator(new ConversationMessagePolicy()), coordinator);
        SanitizedDomSnapshot snapshot = new SanitizedDomSnapshot("1.0", "snap-2",
                new SanitizedDomSnapshot.PageSnapshot("https://redacted.invalid", "예금"), List.of());
        PublicOverlayTarget target = new PublicOverlayTarget("target-1", "session-1", "page-1", "snap-1",
                OverlayCoordinateSpace.VIEWPORT_CSS_PX,
                new PublicOverlayTarget.Rectangle(1, 1, 10, 10),
                new PublicOverlayTarget.Viewport(100, 100), "button", "선택", "직접 눌러 주세요.",
                OverlayActionMode.GUIDE_USER_CLICK, Instant.now(), Instant.now().plusSeconds(60), Instant.now());

        adapter.resumeOnce("session-1", "request-1", target, snapshot);

        verify(client, times(1)).decide(any());
        verify(coordinator, times(1)).applyObservedDomDecision(
                eq("session-1"), argThat(decision -> decision.mode() == ConversationInteractionMode.COMPLETE),
                eq(snapshot));
        assertThatThrownBy(() -> adapter.resumeOnce("session-1", "request-1", target, snapshot))
                .isInstanceOf(OverlayTargetException.class);
        verify(client, times(1)).decide(any());
    }
}
