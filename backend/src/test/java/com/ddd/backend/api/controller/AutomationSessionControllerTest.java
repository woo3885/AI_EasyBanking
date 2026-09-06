package com.ddd.backend.api.controller;

import com.ddd.backend.common.exception.SessionNotFoundException;
import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.service.AutomationSessionService;
import com.ddd.backend.service.UserDecisionService;
import com.ddd.backend.security.secureinput.SecureInputService;
import com.ddd.backend.security.secureinput.SecureInputTransportPolicy;
import com.ddd.backend.conversation.ConversationService;
import com.ddd.backend.conversation.MessageAcceptance;
import com.ddd.backend.conversation.MessageQueueStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import com.ddd.backend.config.RestCorsProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@WebMvcTest(
        AutomationSessionController.class
)
@EnableConfigurationProperties(
        RestCorsProperties.class
)
class AutomationSessionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AutomationSessionService sessionService;

    /*
     * Controller 생성자 의존성 때문에
     * MVC 테스트 Context에 Mock으로 등록한다.
     */
    @MockitoBean
    private UserDecisionService userDecisionService;

    @MockitoBean
    private SecureInputService secureInputService;

    @MockitoBean
    private SecureInputTransportPolicy secureInputTransportPolicy;

    @MockitoBean
    private ConversationService conversationService;

    @Test
    void 보안입력완료는_raw_value없는_전용_endpoint로_접수한다()
            throws Exception {
        when(secureInputService.submit(
                org.mockito.ArgumentMatchers.eq("session-001"),
                org.mockito.ArgumentMatchers.eq("sec-001"),
                org.mockito.ArgumentMatchers.any()))
                .thenReturn(new com.ddd.backend.api.dto.session.SecureInputSubmissionResponse(
                        "session-001", "req-001", "sec-001",
                        "COMPLETION_ACCEPTED", "확인하고 있습니다."));

        mockMvc.perform(post(
                        "/api/v1/sessions/{sessionId}/secure-inputs/{secureRequestId}/complete",
                        "session-001", "sec-001")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "requestId":"req-001",
                                  "expectedFrameId":"frm-001",
                                  "expectedSequence":1
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.sessionId").value("session-001"))
                .andExpect(jsonPath("$.data.requestId").value("req-001"))
                .andExpect(jsonPath("$.data.secureRequestId").value("sec-001"))
                .andExpect(jsonPath("$.data.status").value("COMPLETION_ACCEPTED"))
                .andExpect(jsonPath("$..value").doesNotExist());
    }

    @Test
    void 보안입력완료_DTO는_raw_value와_unknown_field를_거부한다() throws Exception {
        mockMvc.perform(post(
                        "/api/v1/sessions/{sessionId}/secure-inputs/{secureRequestId}/complete",
                        "session-001", "sec-001")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "requestId":"req-001",
                                  "value":"must-not-be-accepted",
                                  "expectedFrameId":"frm-001",
                                  "expectedSequence":1
                                }
                                """))
                .andExpect(status().isBadRequest());

        verify(secureInputService, never()).submit(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any());
    }

    @Test
    void stale_secure_frame은_전용_HTTP와_application_error_code를_반환한다()
            throws Exception {
        when(secureInputService.submit(
                org.mockito.ArgumentMatchers.eq("session-001"),
                org.mockito.ArgumentMatchers.eq("sec-001"),
                org.mockito.ArgumentMatchers.any()))
                .thenThrow(new com.ddd.backend.security.secureinput.SecureInputException(
                        com.ddd.backend.common.exception.ErrorCode.SECURE_STALE_FRAME));

        mockMvc.perform(post(
                        "/api/v1/sessions/{sessionId}/secure-inputs/{secureRequestId}/complete",
                        "session-001", "sec-001")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "requestId":"req-001",
                                  "expectedFrameId":"frm-old",
                                  "expectedSequence":1
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errorCode").value("SECURE_409_STALE_FRAME"))
                .andExpect(content().string(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString("frm-old"))));
    }

    @Test
    void 자동화_세션을_생성한다()
            throws Exception {

        AutomationSession session =
                AutomationSession.create(
                        "계좌 선택 화면을 확인합니다."
                );

        when(
                sessionService.createSession(
                        "계좌 선택 화면을 확인합니다.",
                        "demo-bank",
                        "/transfer/accounts"
                )
        ).thenReturn(
                session
        );

        mockMvc.perform(
                        post(
                                "/api/v1/sessions"
                        )
                                .contentType(
                                        MediaType.APPLICATION_JSON
                                )
                                .content(
                                        """
                                        {
                                          "userRequest": "계좌 선택 화면을 확인합니다.",
                                          "siteId": "demo-bank",
                                          "initialPath": "/transfer/accounts"
                                        }
                                        """
                                )
                )
                .andExpect(
                        status().isCreated()
                )
                .andExpect(
                        jsonPath(
                                "$.success"
                        ).value(
                                true
                        )
                )
                .andExpect(
                        jsonPath(
                                "$.data.sessionId"
                        ).isNotEmpty()
                )
                .andExpect(
                        jsonPath(
                                "$.data.userRequest"
                        ).value(
                                "계좌 선택 화면을 확인합니다."
                        )
                )
                .andExpect(
                        jsonPath(
                                "$.data.status"
                        ).value(
                                "SESSION_CREATED"
                        )
                )
                .andExpect(
                        jsonPath(
                                "$.message"
                        ).value(
                                "자동화 세션이 생성되었습니다."
                        )
                );

        verify(
                sessionService
        ).createSession(
                "계좌 선택 화면을 확인합니다.",
                "demo-bank",
                "/transfer/accounts"
        );
        verify(sessionService).startInitialAi(session.getSessionId());
    }

    @Test
    void 새_메시지_계약으로_세션을_생성하면_202_ACK를_반환한다() throws Exception {
        AutomationSession session = AutomationSession.create("100만원 예금");
        when(conversationService.validateContent("100만원 예금"))
                .thenReturn("100만원 예금");
        when(sessionService.createConversationSession(
                "100만원 예금", "demo-bank", "/deposits"))
                .thenReturn(session);
        when(conversationService.acceptInitial(
                org.mockito.ArgumentMatchers.eq(session.getSessionId()),
                org.mockito.ArgumentMatchers.eq("req-1"),
                org.mockito.ArgumentMatchers.eq("msg-1"),
                org.mockito.ArgumentMatchers.eq("100만원 예금"),
                org.mockito.ArgumentMatchers.any()))
                .thenReturn(new MessageAcceptance(
                        session.getSessionId(), "req-1", "msg-1", 1,
                        MessageQueueStatus.ACTIVE,
                        java.time.Instant.parse("2026-09-01T00:00:00Z"), false));

        mockMvc.perform(post("/api/v1/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "requestId":"req-1",
                                  "messageId":"msg-1",
                                  "content":"100만원 예금",
                                  "siteId":"demo-bank",
                                  "initialPath":"/deposits",
                                  "clientOccurredAt":"2026-09-01T09:00:00+09:00"
                                }
                                """))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.data.acceptedSequence").value(1))
                .andExpect(jsonPath("$.data.queueStatus").value("ACTIVE"))
                .andExpect(jsonPath("$.message").value(
                        "메시지가 접수되었습니다. AI 판단이나 실행 성공을 의미하지 않습니다."));

        verify(sessionService, never()).startInitialAi(session.getSessionId());
        verify(sessionService).createConversationSession(
                "100만원 예금", "demo-bank", "/deposits");
    }

    @Test
    void 자동화_세션을_조회한다()
            throws Exception {

        AutomationSession session =
                AutomationSession.create(
                        "예금 상품을 찾아 줘"
                );

        when(
                sessionService.getSession(
                        session.getSessionId()
                )
        ).thenReturn(
                session
        );

        mockMvc.perform(
                        get(
                                "/api/v1/sessions/{sessionId}",
                                session.getSessionId()
                        )
                )
                .andExpect(
                        status().isOk()
                )
                .andExpect(
                        jsonPath(
                                "$.success"
                        ).value(
                                true
                        )
                )
                .andExpect(
                        jsonPath(
                                "$.data.sessionId"
                        ).value(
                                session.getSessionId()
                        )
                )
                .andExpect(
                        jsonPath(
                                "$.data.userRequest"
                        ).value(
                                "예금 상품을 찾아 줘"
                        )
                )
                .andExpect(
                        jsonPath(
                                "$.data.status"
                        ).value(
                                "SESSION_CREATED"
                        )
                );
    }

    @Test
    void 자동화_세션을_취소한다()
            throws Exception {

        AutomationSession session =
                AutomationSession.create(
                        "송금 절차를 안내해 줘"
                );

        session.cancel();

        when(
                sessionService.cancelSession(
                        session.getSessionId()
                )
        ).thenReturn(
                session
        );

        mockMvc.perform(
                        post(
                                "/api/v1/sessions/{sessionId}/cancel",
                                session.getSessionId()
                        )
                )
                .andExpect(
                        status().isOk()
                )
                .andExpect(
                        jsonPath(
                                "$.success"
                        ).value(
                                true
                        )
                )
                .andExpect(
                        jsonPath(
                                "$.data.sessionId"
                        ).value(
                                session.getSessionId()
                        )
                )
                .andExpect(
                        jsonPath(
                                "$.data.status"
                        ).value(
                                "CANCELLED"
                        )
                )
                .andExpect(
                        jsonPath(
                                "$.message"
                        ).value(
                                "자동화 세션이 취소되었습니다."
                        )
                );
    }

    @Test
    void 존재하지_않는_세션을_조회하면_404를_반환한다()
            throws Exception {

        when(
                sessionService.getSession(
                        "not-found-session"
                )
        ).thenThrow(
                new SessionNotFoundException(
                        "not-found-session"
                )
        );

        mockMvc.perform(
                        get(
                                "/api/v1/sessions/not-found-session"
                        )
                )
                .andExpect(
                        status().isNotFound()
                )
                .andExpect(
                        jsonPath(
                                "$.success"
                        ).value(
                                false
                        )
                )
                .andExpect(
                        jsonPath(
                                "$.data"
                        ).doesNotExist()
                )
                .andExpect(
                        jsonPath(
                                "$.message"
                        ).value(
                                "자동화 세션을 찾을 수 없습니다."
                        )
                );
    }

    @Test
    void 사용자_요청이_비어_있으면_400을_반환한다()
            throws Exception {

        mockMvc.perform(
                        post(
                                "/api/v1/sessions"
                        )
                                .contentType(
                                        MediaType.APPLICATION_JSON
                                )
                                .content(
                                        """
                                        {
                                          "userRequest": "",
                                          "siteId": "demo-bank",
                                          "initialPath": "/transfer/accounts"
                                        }
                                        """
                                )
                )
                .andExpect(
                        status().isBadRequest()
                )
                .andExpect(
                        jsonPath(
                                "$.success"
                        ).value(
                                false
                        )
                )
                .andExpect(
                        jsonPath(
                                "$.data"
                        ).doesNotExist()
                )
                .andExpect(
                        jsonPath(
                                "$.message"
                        ).value(
                                "사용자 요청은 비어 있을 수 없습니다."
                        )
                );

        verify(
                sessionService,
                never()
        ).createSession(
                "",
                "demo-bank",
                "/transfer/accounts"
        );
    }

    @Test
    void siteId가_비어_있으면_400을_반환한다()
            throws Exception {

        mockMvc.perform(
                        post(
                                "/api/v1/sessions"
                        )
                                .contentType(
                                        MediaType.APPLICATION_JSON
                                )
                                .content(
                                        """
                                        {
                                          "userRequest": "계좌 선택",
                                          "siteId": "",
                                          "initialPath": "/transfer/accounts"
                                        }
                                        """
                                )
                )
                .andExpect(
                        status().isBadRequest()
                )
                .andExpect(
                        jsonPath(
                                "$.message"
                        ).value(
                                "siteId는 비어 있을 수 없습니다."
                        )
                );
    }

    @Test
    void initialPath가_비어_있으면_400을_반환한다()
            throws Exception {

        mockMvc.perform(
                        post(
                                "/api/v1/sessions"
                        )
                                .contentType(
                                        MediaType.APPLICATION_JSON
                                )
                                .content(
                                        """
                                        {
                                          "userRequest": "계좌 선택",
                                          "siteId": "demo-bank",
                                          "initialPath": ""
                                        }
                                        """
                                )
                )
                .andExpect(
                        status().isBadRequest()
                )
                .andExpect(
                        jsonPath(
                                "$.message"
                        ).value(
                                "initialPath는 비어 있을 수 없습니다."
                        )
                );
    }
}
