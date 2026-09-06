package com.ddd.backend.api.controller;

import com.ddd.backend.api.dto.session.SubmitConfirmationRequest;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;
import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.util.List;
import com.ddd.backend.api.dto.session.ConfirmationActionResponse;
import com.ddd.backend.domain.session.ConfirmationType;
import com.ddd.backend.service.confirmation.FinalConfirmationRequest;
import com.ddd.backend.service.confirmation.FinalConfirmationSummary;
import com.ddd.backend.websocket.dto.ConfirmationEventPayload;

import static org.assertj.core.api.Assertions.assertThat;

class FinalConfirmationCanonicalFixtureTest {
    private final ObjectMapper objectMapper = JsonMapper.builder().build();

    @Test
    void approve_reject_fixture는_frame_identity와_requestId를_포함한다()
            throws Exception {
        SubmitConfirmationRequest approve = objectMapper.readValue(
                resource("d27-final-confirmation-approve-request.json"),
                SubmitConfirmationRequest.class);
        SubmitConfirmationRequest reject = objectMapper.readValue(
                resource("d27-final-confirmation-reject-request.json"),
                SubmitConfirmationRequest.class);

        assertThat(approve.requestId()).isNotBlank();
        assertThat(approve.expectedFrameId()).isEqualTo("frm-001");
        assertThat(approve.expectedSequence()).isEqualTo(7L);
        assertThat(approve.approved()).isTrue();
        assertThat(reject.approved()).isFalse();
    }

    @Test
    void event와_snapshot_fixture_set은_canonical_type과_source_frame을_유지한다()
            throws Exception {
        JsonNode required = read("d27-final-confirmation-required-event.json");
        JsonNode snapshot = read("d27-final-confirmation-snapshot.json");
        assertThat(required.path("eventType").asText())
                .isEqualTo("CONFIRMATION_REQUIRED");
        assertThat(required.at("/confirmation/frameId").asText())
                .isEqualTo("frm-001");
        assertThat(required.at("/confirmation/frameSequence").asLong())
                .isEqualTo(7L);
        assertThat(snapshot.at("/confirmation/confirmation/frameId").asText())
                .isEqualTo("frm-001");
        assertThat(required.at("/confirmation/summary/items/0/id").asText())
                .isEqualTo("product-name");
        assertThat(required.at("/confirmation/confirmationTargetElementId").isMissingNode())
                .isTrue();

        for (String fixture : List.of(
                "d27-final-confirmation-resolved-event.json",
                "d27-final-confirmation-rejected-event.json",
                "d27-final-confirmation-clear-event.json")) {
            JsonNode event = read(fixture);
            assertThat(event.path("eventType").asText())
                    .startsWith("CONFIRMATION_");
            assertThat(event.at("/confirmation/confirmationId").asText())
                    .isEqualTo("confirm-001");
        }
    }

    @Test
    void 실제_Jackson_wire는_ordered_summary와_명시적_ACK만_노출한다() {
        var request = new FinalConfirmationRequest(
                "confirm-001", ConfirmationType.DEPOSIT_SUBSCRIPTION,
                "el-internal-final", "snap-001", "frm-001", 7L,
                new FinalConfirmationSummary("정기예금", "12개월", "1,000,000원"));
        JsonNode eventPayload = objectMapper.valueToTree(
                ConfirmationEventPayload.from(request));
        JsonNode response = objectMapper.valueToTree(new ConfirmationActionResponse(
                "session-001", "req-001", "confirm-001", "frm-001", 7L,
                ConfirmationActionResponse.Status.APPROVAL_ACCEPTED,
                "최종 승인 요청을 처리하고 있습니다."));

        assertThat(eventPayload.at("/summary/items/0/id").asText())
                .isEqualTo("product-name");
        assertThat(eventPayload.path("confirmationTargetElementId").isMissingNode())
                .isTrue();
        assertThat(eventPayload.toString()).doesNotContain("el-internal-final");
        assertThat(response.path("sessionId").asText()).isEqualTo("session-001");
        assertThat(response.path("requestId").asText()).isEqualTo("req-001");
        assertThat(response.path("status").asText()).isEqualTo("APPROVAL_ACCEPTED");
        assertThat(response.size()).isEqualTo(7);
    }

    private JsonNode read(String name) throws Exception {
        return objectMapper.readTree(resource(name));
    }

    private InputStream resource(String name) {
        InputStream stream = getClass().getResourceAsStream("/contracts/" + name);
        if (stream == null) {
            throw new IllegalStateException("fixture를 찾을 수 없습니다: " + name);
        }
        return stream;
    }
}
