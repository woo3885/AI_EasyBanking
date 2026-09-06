package com.ddd.backend.conversation.bridge;

public final class DemoAgentBridgeAuthenticationException extends RuntimeException {
    public DemoAgentBridgeAuthenticationException() {
        super("Demo Agent bridge 인증에 실패했습니다.");
    }
}
