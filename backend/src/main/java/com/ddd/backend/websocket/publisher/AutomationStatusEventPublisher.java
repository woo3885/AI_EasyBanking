package com.ddd.backend.websocket.publisher;

import com.ddd.backend.domain.session.WorkflowStatus;
import com.ddd.backend.websocket.dto.AutomationStatusEvent;
import com.ddd.backend.websocket.dto.AutomationTarget;
import com.ddd.backend.websocket.dto.AutomationDecisionPrompt;
import com.ddd.backend.websocket.dto.AutomationUiEvent;
import com.ddd.backend.websocket.dto.AutomationUiEventSnapshot;
import com.ddd.backend.websocket.dto.AutomationUiEventType;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Autowired;
import com.ddd.backend.service.decision.UserDecisionSessionState;
import com.ddd.backend.security.secureinput.SecureInputRequest;
import com.ddd.backend.service.confirmation.FinalConfirmationRequest;
import com.ddd.backend.service.confirmation.FinalConfirmationStore;
import com.ddd.backend.websocket.dto.ConfirmationEventPayload;

import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.regex.Pattern;

@Component
public final class AutomationStatusEventPublisher {

    public static final String DESTINATION_PREFIX =
            "/topic/sessions/";

    public static final String DESTINATION_SUFFIX =
            "/status";

    public static final String UI_DESTINATION_SUFFIX =
            "/events";

    private static final Pattern SAFE_SESSION_ID =
            Pattern.compile("^[a-zA-Z0-9-]{1,100}$");

    private final SimpMessagingTemplate messagingTemplate;
    private final UserDecisionSessionState decisionState;
    private FinalConfirmationStore finalConfirmationStore;

    @Autowired
    void setFinalConfirmationStore(FinalConfirmationStore store) {
        this.finalConfirmationStore = store;
        store.setExpirationListener((sessionId, confirmation) -> {
            publishConfirmationClear(sessionId, confirmation);
            publish(sessionId, WorkflowStatus.ERROR,
                    "최종 확인 시간이 만료되어 요청을 안전하게 종료했습니다.");
        });
    }

    private final ConcurrentMap<String, SessionUiState> uiStates =
            new ConcurrentHashMap<>();

    @Autowired
    public AutomationStatusEventPublisher(
            SimpMessagingTemplate messagingTemplate,
            UserDecisionSessionState decisionState
    ) {
        this.messagingTemplate =
                Objects.requireNonNull(
                        messagingTemplate,
                        "SimpMessagingTemplate은 필수입니다."
                );
        this.decisionState = Objects.requireNonNull(decisionState);
    }

    public AutomationStatusEventPublisher(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = Objects.requireNonNull(
                messagingTemplate, "SimpMessagingTemplate은 필수입니다.");
        this.decisionState = null;
    }

    public void publish(
            String sessionId,
            WorkflowStatus status,
            String message
    ) {
        publish(
                AutomationStatusEvent.create(
                        sessionId,
                        status,
                        message
                )
        );
    }

    public void publish(
            AutomationStatusEvent event
    ) {
        Objects.requireNonNull(
                event,
                "상태 이벤트는 필수입니다."
        );

        if (clearsConfirmation(event.status()) && finalConfirmationStore != null) {
            finalConfirmationStore.clear(event.sessionId())
                    .ifPresent(confirmation ->
                            publishConfirmationClear(event.sessionId(), confirmation));
        }

        messagingTemplate.convertAndSend(
                destination(event.sessionId()),
                event
        );

        publishUiEvent(
                event.sessionId(),
                AutomationUiEventType.STATE,
                event.status(),
                event.message(),
                requiresUserAction(event.status()),
                null,
                null,
                null
        );

        if (event.message() != null) {
            publishGuide(
                    event.sessionId(),
                    event.message(),
                    requiresUserAction(event.status())
            );
        }

        if (clearsTarget(event.status())) {
            publishTargetClear(event.sessionId(), event.message());
        }
        if (clearsDecision(event.status())) {
            publishDecisionClear(event.sessionId(), event.message());
            if (decisionState != null) {
                decisionState.removeSession(event.sessionId());
            }
        }
        if (clearsSecureInput(event.status())) {
            publishSecureInputClear(event.sessionId());
        }
    }

    public AutomationUiEvent publishGuide(
            String sessionId,
            String message,
            boolean actionRequired
    ) {
        return publishUiEvent(sessionId, AutomationUiEventType.GUIDE,
                null, message, actionRequired, null, null, null);
    }

    public AutomationUiEvent publishTarget(
            String sessionId,
            AutomationTarget target,
            String message
    ) {
        Objects.requireNonNull(target, "Target은 필수입니다.");
        return publishUiEvent(sessionId, AutomationUiEventType.TARGET,
                null, message, false, target, null, null);
    }

    public AutomationUiEvent publishTargetClear(
            String sessionId,
            String message
    ) {
        return publishUiEvent(sessionId, AutomationUiEventType.TARGET_CLEAR,
                null, message, false, null, null, null);
    }

    public AutomationUiEvent publishDecisionRequired(
            String sessionId,
            AutomationDecisionPrompt decision,
            String message
    ) {
        Objects.requireNonNull(decision, "Decision Prompt는 필수입니다.");
        return publishUiEvent(
                sessionId, AutomationUiEventType.DECISION_REQUIRED,
                null, message, true, null, decision, null
        );
    }

    public AutomationUiEvent publishDecisionResolved(
            String sessionId,
            String message
    ) {
        return publishUiEvent(
                sessionId, AutomationUiEventType.DECISION_RESOLVED,
                null, message, false, null, null, null
        );
    }

    public AutomationUiEvent publishDecisionClear(String sessionId, String message) {
        return publishUiEvent(
                sessionId, AutomationUiEventType.DECISION_CLEAR,
                null, message, false, null, null, null);
    }

    public AutomationUiEvent publishSecureInputRequired(
            String sessionId, SecureInputRequest secureInput
    ) {
        Objects.requireNonNull(secureInput, "Secure input request는 필수입니다.");
        return publishUiEvent(sessionId, AutomationUiEventType.SECURE_INPUT_REQUIRED,
                WorkflowStatus.SECURE_INPUT_REQUIRED, secureInput.message(), true,
                null, null, secureInput);
    }

    public AutomationUiEvent publishSecureInputResolved(
            String sessionId, SecureInputRequest secureInput
    ) {
        return publishUiEvent(sessionId, AutomationUiEventType.SECURE_INPUT_RESOLVED,
                WorkflowStatus.PAGE_LOADING,
                "보안 입력 완료 요청의 안전 검증이 끝났습니다.", false,
                null, null, secureInput);
    }

    public AutomationUiEvent publishSecureInputClear(String sessionId) {
        return publishUiEvent(sessionId, AutomationUiEventType.SECURE_INPUT_CLEAR,
                null, "보안 입력 요청이 정리되었습니다.", false,
                null, null, null);
    }

    public AutomationUiEvent publishConfirmationRequired(
            String sessionId, FinalConfirmationRequest confirmation
    ) {
        Objects.requireNonNull(confirmation, "Final confirmation은 필수입니다.");
        return publishUiEvent(sessionId, AutomationUiEventType.CONFIRMATION_REQUIRED,
                WorkflowStatus.FINAL_CONFIRMATION_REQUIRED,
                "예금 가입 전 최종 확인이 필요합니다.", true,
                null, null, null, ConfirmationEventPayload.from(confirmation));
    }

    public AutomationUiEvent publishConfirmationResolved(
            String sessionId, FinalConfirmationRequest confirmation
    ) {
        return publishUiEvent(sessionId, AutomationUiEventType.CONFIRMATION_RESOLVED,
                WorkflowStatus.PAGE_LOADING, "최종 실행이 승인되었습니다.", false,
                null, null, null,
                ConfirmationEventPayload.from(confirmation).identityOnly());
    }

    public AutomationUiEvent publishConfirmationRejected(
            String sessionId, FinalConfirmationRequest confirmation
    ) {
        return publishUiEvent(sessionId, AutomationUiEventType.CONFIRMATION_REJECTED,
                WorkflowStatus.CANCELLED, "최종 실행이 거절되었습니다.", false,
                null, null, null,
                ConfirmationEventPayload.from(confirmation).identityOnly());
    }

    public AutomationUiEvent publishConfirmationClear(
            String sessionId, FinalConfirmationRequest confirmation
    ) {
        return publishUiEvent(sessionId, AutomationUiEventType.CONFIRMATION_CLEAR,
                null, "최종 확인 요청이 정리되었습니다.", false,
                null, null, null,
                ConfirmationEventPayload.from(confirmation).identityOnly());
    }

    public Optional<AutomationUiEventSnapshot> latestSnapshot(String sessionId) {
        destination(sessionId);
        SessionUiState state = uiStates.get(sessionId);
        return state == null ? Optional.empty() : Optional.of(state.snapshot(sessionId));
    }

    public void removeSession(String sessionId) {
        if (sessionId != null) {
            uiStates.remove(sessionId);
            if (finalConfirmationStore != null) {
                finalConfirmationStore.removeSession(sessionId);
            }
        }
    }

    private AutomationUiEvent publishUiEvent(
            String sessionId,
            AutomationUiEventType type,
            WorkflowStatus status,
            String message,
            boolean actionRequired,
            AutomationTarget target,
            AutomationDecisionPrompt decision,
            SecureInputRequest secureInput
    ) {
        return publishUiEvent(sessionId, type, status, message, actionRequired,
                target, decision, secureInput, null);
    }

    private AutomationUiEvent publishUiEvent(
            String sessionId, AutomationUiEventType type,
            WorkflowStatus status, String message, boolean actionRequired,
            AutomationTarget target, AutomationDecisionPrompt decision,
            SecureInputRequest secureInput,
            ConfirmationEventPayload confirmation
    ) {
        String uiDestination = uiDestination(sessionId);
        SessionUiState state = uiStates.computeIfAbsent(
                sessionId, ignored -> new SessionUiState());
        AutomationUiEvent event = state.next(
                sessionId, type, status, message, actionRequired, target, decision,
                secureInput, confirmation);
        messagingTemplate.convertAndSend(uiDestination, event);
        return event;
    }

    String destination(
            String sessionId
    ) {
        if (sessionId == null
                || !SAFE_SESSION_ID
                .matcher(sessionId)
                .matches()) {

            throw new IllegalArgumentException(
                    "WebSocket 전송에 사용할 수 없는 세션 ID입니다."
            );
        }

        return DESTINATION_PREFIX
                + sessionId
                + DESTINATION_SUFFIX;
    }

    String uiDestination(String sessionId) {
        destination(sessionId);
        return DESTINATION_PREFIX + sessionId + UI_DESTINATION_SUFFIX;
    }

    private boolean requiresUserAction(WorkflowStatus status) {
        return status == WorkflowStatus.USER_DECISION_REQUIRED
                || status == WorkflowStatus.ADDITIONAL_INFORMATION_REQUIRED
                || status == WorkflowStatus.SECURE_INPUT_REQUIRED
                || status == WorkflowStatus.FINAL_CONFIRMATION_REQUIRED
                || status == WorkflowStatus.RISK_WARNING;
    }

    private boolean clearsTarget(WorkflowStatus status) {
        return status == WorkflowStatus.PAGE_LOADING
                || status == WorkflowStatus.AI_EXECUTING
                || requiresUserAction(status)
                || status == WorkflowStatus.COMPLETED
                || status == WorkflowStatus.CANCELLED
                || status == WorkflowStatus.ERROR
                || status == WorkflowStatus.TERMINATED;
    }

    private boolean clearsDecision(WorkflowStatus status) {
        return status == WorkflowStatus.SECURE_INPUT_REQUIRED
                || status == WorkflowStatus.FINAL_CONFIRMATION_REQUIRED
                || status == WorkflowStatus.RISK_WARNING
                || status == WorkflowStatus.COMPLETED
                || status == WorkflowStatus.CANCELLED
                || status == WorkflowStatus.ERROR
                || status == WorkflowStatus.TERMINATED;
    }

    private boolean clearsSecureInput(WorkflowStatus status) {
        return status == WorkflowStatus.FINAL_CONFIRMATION_REQUIRED
                || status == WorkflowStatus.RISK_WARNING
                || status == WorkflowStatus.COMPLETED
                || status == WorkflowStatus.CANCELLED
                || status == WorkflowStatus.ERROR
                || status == WorkflowStatus.TERMINATED;
    }

    private boolean clearsConfirmation(WorkflowStatus status) {
        return status == WorkflowStatus.SECURE_INPUT_REQUIRED
                || status == WorkflowStatus.RISK_WARNING
                || status == WorkflowStatus.COMPLETED
                || status == WorkflowStatus.CANCELLED
                || status == WorkflowStatus.ERROR
                || status == WorkflowStatus.TERMINATED;
    }

    private static final class SessionUiState {
        private final AtomicLong sequence = new AtomicLong();
        private AutomationUiEvent state;
        private AutomationUiEvent guide;
        private AutomationUiEvent target;
        private AutomationUiEvent decision;
        private AutomationUiEvent secureInput;
        private AutomationUiEvent confirmation;

        private synchronized AutomationUiEvent next(
                String sessionId, AutomationUiEventType type,
                WorkflowStatus status, String message,
                boolean actionRequired, AutomationTarget targetValue,
                AutomationDecisionPrompt decisionValue,
                SecureInputRequest secureInputValue,
                ConfirmationEventPayload confirmationValue
        ) {
            long next = sequence.incrementAndGet();
            AutomationUiEvent event = new AutomationUiEvent(
                    "evt-" + UUID.randomUUID(), next, type, sessionId,
                    status, message, actionRequired, targetValue, decisionValue,
                    secureInputValue, confirmationValue,
                    java.time.Instant.now());
            switch (type) {
                case STATE -> state = event;
                case GUIDE -> guide = event;
                case TARGET -> target = event;
                case TARGET_CLEAR -> target = null;
                case DECISION_REQUIRED -> decision = event;
                case DECISION_RESOLVED -> decision = null;
                case DECISION_CLEAR -> decision = null;
                case SECURE_INPUT_REQUIRED -> secureInput = event;
                case SECURE_INPUT_RESOLVED, SECURE_INPUT_CLEAR -> secureInput = null;
                case CONFIRMATION_REQUIRED -> confirmation = event;
                case CONFIRMATION_RESOLVED, CONFIRMATION_REJECTED,
                     CONFIRMATION_CLEAR -> confirmation = null;
            }
            return event;
        }

        private synchronized AutomationUiEventSnapshot snapshot(String sessionId) {
            return new AutomationUiEventSnapshot(
                    sessionId, sequence.get(), state, guide, target, decision,
                    secureInput, confirmation);
        }
    }
}
