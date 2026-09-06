package com.ddd.backend.conversation.agent;

import com.ddd.backend.automation.dom.SanitizedDomSnapshot;
import com.ddd.backend.automation.dom.SanitizedDomSnapshotService;
import com.ddd.backend.conversation.ConversationState;
import com.ddd.backend.conversation.MessageAcceptance;
import com.ddd.backend.conversation.bridge.DemoAgentBridgeBinding;
import com.ddd.backend.conversation.bridge.DemoAgentBridgeRegistry;
import org.springframework.stereotype.Service;

/** Goal patch 적용 뒤 최신 DOM으로 대화형 AI를 정확히 한 번 다시 호출한다. */
@Service
public class ConversationAgentDomDecisionService {
    private final SanitizedDomSnapshotService snapshots;
    private final DemoAgentBridgeRegistry bridges;
    private final ConversationAgentClient client;
    private final ConversationAgentContractValidator validator;

    public ConversationAgentDomDecisionService(
            SanitizedDomSnapshotService snapshots,
            DemoAgentBridgeRegistry bridges,
            ConversationAgentClient client,
            ConversationAgentContractValidator validator
    ) {
        this.snapshots = snapshots;
        this.bridges = bridges;
        this.client = client;
        this.validator = validator;
    }

    public boolean canContinue(String sessionId) {
        return bridges.find(sessionId).isPresent();
    }

    public ConversationAgentDecision decideOnce(
            String sessionId,
            MessageAcceptance acceptance,
            ConversationState state,
            String content,
            String answerToQuestionId
    ) {
        DemoAgentBridgeBinding bridge = bridges.find(sessionId)
                .orElseThrow(() -> new IllegalStateException("Demo Agent bridge binding이 없습니다."));
        SanitizedDomSnapshot snapshot = snapshots.createSnapshot(sessionId);
        ConversationAgentRequest request = new ConversationAgentRequest(
                sessionId,
                acceptance.requestId(),
                acceptance.messageId(),
                state.sequence(),
                state.goal(),
                new ConversationAgentRequest.UserMessage(content, answerToQuestionId),
                new ConversationAgentRequest.SnapshotContext(
                        snapshot.snapshotId(), bridge.pageIdentity(), snapshot));
        return validator.validate(request, client.decide(request));
    }
}
