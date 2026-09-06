package com.ddd.backend.conversation.navigation;

public enum PageReadyResumeError {
    PAGE_READY_RESUME_FAILED,
    DESTINATION_SNAPSHOT_FAILED,
    OVERLAY_TARGET_NOT_FOUND,
    OVERLAY_TARGET_AMBIGUOUS,
    OVERLAY_TARGET_STALE_SNAPSHOT,
    OVERLAY_TARGET_POLICY_MISMATCH;

    public String safeMessage() {
        return "화면 이동은 접수되었지만 다음 안내를 안전하게 준비하지 못했습니다.";
    }
}
