package com.ddd.backend.websocket.dto;

public record AutomationTarget(
        String elementId,
        String label,
        double x,
        double y,
        double width,
        double height,
        String frameId,
        long frameSequence,
        String snapshotId
) {
    public AutomationTarget {
        if (elementId == null || elementId.isBlank()) {
            throw new IllegalArgumentException("elementId는 필수입니다.");
        }
        if (label == null || label.isBlank()) {
            throw new IllegalArgumentException("Target label은 필수입니다.");
        }
        if (width <= 0 || height <= 0) {
            throw new IllegalArgumentException("Target 크기는 0보다 커야 합니다.");
        }
        if (frameId == null || frameId.isBlank() || frameSequence < 1) {
            throw new IllegalArgumentException("Target Frame 정보가 올바르지 않습니다.");
        }
        if (snapshotId == null || snapshotId.isBlank()) {
            throw new IllegalArgumentException("snapshotId는 필수입니다.");
        }
        elementId = elementId.trim();
        label = label.trim();
        frameId = frameId.trim();
        snapshotId = snapshotId.trim();
    }
}
