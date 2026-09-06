package com.ddd.backend.conversation.overlay;

public record PublicTargetLocator(
        String type,
        String publicTargetKey,
        String role,
        String accessibleName
) {
    public static final String TYPE = "PUBLIC_TARGET_KEY";
}
