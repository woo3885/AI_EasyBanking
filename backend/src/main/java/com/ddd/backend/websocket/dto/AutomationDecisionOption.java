package com.ddd.backend.websocket.dto;

import com.ddd.backend.security.SensitiveDataMasker;

public record AutomationDecisionOption(
        String id,
        String label,
        boolean required,
        boolean checked,
        boolean disabled
) {
    public AutomationDecisionOption {
        if (id == null || id.isBlank() || label == null || label.isBlank()) {
            throw new IllegalArgumentException("결정 선택 항목 ID와 label은 필수입니다.");
        }
        id = id.trim();
        if (id.length() > 100 || id.chars().anyMatch(Character::isISOControl)) {
            throw new IllegalArgumentException("결정 선택 항목 ID가 올바르지 않습니다.");
        }
        String cleaned = label.replaceAll("<[^>]*>", " ")
                .replaceAll("[\\p{Cntrl}]", " ").replaceAll("\\s+", " ").trim();
        String lower = cleaned.toLowerCase(java.util.Locale.ROOT);
        label = lower.matches(".*(password|passwd|pin|otp|비밀번호|인증번호).*?")
                ? "[SENSITIVE]"
                : SensitiveDataMasker.maskFreeText(cleaned);
        label = label.substring(0, Math.min(label.length(), 120));
        if (label.isBlank()) {
            throw new IllegalArgumentException("결정 선택 항목 label은 필수입니다.");
        }
    }

    public AutomationDecisionOption(String id, String label) {
        this(id, label, false, false, false);
    }
}
