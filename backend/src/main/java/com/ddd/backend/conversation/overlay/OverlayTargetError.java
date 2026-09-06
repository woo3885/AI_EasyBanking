package com.ddd.backend.conversation.overlay;

import org.springframework.http.HttpStatus;

public enum OverlayTargetError {
    TARGET_NOT_FOUND(HttpStatus.NOT_FOUND),
    TARGET_ID_MISMATCH(HttpStatus.CONFLICT),
    TARGET_STALE_PAGE(HttpStatus.CONFLICT),
    TARGET_STALE_SNAPSHOT(HttpStatus.CONFLICT),
    TARGET_EXPIRED(HttpStatus.GONE),
    TARGET_ALREADY_CONSUMED(HttpStatus.CONFLICT),
    TARGET_NOT_INTERACTABLE(HttpStatus.CONFLICT),
    OBSERVATION_DUPLICATE_REQUEST(HttpStatus.CONFLICT),
    OBSERVATION_IN_PROGRESS(HttpStatus.CONFLICT),
    OBSERVATION_DOM_NOT_CHANGED(HttpStatus.CONFLICT),
    PUBLIC_TARGET_KEY_MISMATCH(HttpStatus.CONFLICT),
    OBSERVATION_CLICK_OUTSIDE(HttpStatus.CONFLICT),
    BRIDGE_TOKEN_INVALID(HttpStatus.UNAUTHORIZED),
    BRIDGE_ORIGIN_NOT_ALLOWED(HttpStatus.FORBIDDEN);

    private final HttpStatus status;
    OverlayTargetError(HttpStatus status) { this.status = status; }
    public HttpStatus status() { return status; }
    public String safeMessage() { return "요청한 사용자 상호작용을 안전하게 확인할 수 없습니다."; }
}
