package com.ddd.backend.automation;

public record BrowserActionPolicyResult(
        BrowserActionPolicyDecision decision,
        String message
) {

    public static BrowserActionPolicyResult allowed() {
        return new BrowserActionPolicyResult(
                BrowserActionPolicyDecision.ALLOW,
                "자동 실행이 허용된 브라우저 행동입니다."
        );
    }

    public static BrowserActionPolicyResult userActionRequired() {
        return new BrowserActionPolicyResult(
                BrowserActionPolicyDecision.USER_ACTION_REQUIRED,
                "사용자가 직접 선택해야 합니다."
        );
    }

    public static BrowserActionPolicyResult secureInputRequired() {
        return new BrowserActionPolicyResult(
                BrowserActionPolicyDecision.SECURE_INPUT_REQUIRED,
                "민감정보는 사용자가 직접 입력해야 합니다."
        );
    }

    public static BrowserActionPolicyResult finalConfirmationRequired() {
        return new BrowserActionPolicyResult(
                BrowserActionPolicyDecision.FINAL_CONFIRMATION_REQUIRED,
                "최종 실행 전 사용자의 확인이 필요합니다."
        );
    }

    public static BrowserActionPolicyResult blocked() {
        return new BrowserActionPolicyResult(
                BrowserActionPolicyDecision.BLOCKED,
                "보안 정책에 따라 실행할 수 없는 대상입니다."
        );
    }
}
