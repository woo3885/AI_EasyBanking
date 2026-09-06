package com.ddd.backend.api.controller;

import com.ddd.backend.common.exception.GlobalExceptionHandler;
import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.domain.session.DecisionType;
import com.ddd.backend.api.dto.session.SubmitDecisionRequest;
import com.ddd.backend.api.dto.session.SubmitConfirmationRequest;
import com.ddd.backend.api.dto.session.ConfirmationActionResponse;
import com.ddd.backend.service.AutomationSessionService;
import com.ddd.backend.service.UserDecisionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;

class AutomationSessionUserDecisionControllerTest {

    private AutomationSessionService sessionService;
    private UserDecisionService userDecisionService;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        sessionService =
                mock(AutomationSessionService.class);

        userDecisionService =
                mock(UserDecisionService.class);

        AutomationSessionController controller =
                new AutomationSessionController(
                        sessionService,
                        userDecisionService
                );

        mockMvc =
                MockMvcBuilders
                        .standaloneSetup(controller)
                        .setControllerAdvice(
                                new GlobalExceptionHandler()
                        )
                        .build();
    }

    @Test
    void 사용자_결정_API를_호출한다() throws Exception {
        AutomationSession session =
                AutomationSession.create(
                        "예금 상품을 선택해 줘"
                );

        when(
                userDecisionService.submitDecision(
                        org.mockito.ArgumentMatchers.eq("session-001"),
                        org.mockito.ArgumentMatchers.any(
                                SubmitDecisionRequest.class)
                )
        ).thenReturn(
                session
        );

        mockMvc.perform(
                        post(
                                "/api/v1/sessions/"
                                        + "session-001/decisions"
                        )
                                .contentType(
                                        MediaType.APPLICATION_JSON
                                )
                                .content(
                                        """
                                        {
                                          "requestId": "req-001",
                                          "decisionId": "dec-001",
                                          "decisionType":
                                            "PRODUCT_SELECTION",
                                          "selectedOptionIds": [
                                            "product-001"
                                          ],
                                          "expectedFrameId": "frm-001",
                                          "expectedSequence": 1
                                        }
                                        """
                                )
                )
                .andExpect(
                        status().isOk()
                );

        verify(userDecisionService)
                .submitDecision(
                        org.mockito.ArgumentMatchers.eq("session-001"),
                        org.mockito.ArgumentMatchers.argThat(
                                request -> request.decisionId().equals("dec-001")
                                        && request.expectedSequence() == 1L
                                        && request.selectedOptionIds()
                                        .equals(List.of("product-001"))
                        )
                );
    }

    @Test
    void 최종_승인_API를_호출한다() throws Exception {
        when(
                userDecisionService.confirmFinalActionAck(
                        org.mockito.ArgumentMatchers.eq("session-002"),
                        org.mockito.ArgumentMatchers.any(SubmitConfirmationRequest.class))
        ).thenReturn(
                new ConfirmationActionResponse("session-002", "req-confirm-001",
                        "confirm-001", "frm-001", 1L,
                        ConfirmationActionResponse.Status.APPROVAL_ACCEPTED,
                        "최종 승인 요청을 처리하고 있습니다.")
        );

        mockMvc.perform(
                        post(
                                "/api/v1/sessions/"
                                        + "session-002/confirm"
                        )
                                .contentType(
                                        MediaType.APPLICATION_JSON
                                )
                                .content(
                                        """
                                        {
                                          "requestId": "req-confirm-001",
                                          "confirmationId": "confirm-001",
                                          "approved": true,
                                          "expectedFrameId": "frm-001",
                                          "expectedSequence": 1
                                        }
                                        """
                                )
                )
                .andExpect(
                        status().isOk()
                )
                .andExpect(jsonPath("$.data.sessionId").value("session-002"))
                .andExpect(jsonPath("$.data.requestId").value("req-confirm-001"))
                .andExpect(jsonPath("$.data.status").value("APPROVAL_ACCEPTED"));

        verify(userDecisionService)
                .confirmFinalActionAck(
                        org.mockito.ArgumentMatchers.eq("session-002"),
                        org.mockito.ArgumentMatchers.argThat(request ->
                                request.requestId().equals("req-confirm-001")
                                        && request.confirmationId().equals("confirm-001")
                                        && request.expectedFrameId().equals("frm-001")
                                        && request.expectedSequence() == 1L));
    }

    @Test
    void 최종_거절_API를_호출한다() throws Exception {
        when(
                userDecisionService.rejectFinalActionAck(
                        org.mockito.ArgumentMatchers.eq("session-003"),
                        org.mockito.ArgumentMatchers.any(SubmitConfirmationRequest.class))
        ).thenReturn(
                new ConfirmationActionResponse("session-003", "req-reject-001",
                        "confirm-002", "frm-002", 2L,
                        ConfirmationActionResponse.Status.REJECTION_ACCEPTED,
                        "최종 거절 요청을 처리했습니다.")
        );

        mockMvc.perform(
                        post(
                                "/api/v1/sessions/"
                                        + "session-003/reject"
                        )
                                .contentType(
                                        MediaType.APPLICATION_JSON
                                )
                                .content(
                                        """
                                        {
                                          "requestId": "req-reject-001",
                                          "confirmationId": "confirm-002",
                                          "approved": false,
                                          "expectedFrameId": "frm-002",
                                          "expectedSequence": 2
                                        }
                                        """
                                )
                )
                .andExpect(
                        status().isOk()
                )
                .andExpect(jsonPath("$.data.sessionId").value("session-003"))
                .andExpect(jsonPath("$.data.requestId").value("req-reject-001"))
                .andExpect(jsonPath("$.data.status").value("REJECTION_ACCEPTED"));

        verify(userDecisionService)
                .rejectFinalActionAck(
                        org.mockito.ArgumentMatchers.eq("session-003"),
                        org.mockito.ArgumentMatchers.argThat(request ->
                                request.requestId().equals("req-reject-001")
                                        && request.confirmationId().equals("confirm-002")
                                        && request.expectedSequence() == 2L));
    }

    @Test
    void 선택_항목이_없으면_400을_반환한다()
            throws Exception {

        mockMvc.perform(
                        post(
                                "/api/v1/sessions/"
                                        + "session-004/decisions"
                        )
                                .contentType(
                                        MediaType.APPLICATION_JSON
                                )
                                .content(
                                        """
                                        {
                                          "decisionType":
                                            "PRODUCT_SELECTION",
                                          "selectedOptionIds": []
                                        }
                                        """
                                )
                )
                .andExpect(
                        status().isBadRequest()
                );

        verifyNoInteractions(
                userDecisionService
        );
    }

    @Test
    void 승인_여부가_없으면_400을_반환한다()
            throws Exception {

        mockMvc.perform(
                        post(
                                "/api/v1/sessions/"
                                        + "session-005/confirm"
                        )
                                .contentType(
                                        MediaType.APPLICATION_JSON
                                )
                                .content(
                                        """
                                        {
                                          "confirmationId": "confirm-003"
                                        }
                                        """
                                )
                )
                .andExpect(
                        status().isBadRequest()
                );

        verifyNoInteractions(
                userDecisionService
        );
    }

    @Test
    void 확인_ID가_공백이면_400을_반환한다()
            throws Exception {

        mockMvc.perform(
                        post(
                                "/api/v1/sessions/"
                                        + "session-006/reject"
                        )
                                .contentType(
                                        MediaType.APPLICATION_JSON
                                )
                                .content(
                                        """
                                        {
                                          "confirmationId": "   ",
                                          "approved": false
                                        }
                                        """
                                )
                )
                .andExpect(
                        status().isBadRequest()
                );

        verifyNoInteractions(
                userDecisionService
        );
    }
}
