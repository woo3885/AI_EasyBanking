package com.ddd.backend.conversation.overlay;

import com.ddd.backend.automation.dom.SanitizedDomSnapshot;
import com.ddd.backend.conversation.ConversationService;
import com.ddd.backend.conversation.agent.*;
import org.springframework.stereotype.Service;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/** 사용자 Action 이후 최신 DOM으로 conversation AI 판단을 정확히 한 번 재개한다. */
@Service
public final class ConversationObservationResumeAdapter implements ConversationObservationResumePort {
    private final ConversationService conversations;
    private final ConversationAgentClient client;
    private final ConversationAgentContractValidator validator;
    private final ConversationAgentCoordinator coordinator;
    private final Set<String> resumedRequests = ConcurrentHashMap.newKeySet();

    public ConversationObservationResumeAdapter(ConversationService conversations,
            ConversationAgentClient client, ConversationAgentContractValidator validator,
            ConversationAgentCoordinator coordinator) {
        this.conversations = conversations;
        this.client = client;
        this.validator = validator;
        this.coordinator = coordinator;
    }

    @Override
    public void resumeOnce(String sessionId, String requestId,
            PublicOverlayTarget target, SanitizedDomSnapshot resultingSnapshot) {
        String idempotencyKey = sessionId + ':' + requestId;
        if (!resumedRequests.add(idempotencyKey)) {
            throw new OverlayTargetException(OverlayTargetError.OBSERVATION_DUPLICATE_REQUEST);
        }
        var state = conversations.state(sessionId);
        var request = new ConversationAgentRequest(
                sessionId, requestId, "observation-" + target.targetId(),
                state.sequence(), state.goal(),
                new ConversationAgentRequest.UserMessage("USER_ACTION_OBSERVED", null),
                new ConversationAgentRequest.SnapshotContext(
                        resultingSnapshot.snapshotId(), target.pageIdentity(), resultingSnapshot));
        ConversationAgentDecision decision = validator.validate(request, client.decide(request));
        coordinator.applyObservedDomDecision(sessionId, decision, resultingSnapshot);
    }

    public void removeSession(String sessionId) {
        resumedRequests.removeIf(key -> key.startsWith(sessionId + ':'));
    }
}
