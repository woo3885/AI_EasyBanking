package com.ddd.backend.api.controller;

import com.ddd.backend.api.dto.conversation.SessionMessageAcceptedResponse;
import com.ddd.backend.api.dto.conversation.SubmitSessionMessageRequest;
import com.ddd.backend.common.response.ApiResponse;
import com.ddd.backend.conversation.ConversationService;
import com.ddd.backend.conversation.ConversationSnapshot;
import com.ddd.backend.conversation.MessageAcceptance;
import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.service.AutomationSessionService;
import com.ddd.backend.conversation.agent.ConversationAgentAsyncProcessor;
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
@RequestMapping("/api/v1/sessions/{sessionId}")
public class ConversationController {

    private final ConversationService conversationService;
    private final AutomationSessionService sessionService;
    private ConversationAgentAsyncProcessor agentProcessor;

    public ConversationController(
            ConversationService conversationService,
            AutomationSessionService sessionService
    ) {
        this.conversationService = conversationService;
        this.sessionService = sessionService;
    }

    @Autowired(required = false)
    void setAgentProcessor(ConversationAgentAsyncProcessor agentProcessor) {
        this.agentProcessor = agentProcessor;
    }

    @PostMapping("/messages")
    public ResponseEntity<ApiResponse<SessionMessageAcceptedResponse>> submitMessage(
            @PathVariable String sessionId,
            @Valid @RequestBody SubmitSessionMessageRequest request
    ) {
        MessageAcceptance acceptance = conversationService.acceptFollowUp(sessionId, request);
        AutomationSession session = sessionService.getSession(sessionId);
        if (agentProcessor != null) {
            agentProcessor.submit(sessionId, acceptance, request.content(), request.answerToQuestionId());
        }
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(ApiResponse.success(
                SessionMessageAcceptedResponse.from(acceptance, session.getStatus()),
                "메시지가 접수되었습니다. AI 판단이나 실행 성공을 의미하지 않습니다."));
    }

    @GetMapping("/conversation")
    public ApiResponse<ConversationSnapshot> getConversation(@PathVariable String sessionId) {
        return ApiResponse.success(conversationService.snapshot(sessionId));
    }
}
