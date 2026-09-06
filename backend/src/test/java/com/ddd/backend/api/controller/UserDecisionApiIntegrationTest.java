package com.ddd.backend.api.controller;

import com.ddd.backend.automation.session.BrowserSessionManager;
import com.ddd.backend.common.exception.GlobalExceptionHandler;
import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.domain.session.WorkflowStatus;
import com.ddd.backend.infrastructure.session.InMemoryAutomationSessionRepository;
import com.ddd.backend.service.AutomationSessionService;
import com.ddd.backend.service.UserDecisionService;
import com.ddd.backend.service.validation.UserDecisionValidator;
import com.ddd.backend.websocket.publisher.AutomationStatusEventPublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class UserDecisionApiIntegrationTest {

    private InMemoryAutomationSessionRepository sessionRepository;
    private BrowserSessionManager browserSessionManager;
    private AutomationStatusEventPublisher statusEventPublisher;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        sessionRepository =
                new InMemoryAutomationSessionRepository();

        browserSessionManager =
                mock(BrowserSessionManager.class);

        statusEventPublisher =
                mock(AutomationStatusEventPublisher.class);

        UserDecisionService userDecisionService =
                new UserDecisionService(
                        sessionRepository,
                        new UserDecisionValidator(),
                        browserSessionManager,
                        statusEventPublisher
                );

        AutomationSessionService sessionService =
                mock(AutomationSessionService.class);

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
    void 사용자_선택_API가_실제_세션_상태를_변경한다()
            throws Exception {

        AutomationSession session =
                createSession(
                        WorkflowStatus.USER_DECISION_REQUIRED
                );

        mockMvc.perform(
                        post(
                                "/api/v1/sessions/"
                                        + session.getSessionId()
                                        + "/decisions"
                        )
                                .contentType(
                                        MediaType.APPLICATION_JSON
                                )
                                .content(
                                        """
                                        {
                                          "requestId": "req-001",
                                          "decisionId": "dec-001",
                                          "decisionType": "PRODUCT_SELECTION",
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
                )
                .andExpect(
                        jsonPath("$.errorCode")
                                .doesNotExist()
                );

        assertSessionStatus(
                session.getSessionId(),
                WorkflowStatus.AI_EXECUTING
        );

        verify(statusEventPublisher)
                .publish(
                        session.getSessionId(),
                        WorkflowStatus.AI_EXECUTING,
                        "사용자 선택이 제출되었습니다."
                );
    }

    @Test
    void 잘못된_세션_상태에서_선택하면_409를_반환한다()
            throws Exception {

        AutomationSession session =
                createSession(
                        WorkflowStatus.SESSION_CREATED
                );

        mockMvc.perform(
                        post(
                                "/api/v1/sessions/"
                                        + session.getSessionId()
                                        + "/decisions"
                        )
                                .contentType(
                                        MediaType.APPLICATION_JSON
                                )
                                .content(
                                        """
                                        {
                                          "requestId": "req-002",
                                          "decisionId": "dec-002",
                                          "decisionType": "PRODUCT_SELECTION",
                                          "selectedOptionIds": [
                                            "product-001"
                                          ],
                                          "expectedFrameId": "frm-002",
                                          "expectedSequence": 2
                                        }
                                        """
                                )
                )
                .andExpect(
                        status().isConflict()
                )
                .andExpect(
                        jsonPath("$.errorCode")
                                .value("SESSION_409")
                );

        assertSessionStatus(
                session.getSessionId(),
                WorkflowStatus.SESSION_CREATED
        );
    }

    @Test
    void 최종_승인_API가_세션을_AI_실행_상태로_변경한다()
            throws Exception {

        AutomationSession session =
                createSession(
                        WorkflowStatus.FINAL_CONFIRMATION_REQUIRED
                );

        mockMvc.perform(
                        post(
                                "/api/v1/sessions/"
                                        + session.getSessionId()
                                        + "/confirm"
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
                );

        assertSessionStatus(
                session.getSessionId(),
                WorkflowStatus.AI_EXECUTING
        );

        verify(statusEventPublisher)
                .publish(
                        session.getSessionId(),
                        WorkflowStatus.AI_EXECUTING,
                        "사용자가 최종 실행을 승인했습니다."
                );
    }

    @Test
    void 최종_거절_API가_세션과_브라우저를_종료한다()
            throws Exception {

        AutomationSession session =
                createSession(
                        WorkflowStatus.FINAL_CONFIRMATION_REQUIRED
                );

        when(
                browserSessionManager.exists(
                        session.getSessionId()
                )
        ).thenReturn(true);

        mockMvc.perform(
                        post(
                                "/api/v1/sessions/"
                                        + session.getSessionId()
                                        + "/reject"
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
                );

        assertSessionStatus(
                session.getSessionId(),
                WorkflowStatus.CANCELLED
        );

        verify(browserSessionManager)
                .closeSession(
                        session.getSessionId()
                );

        verify(statusEventPublisher)
                .publish(
                        session.getSessionId(),
                        WorkflowStatus.CANCELLED,
                        "최종 실행이 거절되어 세션이 취소되었습니다."
                );
    }

    @Test
    void 존재하지_않는_세션에_선택하면_404를_반환한다()
            throws Exception {

        mockMvc.perform(
                        post(
                                "/api/v1/sessions/"
                                        + "not-found-session"
                                        + "/decisions"
                        )
                                .contentType(
                                        MediaType.APPLICATION_JSON
                                )
                                .content(
                                        """
                                        {
                                          "requestId": "req-003",
                                          "decisionId": "dec-003",
                                          "decisionType": "PRODUCT_SELECTION",
                                          "selectedOptionIds": [
                                            "product-001"
                                          ],
                                          "expectedFrameId": "frm-003",
                                          "expectedSequence": 3
                                        }
                                        """
                                )
                )
                .andExpect(
                        status().isNotFound()
                )
                .andExpect(
                        jsonPath("$.errorCode")
                                .value("SESSION_404")
                );
    }

    @Test
    void 승인_API에_false를_보내면_400을_반환하고_상태를_유지한다()
            throws Exception {

        AutomationSession session =
                createSession(
                        WorkflowStatus.FINAL_CONFIRMATION_REQUIRED
                );

        mockMvc.perform(
                        post(
                                "/api/v1/sessions/"
                                        + session.getSessionId()
                                        + "/confirm"
                        )
                                .contentType(
                                        MediaType.APPLICATION_JSON
                                )
                                .content(
                                        """
                                        {
                                          "confirmationId": "confirm-003",
                                          "approved": false
                                        }
                                        """
                                )
                )
                .andExpect(
                        status().isBadRequest()
                )
                .andExpect(
                        jsonPath("$.errorCode")
                                .value("COMMON_400")
                );

        assertSessionStatus(
                session.getSessionId(),
                WorkflowStatus.FINAL_CONFIRMATION_REQUIRED
        );
    }

    private AutomationSession createSession(
            WorkflowStatus status
    ) {
        AutomationSession session =
                AutomationSession.create(
                        "예금 가입을 도와 줘"
                );

        if (status
                != WorkflowStatus.SESSION_CREATED) {

            session.transitionTo(
                    status
            );
        }

        return sessionRepository.save(
                session
        );
    }

    private void assertSessionStatus(
            String sessionId,
            WorkflowStatus expectedStatus
    ) {
        AutomationSession session =
                sessionRepository
                        .findById(sessionId)
                        .orElseThrow();

        assertThat(
                session.getStatus()
        ).isEqualTo(
                expectedStatus
        );
    }
}
