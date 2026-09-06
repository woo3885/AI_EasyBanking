package com.ddd.backend.common.exception;

public final class UserDecisionResumeException extends IllegalStateException {

    public UserDecisionResumeException(Throwable cause) {
        super("사용자 결정 후속 처리에 실패했습니다.", cause);
    }
}
