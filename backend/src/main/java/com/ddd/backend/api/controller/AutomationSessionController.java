package com.ddd.backend.api.controller;

import com.ddd.backend.api.dto.session.AutomationSessionResponse;
import com.ddd.backend.api.dto.session.CreateSessionRequest;
import com.ddd.backend.api.dto.session.SubmitConfirmationRequest;
import com.ddd.backend.api.dto.session.ConfirmationActionResponse;
import com.ddd.backend.api.dto.session.SubmitDecisionRequest;
import com.ddd.backend.api.dto.session.CompleteSecureInputRequest;
import com.ddd.backend.api.dto.session.SecureInputSubmissionResponse;
import com.ddd.backend.api.dto.conversation.SessionMessageAcceptedResponse;
import com.ddd.backend.conversation.ConversationService;
import com.ddd.backend.conversation.MessageAcceptance;
import com.ddd.backend.conversation.agent.ConversationAgentAsyncProcessor;
import com.ddd.backend.common.response.ApiResponse;
import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.service.AutomationSessionService;
import com.ddd.backend.service.UserDecisionService;
import com.ddd.backend.security.secureinput.SecureInputService;
import com.ddd.backend.security.secureinput.SecureInputTransportPolicy;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/sessions")
public class AutomationSessionController {

    private final AutomationSessionService sessionService;
    private final UserDecisionService userDecisionService;
    private final SecureInputService secureInputService;
    private final SecureInputTransportPolicy secureInputTransportPolicy;
    private ConversationService conversationService;
    private ConversationAgentAsyncProcessor conversationAgentProcessor;

    @Autowired(required = false)
    void setConversationService(ConversationService conversationService) {
        this.conversationService = conversationService;
    }

    @Autowired(required = false)
    void setConversationAgentProcessor(ConversationAgentAsyncProcessor processor) {
        this.conversationAgentProcessor = processor;
    }

    @Autowired
    public AutomationSessionController(
            AutomationSessionService sessionService,
            UserDecisionService userDecisionService,
            SecureInputService secureInputService,
            SecureInputTransportPolicy secureInputTransportPolicy
    ) {
        this.sessionService = sessionService;
        this.userDecisionService = userDecisionService;
        this.secureInputService = secureInputService;
        this.secureInputTransportPolicy = secureInputTransportPolicy;
    }

    public AutomationSessionController(
            AutomationSessionService sessionService,
            UserDecisionService userDecisionService
    ) {
        this(sessionService, userDecisionService, null, null);
    }

    @PostMapping("/{sessionId}/secure-inputs/{secureRequestId}/complete")
    public ApiResponse<SecureInputSubmissionResponse> submitSecureInput(
            @PathVariable String sessionId,
            @PathVariable String secureRequestId,
            @Valid @RequestBody CompleteSecureInputRequest request,
            HttpServletRequest httpRequest
    ) {
        if (secureInputService == null) {
            throw new IllegalStateException("보안 입력 서비스를 사용할 수 없습니다.");
        }
        if (secureInputTransportPolicy != null) {
            secureInputTransportPolicy.verify(httpRequest);
        }
        return ApiResponse.success(
                secureInputService.submit(sessionId, secureRequestId, request),
                "보안 입력 완료 여부를 확인하고 있습니다. 인증 성공을 의미하지 않습니다.");
    }

    @PostMapping
    public ResponseEntity<ApiResponse<?>>
    createSession(
            @Valid @RequestBody CreateSessionRequest request
    ) {
        String sessionContent = request.resolvedContent();
        if (request.usesConversationContract()) {
            if (conversationService == null) {
                throw new IllegalStateException("대화 서비스를 사용할 수 없습니다.");
            }
            sessionContent = conversationService.validateContent(sessionContent);
        }
        AutomationSession session = request.usesConversationContract()
                ? sessionService.createConversationSession(
                        sessionContent, request.siteId(), request.initialPath())
                : sessionService.createSession(sessionContent, request.siteId(), request.initialPath());

        AutomationSessionResponse response =
                AutomationSessionResponse.from(
                        session
                );

        /* 응답 DTO를 SESSION_CREATED로 확정한 뒤 비동기 Agent loop를 예약한다. */
        if (request.usesConversationContract()) {
            MessageAcceptance acceptance = conversationService.acceptInitial(
                    session.getSessionId(), request.requestId(), request.messageId(),
                    request.content(), request.clientOccurredAt());
            if (conversationAgentProcessor != null) {
                conversationAgentProcessor.submit(session.getSessionId(), acceptance,
                        request.content(), null);
            }
            return ResponseEntity.status(HttpStatus.ACCEPTED).body(ApiResponse.success(
                    SessionMessageAcceptedResponse.from(acceptance, session.getStatus()),
                    "메시지가 접수되었습니다. AI 판단이나 실행 성공을 의미하지 않습니다."));
        }

        sessionService.startInitialAi(session.getSessionId());

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(
                        ApiResponse.success(
                                response,
                                "자동화 세션이 생성되었습니다."
                        )
                );
    }

    @GetMapping("/{sessionId}")
    public ApiResponse<AutomationSessionResponse> getSession(
            @PathVariable String sessionId
    ) {
        AutomationSession session =
                sessionService.getSession(
                        sessionId
                );

        return ApiResponse.success(
                AutomationSessionResponse.from(
                        session
                )
        );
    }

    @PostMapping("/{sessionId}/cancel")
    public ApiResponse<AutomationSessionResponse> cancelSession(
            @PathVariable String sessionId
    ) {
        AutomationSession session =
                sessionService.cancelSession(
                        sessionId
                );

        return ApiResponse.success(
                AutomationSessionResponse.from(
                        session
                ),
                "자동화 세션이 취소되었습니다."
        );
    }

    @PostMapping("/{sessionId}/decisions")
    public ApiResponse<AutomationSessionResponse> submitDecision(
            @PathVariable String sessionId,
            @Valid @RequestBody SubmitDecisionRequest request
    ) {
        AutomationSession session =
                userDecisionService.submitDecision(
                        sessionId,
                        request
                );

        return ApiResponse.success(
                AutomationSessionResponse.from(
                        session
                ),
                "사용자 결정이 제출되었습니다."
        );
    }

    @PostMapping("/{sessionId}/confirm")
    public ApiResponse<ConfirmationActionResponse> confirmFinalAction(
            @PathVariable String sessionId,
            @Valid @RequestBody SubmitConfirmationRequest request
    ) {
        ConfirmationActionResponse response =
                userDecisionService.confirmFinalActionAck(sessionId, request);

        return ApiResponse.success(
                response,
                "최종 승인 요청이 접수되었습니다."
        );
    }

    @PostMapping("/{sessionId}/reject")
    public ApiResponse<ConfirmationActionResponse> rejectFinalAction(
            @PathVariable String sessionId,
            @Valid @RequestBody SubmitConfirmationRequest request
    ) {
        ConfirmationActionResponse response =
                userDecisionService.rejectFinalActionAck(sessionId, request);

        return ApiResponse.success(
                response,
                "최종 거절 요청이 접수되었습니다."
        );
    }
}
