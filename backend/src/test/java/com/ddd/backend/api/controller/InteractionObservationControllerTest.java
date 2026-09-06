package com.ddd.backend.api.controller;

import com.ddd.backend.api.dto.conversation.InteractionObservationAcceptedResponse;
import com.ddd.backend.config.RestCorsProperties;
import com.ddd.backend.conversation.overlay.InteractionObservationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(InteractionObservationController.class)
@EnableConfigurationProperties(RestCorsProperties.class)
class InteractionObservationControllerTest {
    @Autowired MockMvc mockMvc;
    @MockitoBean InteractionObservationService observations;

    @Test
    void observation은_성공을_의미하지_않는_202_ACK를_반환한다() throws Exception {
        when(observations.observe(eq("session-1"), eq("secret"), eq("binding-1"), eq("page-1"),
                eq("http://127.0.0.1:5190"), any())).thenReturn(
                new InteractionObservationAcceptedResponse("session-1", "request-1", "target-1",
                        "page-1", "snap-1", "OBSERVATION_ACCEPTED",
                        Instant.parse("2026-09-06T12:00:00Z")));

        mockMvc.perform(post("/api/v1/sessions/session-1/interaction-observations")
                        .header("Origin", "http://127.0.0.1:5190")
                        .header(ConversationBridgeController.BRIDGE_TOKEN_HEADER, "secret")
                        .header(ConversationBridgeController.BROWSER_BINDING_ID_HEADER, "binding-1")
                        .header(ConversationBridgeController.PAGE_IDENTITY_HEADER, "page-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"requestId":"request-1","targetId":"target-1",
                                 "sourceSnapshotId":"snap-1","observationType":"USER_CLICK",
                                 "clientOccurredAt":"2026-09-06T20:59:00+09:00"}
                                """))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.data.status").value("OBSERVATION_ACCEPTED"))
                .andExpect(jsonPath("$.data.targetId").value("target-1"))
                .andExpect(jsonPath("$.message").value(
                        "관찰 요청이 접수되었습니다. 클릭 성공이나 업무 성공을 의미하지 않습니다."));
    }
}
