package com.ddd.backend.conversation.overlay;

import com.ddd.backend.automation.dom.SanitizedDomSnapshot;

public interface ConversationObservationResumePort {
    void resumeOnce(String sessionId, PublicOverlayTarget target, SanitizedDomSnapshot resultingSnapshot);
}
