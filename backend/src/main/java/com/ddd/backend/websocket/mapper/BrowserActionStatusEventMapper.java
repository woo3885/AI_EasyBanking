package com.ddd.backend.websocket.mapper;

import com.ddd.backend.automation.BrowserActionExecutionStatus;
import com.ddd.backend.domain.session.WorkflowStatus;
import org.springframework.stereotype.Component;

import java.util.Objects;

@Component
public final class BrowserActionStatusEventMapper {

    public WorkflowStatus toWorkflowStatus(
            BrowserActionExecutionStatus executionStatus
    ) {
        Objects.requireNonNull(
                executionStatus,
                "브라우저 행동 실행 상태는 필수입니다."
        );

        return switch (executionStatus) {
            case EXECUTED,
                 NO_ACTION ->
                    WorkflowStatus.AI_EXECUTING;

            case USER_ACTION_REQUIRED ->
                    WorkflowStatus.USER_DECISION_REQUIRED;

            case SECURE_INPUT_REQUIRED ->
                    WorkflowStatus.SECURE_INPUT_REQUIRED;

            case FINAL_CONFIRMATION_REQUIRED ->
                    WorkflowStatus.FINAL_CONFIRMATION_REQUIRED;

            case BLOCKED ->
                    WorkflowStatus.RISK_WARNING;

            case STOPPED ->
                    WorkflowStatus.TERMINATED;
        };
    }

    public String message(
            BrowserActionExecutionStatus executionStatus
    ) {
        Objects.requireNonNull(
                executionStatus,
                "브라우저 행동 실행 상태는 필수입니다."
        );

        return switch (executionStatus) {
            case EXECUTED ->
                    "브라우저 행동을 실행했습니다.";

            case NO_ACTION ->
                    "현재 실행할 브라우저 행동이 없습니다.";

            case USER_ACTION_REQUIRED ->
                    "사용자의 선택이 필요합니다.";

            case SECURE_INPUT_REQUIRED ->
                    "민감정보는 사용자가 직접 입력해야 합니다.";

            case FINAL_CONFIRMATION_REQUIRED ->
                    "최종 실행 전 사용자의 확인이 필요합니다.";

            case BLOCKED ->
                    "보안 정책에 따라 브라우저 행동을 차단했습니다.";

            case STOPPED ->
                    "브라우저 자동화가 종료되었습니다.";
        };
    }
}