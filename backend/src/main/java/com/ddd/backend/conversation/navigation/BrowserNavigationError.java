package com.ddd.backend.conversation.navigation;

import org.springframework.http.HttpStatus;

public enum BrowserNavigationError {
    BROWSER_BINDING_NOT_FOUND(HttpStatus.NOT_FOUND, "사용자 브라우저 연결을 찾을 수 없습니다."),
    BROWSER_BINDING_MISMATCH(HttpStatus.UNAUTHORIZED, "사용자 브라우저 연결 정보가 일치하지 않습니다."),
    BROWSER_BINDING_EXPIRED(HttpStatus.GONE, "사용자 브라우저 연결 시간이 만료되었습니다."),
    NAVIGATION_NOT_FOUND(HttpStatus.NOT_FOUND, "활성 화면 이동 요청을 찾을 수 없습니다."),
    NAVIGATION_ID_MISMATCH(HttpStatus.CONFLICT, "현재 화면 이동 요청과 일치하지 않습니다."),
    NAVIGATION_STALE(HttpStatus.CONFLICT, "오래된 화면 이동 요청입니다."),
    NAVIGATION_EXPIRED(HttpStatus.GONE, "화면 이동 요청 시간이 만료되었습니다."),
    NAVIGATION_DUPLICATE_REQUEST(HttpStatus.CONFLICT, "이미 사용된 화면 준비 요청 ID입니다."),
    NAVIGATION_REQUEST_IN_PROGRESS(HttpStatus.CONFLICT, "화면 준비 요청을 이미 처리하고 있습니다."),
    NAVIGATION_ROUTE_MISMATCH(HttpStatus.CONFLICT, "렌더링된 화면 경로가 요청과 일치하지 않습니다."),
    NAVIGATION_PAGE_IDENTITY_MISMATCH(HttpStatus.CONFLICT, "화면 identity가 이동 요청과 일치하지 않습니다."),
    NAVIGATION_WORKFLOW_CONFLICT(HttpStatus.CONFLICT, "현재 상태에서는 사용자 화면을 이동할 수 없습니다."),
    PAGE_READY_ALREADY_ACCEPTED(HttpStatus.CONFLICT, "이미 처리된 화면 준비 완료 요청입니다.");

    private final HttpStatus status;
    private final String safeMessage;

    BrowserNavigationError(HttpStatus status, String safeMessage) {
        this.status = status;
        this.safeMessage = safeMessage;
    }

    public HttpStatus status() { return status; }
    public String safeMessage() { return safeMessage; }
}
