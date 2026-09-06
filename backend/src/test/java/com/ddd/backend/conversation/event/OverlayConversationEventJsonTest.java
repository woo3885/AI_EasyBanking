package com.ddd.backend.conversation.event;

import com.ddd.backend.conversation.overlay.*;
import com.ddd.backend.domain.session.WorkflowStatus;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class OverlayConversationEventJsonTest {
    private final tools.jackson.databind.ObjectMapper mapper = JsonMapper.builder().findAndAddModules().build();
    private final Instant at = Instant.parse("2026-09-06T12:00:00Z");

    @Test
    void overlay_target_clear_user_action_event의_wire_contract를_고정한다() throws Exception {
        PublicOverlayTarget target = target();
        String overlay = mapper.writeValueAsString(new OverlayTargetEvent("event-1", 10, "OVERLAY_TARGET",
                "session-1", WorkflowStatus.USER_DECISION_REQUIRED, target.targetId(), target.pageIdentity(),
                target.sourceSnapshotId(), target.coordinateSpace(), target.rectangle(), target.viewport(),
                target.role(), target.label(), target.guide(), target.actionMode(), target.expiresAt(), at));
        String clear = mapper.writeValueAsString(new OverlayClearEvent("event-2", 11, "OVERLAY_CLEAR",
                "session-1", "target-1", "page-1", "snap-1", OverlayClearReason.USER_ACTION, at));
        String observed = mapper.writeValueAsString(new UserActionObservedEvent("event-3", 12,
                "USER_ACTION_OBSERVED", "session-1", WorkflowStatus.AI_EXECUTING,
                "observation-1", "request-1", "target-1", "page-1", "snap-1",
                "snap-2", "DOM_CHANGE_CONFIRMED", at));

        assertThat(overlay).contains("\"coordinateSpace\":\"VIEWPORT_CSS_PX\"",
                "\"workflowStatus\":\"USER_DECISION_REQUIRED\"", "\"actionMode\":\"GUIDE_USER_CLICK\"");
        assertThat(clear).contains("\"eventType\":\"OVERLAY_CLEAR\"", "\"reason\":\"USER_ACTION\"");
        assertThat(observed).contains("\"status\":\"DOM_CHANGE_CONFIRMED\"", "\"resultingSnapshotId\":\"snap-2\"");
        assertThat(overlay + clear + observed).doesNotContain("selector", "elementId", "locator", "http://");
    }

    private PublicOverlayTarget target() {
        return new PublicOverlayTarget("target-1", "session-1", "page-1", "snap-1",
                OverlayCoordinateSpace.VIEWPORT_CSS_PX,
                new PublicOverlayTarget.Rectangle(120, 240, 180, 56),
                new PublicOverlayTarget.Viewport(1280, 720), "button", "12개월 상품 선택",
                "이 버튼을 직접 눌러 주세요.", OverlayActionMode.GUIDE_USER_CLICK,
                at, at.plusSeconds(60), null);
    }
}
