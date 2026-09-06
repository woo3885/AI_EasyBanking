package com.ddd.backend.automation;

public record BrowserActionExecutionResult(
        BrowserActionType actionType,
        BrowserActionExecutionStatus status,
        String message
) {

    public static BrowserActionExecutionResult executed(
            BrowserActionType actionType
    ) {
        return new BrowserActionExecutionResult(
                actionType,
                BrowserActionExecutionStatus.EXECUTED,
                "브라우저 행동이 실행되었습니다."
        );
    }

    public static BrowserActionExecutionResult noAction() {
        return new BrowserActionExecutionResult(
                BrowserActionType.NONE,
                BrowserActionExecutionStatus.NO_ACTION,
                "실행할 브라우저 행동이 없습니다."
        );
    }

    public static BrowserActionExecutionResult userActionRequired(
            BrowserActionType actionType
    ) {
        return new BrowserActionExecutionResult(
                actionType,
                BrowserActionExecutionStatus.USER_ACTION_REQUIRED,
                "사용자가 직접 선택해야 합니다."
        );
    }

    public static BrowserActionExecutionResult secureInputRequired(
            BrowserActionType actionType
    ) {
        return new BrowserActionExecutionResult(
                actionType,
                BrowserActionExecutionStatus.SECURE_INPUT_REQUIRED,
                "민감정보는 사용자가 직접 입력해야 합니다."
        );
    }

    public static BrowserActionExecutionResult finalConfirmationRequired(
            BrowserActionType actionType
    ) {
        return new BrowserActionExecutionResult(
                actionType,
                BrowserActionExecutionStatus.FINAL_CONFIRMATION_REQUIRED,
                "최종 실행 전 사용자의 확인이 필요합니다."
        );
    }

    public static BrowserActionExecutionResult blocked(
            BrowserActionType actionType
    ) {
        return new BrowserActionExecutionResult(
                actionType,
                BrowserActionExecutionStatus.BLOCKED,
                "보안 정책에 따라 실행할 수 없는 행동입니다."
        );
    }

    public static BrowserActionExecutionResult stopped() {
        return new BrowserActionExecutionResult(
                BrowserActionType.STOP,
                BrowserActionExecutionStatus.STOPPED,
                "브라우저 자동화가 중단되었습니다."
        );
    }
}