package com.ddd.backend.api.dto.action;

public enum PublicBrowserActionSource {

    /*
     * 공개 Browser Action API는
     * 실제 Viewer 사용자가 발생시킨 Action만 받는다.
     *
     * AI Action은 이 API를 사용하지 않는다.
     */
    USER_VIEWER
}