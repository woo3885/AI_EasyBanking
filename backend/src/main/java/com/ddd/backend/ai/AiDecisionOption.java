package com.ddd.backend.ai;

public record AiDecisionOption(
        String id,
        String label,
        boolean required,
        Boolean checked
) {
    public AiDecisionOption(String id, String label, boolean required) {
        this(id, label, required, null);
    }
}
