package com.ddd.backend.domain.session;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

public class AutomationSession {

    private final String sessionId;
    private final String userRequest;

    private WorkflowStatus status;

    private final Instant createdAt;

    private Instant updatedAt;

    /*
     * D7
     * 현재 Playwright Browser가 위치한 URL.
     *
     * 세션 최초 생성 직후에는 null일 수 있다.
     */
    private String currentUrl;

    /*
     * D7
     * 세션이 마지막으로 사용된 시각.
     *
     * D8에서 TTL / 만료 세션 정리에 사용한다.
     */
    private Instant lastAccessedAt;

    private AutomationSession(
            String sessionId,
            String userRequest,
            WorkflowStatus status,
            Instant createdAt,
            Instant updatedAt,
            String currentUrl,
            Instant lastAccessedAt
    ) {
        this.sessionId =
                requireText(
                        sessionId,
                        "세션 ID는 필수입니다."
                );

        this.userRequest =
                requireText(
                        userRequest,
                        "사용자 요청은 필수입니다."
                );

        this.status =
                Objects.requireNonNull(
                        status,
                        "워크플로 상태는 필수입니다."
                );

        this.createdAt =
                Objects.requireNonNull(
                        createdAt,
                        "세션 생성 시각은 필수입니다."
                );

        this.updatedAt =
                Objects.requireNonNull(
                        updatedAt,
                        "세션 수정 시각은 필수입니다."
                );

        this.currentUrl =
                normalizeNullableText(
                        currentUrl
                );

        this.lastAccessedAt =
                Objects.requireNonNull(
                        lastAccessedAt,
                        "마지막 접근 시각은 필수입니다."
                );
    }

    /*
     * 신규 세션 생성.
     */
    public static AutomationSession create(
            String userRequest
    ) {
        if (userRequest == null
                || userRequest.isBlank()) {

            throw new IllegalArgumentException(
                    "사용자 요청은 비어 있을 수 없습니다."
            );
        }

        Instant now =
                Instant.now();

        return new AutomationSession(
                UUID.randomUUID().toString(),
                userRequest.trim(),
                WorkflowStatus.SESSION_CREATED,
                now,
                now,
                null,
                now
        );
    }

    /*
     * D7
     * Redis에 저장된 세션을 Domain 객체로 복원할 때 사용한다.
     *
     * Redis Repository 외부에서도 사용할 수는 있지만
     * 신규 세션 생성에는 create()를 사용한다.
     */
    public static AutomationSession restore(
            String sessionId,
            String userRequest,
            WorkflowStatus status,
            Instant createdAt,
            Instant updatedAt,
            String currentUrl,
            Instant lastAccessedAt
    ) {
        return new AutomationSession(
                sessionId,
                userRequest,
                status,
                createdAt,
                updatedAt,
                currentUrl,
                lastAccessedAt
        );
    }

    public void transitionTo(
            WorkflowStatus nextStatus
    ) {
        Objects.requireNonNull(
                nextStatus,
                "변경할 워크플로 상태는 필수입니다."
        );

        if (isTerminalStatus()) {
            throw new IllegalStateException(
                    "종료된 세션의 상태를 변경할 수 없습니다."
            );
        }

        if (nextStatus
                == WorkflowStatus.SESSION_CREATED
                && status
                != WorkflowStatus.SESSION_CREATED) {

            throw new IllegalStateException(
                    "세션 생성 상태로 되돌릴 수 없습니다."
            );
        }

        if (status == nextStatus) {
            touch();
            return;
        }

        changeStatus(
                nextStatus
        );
    }

    public void submitDecision() {
        if (status
                != WorkflowStatus.USER_DECISION_REQUIRED
                && status
                != WorkflowStatus.ADDITIONAL_INFORMATION_REQUIRED) {

            throw new IllegalStateException(
                    "현재 상태에서는 사용자 결정을 제출할 수 없습니다. "
                            + "status="
                            + status
            );
        }

        changeStatus(
                WorkflowStatus.AI_EXECUTING
        );
    }

    public void approveFinalConfirmation() {
        ensureFinalConfirmationRequired();

        changeStatus(
                WorkflowStatus.AI_EXECUTING
        );
    }

    public void rejectFinalConfirmation() {
        ensureFinalConfirmationRequired();

        changeStatus(
                WorkflowStatus.CANCELLED
        );
    }

    public void cancel() {
        if (isTerminalStatus()) {
            throw new IllegalStateException(
                    "현재 상태에서는 세션을 취소할 수 없습니다."
            );
        }

        changeStatus(
                WorkflowStatus.CANCELLED
        );
    }

    /*
     * D7
     * 현재 Browser Page URL을 세션에 기록한다.
     */
    public void updateCurrentUrl(
            String currentUrl
    ) {
        this.currentUrl =
                requireText(
                        currentUrl,
                        "현재 URL은 비어 있을 수 없습니다."
                );

        Instant now =
                Instant.now();

        this.updatedAt =
                now;

        this.lastAccessedAt =
                now;
    }

    /*
     * D7
     * 세션 조회 또는 사용 시 마지막 접근 시각 갱신.
     *
     * D8에서 이 값을 기준으로
     * 유휴 세션 만료 처리를 연결한다.
     */
    public void touch() {
        this.lastAccessedAt =
                Instant.now();
    }

    private void ensureFinalConfirmationRequired() {
        if (status
                != WorkflowStatus.FINAL_CONFIRMATION_REQUIRED) {

            throw new IllegalStateException(
                    "현재 상태에서는 최종 확인을 처리할 수 없습니다. "
                            + "status="
                            + status
            );
        }
    }

    private boolean isTerminalStatus() {
        return status
                == WorkflowStatus.COMPLETED
                || status
                == WorkflowStatus.CANCELLED
                || status
                == WorkflowStatus.TERMINATED;
    }

    private void changeStatus(
            WorkflowStatus nextStatus
    ) {
        Instant now =
                Instant.now();

        this.status =
                nextStatus;

        this.updatedAt =
                now;

        this.lastAccessedAt =
                now;
    }

    private static String requireText(
            String value,
            String message
    ) {
        if (value == null
                || value.isBlank()) {

            throw new IllegalArgumentException(
                    message
            );
        }

        return value.trim();
    }

    private static String normalizeNullableText(
            String value
    ) {
        if (value == null
                || value.isBlank()) {

            return null;
        }

        return value.trim();
    }

    public String getSessionId() {
        return sessionId;
    }

    public String getUserRequest() {
        return userRequest;
    }

    public WorkflowStatus getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public String getCurrentUrl() {
        return currentUrl;
    }

    public Instant getLastAccessedAt() {
        return lastAccessedAt;
    }
}