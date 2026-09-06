package com.ddd.backend.conversation.event;
public sealed interface ConversationEvent permits UserMessageAcceptedEvent, AiQuestionEvent, AiMessageEvent,
        OverlayTargetEvent, OverlayClearEvent, UserActionObservedEvent,
        NavigationRequiredEvent, PageReadyObservedEvent, NavigationClearEvent {
    String eventId(); long eventSequence(); String eventType(); String sessionId();
}
