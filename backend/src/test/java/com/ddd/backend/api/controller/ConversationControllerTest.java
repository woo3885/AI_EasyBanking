package com.ddd.backend.api.controller;

import com.ddd.backend.config.RestCorsProperties;
import com.ddd.backend.conversation.ConversationService;
import com.ddd.backend.conversation.MessageAcceptance;
import com.ddd.backend.conversation.MessageQueueStatus;
import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.service.AutomationSessionService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ConversationController.class)
@EnableConfigurationProperties(RestCorsProperties.class)
class ConversationControllerTest {

    @Autowired MockMvc mockMvc;
    @MockitoBean ConversationService conversationService;
    @MockitoBean AutomationSessionService sessionService;

    @Test
    void 후속_메시지는_202_ACK로_접수하며_실행성공을_의미하지_않는다() throws Exception {
        AutomationSession session = AutomationSession.create("예금 찾기");
        when(conversationService.acceptFollowUp(
                org.mockito.ArgumentMatchers.eq("session-1"),
                org.mockito.ArgumentMatchers.any()))
                .thenReturn(new MessageAcceptance(
                        "session-1", "req-2", "msg-2", 2,
                        MessageQueueStatus.PENDING, Instant.parse("2026-09-01T00:00:00Z"), false));
        when(sessionService.getSession("session-1")).thenReturn(session);

        mockMvc.perform(post("/api/v1/sessions/session-1/messages")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "requestId":"req-2",
                                  "messageId":"msg-2",
                                  "content":"12개월",
                                  "expectedConversationSequence":1,
                                  "expectedGoalRevision":0
                                }
                                """))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.data.acceptedSequence").value(2))
                .andExpect(jsonPath("$.data.queueStatus").value("PENDING"))
                .andExpect(jsonPath("$.data.duplicate").value(false))
                .andExpect(jsonPath("$.message").value(
                        "메시지가 접수되었습니다. AI 판단이나 실행 성공을 의미하지 않습니다."));
    }
}
