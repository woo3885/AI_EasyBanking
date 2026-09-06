package com.ddd.backend.conversation.overlay;

import java.util.Set;

public final class PublicTargetKeyPolicy {
    private static final Set<String> FORBIDDEN_TOKENS = Set.of(
            "session", "element", "selector", "xpath", "password", "otp", "pin", "token");

    private PublicTargetKeyPolicy() { }

    public static boolean isValid(String value) {
        if (value == null || value.length() > 96
                || !value.matches("[a-z0-9]+(?:-[a-z0-9]+)*")) return false;
        for (String token : value.split("-")) {
            if (FORBIDDEN_TOKENS.contains(token)) return false;
        }
        return true;
    }
}
