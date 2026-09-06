package com.ddd.backend.conversation.overlay;

import com.ddd.backend.automation.dom.SanitizedDomSnapshot;

public interface ConversationObservationResumePort {
    void resumeOnce(String sessionId, String requestId,
            PublicOverlayTarget target, SanitizedDomSnapshot resultingSnapshot);
}
