package com.ddd.backend.service;

import com.ddd.backend.automation.session.BrowserSessionManager;
import com.ddd.backend.common.exception.SessionNotFoundException;
import com.ddd.backend.common.exception.UserDecisionResumeException;
import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.domain.session.AutomationSessionRepository;
import com.ddd.backend.domain.session.DecisionType;
import com.ddd.backend.domain.session.WorkflowStatus;
import com.ddd.backend.service.validation.UserDecisionValidator;
import com.ddd.backend.websocket.publisher.AutomationStatusEventPublisher;
import com.ddd.backend.api.dto.session.SubmitDecisionRequest;
import com.ddd.backend.api.dto.session.SubmitConfirmationRequest;
import com.ddd.backend.api.dto.session.ConfirmationActionResponse;
import com.ddd.backend.common.exception.ErrorCode;
import com.ddd.backend.service.confirmation.ConfirmationException;
import com.ddd.backend.service.confirmation.FinalConfirmationRequest;
import com.ddd.backend.frame.BrowserFrameMetadata;
import com.ddd.backend.frame.BrowserFrameStore;
import com.ddd.backend.service.decision.UserDecisionSessionState;
import com.ddd.backend.service.decision.SelectedDepositProductStore;
import org.springframework.beans.factory.annotation.Autowired;
import com.ddd.backend.ai.AiDecisionExecutionService;
import com.ddd.backend.ai.AgentLoopService;
import com.ddd.backend.automation.BrowserActionExecutionStatus;
import com.ddd.backend.automation.dom.ElementLocatorResolver;
import com.ddd.backend.websocket.dto.AutomationDecisionPrompt;
import org.springframework.stereotype.Service;
import com.ddd.backend.service.confirmation.FinalConfirmationStore;

import java.util.List;

@Service
public class UserDecisionService {

    private static final int MAX_CONFIRMATION_ID_LENGTH = 100;

    private final AutomationSessionRepository sessionRepository;
    private final UserDecisionValidator decisionValidator;
    private final BrowserSessionManager browserSessionManager;
    private final AutomationStatusEventPublisher statusEventPublisher;
    private final UserDecisionSessionState decisionState;
    private final BrowserFrameStore frameStore;
    private final BrowserActionExecutionService actionExecutionService;
    private final AiDecisionExecutionService aiDecisionExecutionService;
    private final ElementLocatorResolver locatorResolver;
    private final AgentLoopService agentLoopService;
    private final SelectedDepositProductStore selectedProductStore;
    private FinalConfirmationStore finalConfirmationStore;

    @Autowired
    void setFinalConfirmationStore(FinalConfirmationStore store) {
        this.finalConfirmationStore = store;
    }

    @Autowired
    public UserDecisionService(
            AutomationSessionRepository sessionRepository,
            UserDecisionValidator decisionValidator,
            BrowserSessionManager browserSessionManager,
            AutomationStatusEventPublisher statusEventPublisher,
            UserDecisionSessionState decisionState,
            BrowserFrameStore frameStore,
            BrowserActionExecutionService actionExecutionService,
            AiDecisionExecutionService aiDecisionExecutionService,
            ElementLocatorResolver locatorResolver,
            AgentLoopService agentLoopService,
            SelectedDepositProductStore selectedProductStore
    ) {
        this.sessionRepository = sessionRepository;
        this.decisionValidator = decisionValidator;
        this.browserSessionManager = browserSessionManager;
        this.statusEventPublisher = statusEventPublisher;
        this.decisionState = decisionState;
        this.frameStore = frameStore;
        this.actionExecutionService = actionExecutionService;
        this.aiDecisionExecutionService = aiDecisionExecutionService;
        this.locatorResolver = locatorResolver;
        this.agentLoopService = agentLoopService;
        this.selectedProductStore = selectedProductStore;
    }

    public UserDecisionService(
            AutomationSessionRepository sessionRepository,
            UserDecisionValidator decisionValidator,
            BrowserSessionManager browserSessionManager,
            AutomationStatusEventPublisher statusEventPublisher,
            UserDecisionSessionState decisionState,
            BrowserFrameStore frameStore,
            BrowserActionExecutionService actionExecutionService,
            AiDecisionExecutionService aiDecisionExecutionService,
            ElementLocatorResolver locatorResolver,
            AgentLoopService agentLoopService
    ) {
        this(sessionRepository, decisionValidator, browserSessionManager,
                statusEventPublisher, decisionState, frameStore,
                actionExecutionService, aiDecisionExecutionService,
                locatorResolver, agentLoopService, null);
    }

    public UserDecisionService(
            AutomationSessionRepository sessionRepository,
            UserDecisionValidator decisionValidator,
            BrowserSessionManager browserSessionManager,
            AutomationStatusEventPublisher statusEventPublisher,
            UserDecisionSessionState decisionState,
            BrowserFrameStore frameStore,
            BrowserActionExecutionService actionExecutionService,
            AiDecisionExecutionService aiDecisionExecutionService,
            ElementLocatorResolver locatorResolver
    ) {
        this(sessionRepository, decisionValidator, browserSessionManager,
                statusEventPublisher, decisionState, frameStore,
                actionExecutionService, aiDecisionExecutionService, locatorResolver,
                null, null);
    }

    public UserDecisionService(
            AutomationSessionRepository sessionRepository,
            UserDecisionValidator decisionValidator,
            BrowserSessionManager browserSessionManager,
            AutomationStatusEventPublisher statusEventPublisher,
            UserDecisionSessionState decisionState,
            BrowserFrameStore frameStore,
            BrowserActionExecutionService actionExecutionService,
            AiDecisionExecutionService aiDecisionExecutionService
    ) {
        this(sessionRepository, decisionValidator, browserSessionManager,
                statusEventPublisher, decisionState, frameStore,
                actionExecutionService, aiDecisionExecutionService, null, null);
    }

    public UserDecisionService(
            AutomationSessionRepository sessionRepository,
            UserDecisionValidator decisionValidator,
            BrowserSessionManager browserSessionManager,
            AutomationStatusEventPublisher statusEventPublisher,
            UserDecisionSessionState decisionState,
            BrowserFrameStore frameStore
    ) {
        this(sessionRepository, decisionValidator, browserSessionManager,
                statusEventPublisher, decisionState, frameStore, null, null, null,
                null, null);
    }

    public UserDecisionService(
            AutomationSessionRepository sessionRepository,
            UserDecisionValidator decisionValidator,
            BrowserSessionManager browserSessionManager,
            AutomationStatusEventPublisher statusEventPublisher
    ) {
        this(sessionRepository, decisionValidator, browserSessionManager,
                statusEventPublisher, null, null, null, null, null, null, null);
    }

    public AutomationSession submitDecision(
            String sessionId,
            SubmitDecisionRequest request
    ) {
        if (decisionState == null || frameStore == null) {
            return applyDecision(
                    sessionId,
                    request.decisionType(),
                    request.selectedOptionIds()
            );
        }

        BrowserFrameMetadata latest = frameStore.latest(sessionId)
                .orElseThrow(() -> new IllegalStateException(
                        "현재 Viewer Frame이 준비되지 않았습니다."
                )).metadata();
        if (!latest.frameId().equals(request.expectedFrameId())
                || latest.sequence() != request.expectedSequence()) {
            throw new IllegalStateException("오래된 Viewer Frame의 사용자 결정입니다.");
        }

        java.util.concurrent.atomic.AtomicReference<AutomationSession> saved =
                new java.util.concurrent.atomic.AtomicReference<>();
        AutomationDecisionPrompt prompt = decisionState.pendingPrompt(sessionId, request);
        try {
            decisionState.consume(sessionId, request, () -> {
                applyFinalSelection(sessionId, prompt, request.selectedOptionIds());
                saved.set(applyDecision(
                        sessionId, request.decisionType(), request.selectedOptionIds(), false));
                if (agentLoopService == null && aiDecisionExecutionService != null) {
                    aiDecisionExecutionService.execute(sessionId);
                }
            });
        } catch (RuntimeException exception) {
            restoreDecisionRequired(saved.get());
            if (saved.get() != null) {
                throw new UserDecisionResumeException(exception);
            }
            throw exception;
        }
        statusEventPublisher.publishDecisionResolved(
                sessionId,
                "사용자 결정이 처리되었습니다."
        );

        if (agentLoopService != null && !agentLoopService.resume(sessionId)) {
            restoreDecisionRequired(saved.get());
            throw new UserDecisionResumeException(
                    new IllegalStateException("Agent loop 재개를 예약할 수 없습니다."));
        }

        return saved.get();
    }

    private void restoreDecisionRequired(AutomationSession session) {
        if (session == null || session.getStatus() != WorkflowStatus.AI_EXECUTING) {
            return;
        }
        session.transitionTo(WorkflowStatus.USER_DECISION_REQUIRED);
        sessionRepository.save(session);
        statusEventPublisher.publish(session.getSessionId(),
                WorkflowStatus.USER_DECISION_REQUIRED,
                "사용자 결정 후속 처리를 다시 시도해야 합니다.");
    }

    private void applyFinalSelection(
            String sessionId,
            AutomationDecisionPrompt prompt,
            List<String> selectedOptionIds
    ) {
        if (prompt.decisionType() == DecisionType.PRODUCT_SELECTION
                && selectedProductStore != null) {
            if (selectedOptionIds.size() != 1 || locatorResolver == null) {
                throw new IllegalStateException("선택 상품 context를 확인할 수 없습니다.");
            }
            String selectedElementId = selectedOptionIds.getFirst();
            String domId = locatorResolver.withLocator(sessionId, selectedElementId,
                    locator -> locator.getAttribute("id"));
            selectedProductStore.select(sessionId, domId, prompt.sourceSnapshotId());
        }
        if (prompt.decisionType() != DecisionType.TERMS_AGREEMENT) {
            executeSelectedOptions(sessionId, selectedOptionIds);
            return;
        }
        java.util.Set<String> selected = java.util.Set.copyOf(selectedOptionIds);
        for (var option : prompt.options()) {
            if (option.disabled()) {
                continue;
            }
            boolean shouldBeChecked = selected.contains(option.id());
            if (shouldBeChecked != option.checked()) {
                executeSelectedOptions(sessionId, List.of(option.id()));
            }
        }
        if (locatorResolver != null) {
            for (var option : prompt.options()) {
                if (option.disabled()) {
                    continue;
                }
                boolean actual = locatorResolver.withLocator(
                        sessionId, option.id(), locator -> locator.isChecked());
                if (actual != selected.contains(option.id())) {
                    throw new IllegalStateException(
                            "약관 선택 상태를 안전하게 적용하지 못했습니다.");
                }
            }
        }
    }

    private void executeSelectedOptions(
            String sessionId,
            List<String> selectedOptionIds
    ) {
        if (actionExecutionService == null) {
            return;
        }

        for (String elementId : selectedOptionIds) {
            var result = actionExecutionService.executeElementClick(
                    sessionId, elementId);
            if (result.status() != BrowserActionExecutionStatus.EXECUTED) {
                throw new IllegalStateException(
                        "사용자가 선택한 항목을 안전하게 실행할 수 없습니다."
                );
            }
        }
    }

    public AutomationSession submitDecision(
            String sessionId,
            DecisionType decisionType,
            List<String> selectedOptionIds
    ) {
        return applyDecision(sessionId, decisionType, selectedOptionIds);
    }

    private AutomationSession applyDecision(
            String sessionId,
            DecisionType decisionType,
            List<String> selectedOptionIds
    ) {
        return applyDecision(sessionId, decisionType, selectedOptionIds, true);
    }

    private AutomationSession applyDecision(
            String sessionId,
            DecisionType decisionType,
            List<String> selectedOptionIds,
            boolean publishStatus
    ) {
        decisionValidator.validate(
                decisionType,
                selectedOptionIds
        );

        AutomationSession session =
                getSession(sessionId);

        validateDecisionStatus(
                session,
                decisionType
        );

        session.submitDecision();

        AutomationSession savedSession =
                sessionRepository.save(
                        session
                );

        if (publishStatus) {
            statusEventPublisher.publish(
                    savedSession.getSessionId(), savedSession.getStatus(),
                    decisionType == DecisionType.ADDITIONAL_INFORMATION
                            ? "추가 정보가 제출되었습니다."
                            : "사용자 선택이 제출되었습니다.");
        }

        return savedSession;
    }

    public AutomationSession confirmFinalAction(
            String sessionId,
            SubmitConfirmationRequest request
    ) {
        if (frameStore == null && finalConfirmationStore == null) {
            return confirmFinalAction(
                    sessionId, request.confirmationId(), request.approved());
        }
        ensureConfirmationWorkflow(getSession(sessionId));
        validateCurrentConfirmationFrame(sessionId, request);
        return confirmFinalActionResult(sessionId, request.confirmationId(),
                request.approved(), request.requestId(), request.expectedFrameId(),
                request.expectedSequence()).session();
    }

    public ConfirmationActionResponse confirmFinalActionAck(
            String sessionId, SubmitConfirmationRequest request
    ) {
        if (frameStore == null && finalConfirmationStore == null) {
            confirmFinalAction(sessionId, request.confirmationId(), request.approved());
            return new ConfirmationActionResponse(sessionId, request.requestId(),
                    request.confirmationId(), request.expectedFrameId(),
                    request.expectedSequence(),
                    ConfirmationActionResponse.Status.APPROVAL_ACCEPTED,
                    "최종 승인 요청을 처리하고 있습니다.");
        }
        ensureConfirmationWorkflow(getSession(sessionId));
        validateCurrentConfirmationFrame(sessionId, request);
        ConfirmationDecisionResult result = confirmFinalActionResult(
                sessionId, request.confirmationId(), request.approved(),
                request.requestId(), request.expectedFrameId(), request.expectedSequence());
        return acknowledgement(sessionId, request.requestId(), result.confirmation(),
                ConfirmationActionResponse.Status.APPROVAL_ACCEPTED,
                "최종 승인 요청을 처리하고 있습니다.");
    }

    public AutomationSession confirmFinalAction(
            String sessionId,
            String confirmationId,
            Boolean approved
    ) {
        return confirmFinalActionResult(sessionId, confirmationId, approved,
                "legacy-request", "legacy-frame", 1L).session();
    }

    private ConfirmationDecisionResult confirmFinalActionResult(
            String sessionId, String confirmationId, Boolean approved,
            String requestId, String expectedFrameId, long expectedSequence
    ) {
        validateConfirmationRequest(
                confirmationId,
                approved
        );

        if (!Boolean.TRUE.equals(approved)) {
            throw new IllegalArgumentException(
                    "최종 실행 승인 요청에서는 approved가 true여야 합니다."
            );
        }

        AutomationSession session =
                getSession(sessionId);

        ensureConfirmationWorkflow(session);

        if (finalConfirmationStore != null) {
            var active = finalConfirmationStore.requireActive(sessionId, confirmationId);
            var confirmation = finalConfirmationStore.consume(
                    sessionId, confirmationId, requestId,
                    expectedFrameId.equals("legacy-frame")
                            ? active.sourceFrameId()
                            : expectedFrameId,
                    expectedFrameId.equals("legacy-frame")
                            ? active.sourceFrameSequence()
                            : expectedSequence);
            if (actionExecutionService == null) {
                failConsumedConfirmation(sessionId, confirmation);
                throw new ConfirmationException(ErrorCode.CONFIRMATION_ACTION_FAILED);
            }
            session.approveFinalConfirmation();
            sessionRepository.save(session);
            com.ddd.backend.automation.BrowserActionExecutionResult result;
            try {
                result = actionExecutionService.executeConfirmedFinalClick(
                        sessionId, confirmation.confirmationTargetElementId());
            } catch (ConfirmationException exception) {
                failConsumedConfirmation(sessionId, confirmation);
                throw exception;
            } catch (RuntimeException exception) {
                failConsumedConfirmation(sessionId, confirmation);
                throw new ConfirmationException(ErrorCode.CONFIRMATION_ACTION_FAILED);
            }
            if (result.status() != BrowserActionExecutionStatus.EXECUTED) {
                failConsumedConfirmation(sessionId, confirmation);
                throw new ConfirmationException(errorFor(result.status()));
            }
            finalConfirmationStore.clear(sessionId);
            statusEventPublisher.publishConfirmationResolved(sessionId, confirmation);
            statusEventPublisher.publishConfirmationClear(sessionId, confirmation);
            return new ConfirmationDecisionResult(getSession(sessionId), confirmation);
        }

        session.approveFinalConfirmation();

        AutomationSession savedSession =
                sessionRepository.save(
                        session
                );

        statusEventPublisher.publish(
                savedSession.getSessionId(),
                savedSession.getStatus(),
                "사용자가 최종 실행을 승인했습니다."
        );

        return new ConfirmationDecisionResult(savedSession, null);
    }

    public AutomationSession rejectFinalAction(
            String sessionId,
            SubmitConfirmationRequest request
    ) {
        if (frameStore == null && finalConfirmationStore == null) {
            return rejectFinalAction(
                    sessionId, request.confirmationId(), request.approved());
        }
        ensureConfirmationWorkflow(getSession(sessionId));
        validateCurrentConfirmationFrame(sessionId, request);
        return rejectFinalActionResult(sessionId, request.confirmationId(),
                request.approved(), request.requestId(), request.expectedFrameId(),
                request.expectedSequence()).session();
    }

    public ConfirmationActionResponse rejectFinalActionAck(
            String sessionId, SubmitConfirmationRequest request
    ) {
        if (frameStore == null && finalConfirmationStore == null) {
            rejectFinalAction(sessionId, request.confirmationId(), request.approved());
            return new ConfirmationActionResponse(sessionId, request.requestId(),
                    request.confirmationId(), request.expectedFrameId(),
                    request.expectedSequence(),
                    ConfirmationActionResponse.Status.REJECTION_ACCEPTED,
                    "최종 거절 요청을 처리했습니다.");
        }
        ensureConfirmationWorkflow(getSession(sessionId));
        validateCurrentConfirmationFrame(sessionId, request);
        ConfirmationDecisionResult result = rejectFinalActionResult(
                sessionId, request.confirmationId(), request.approved(),
                request.requestId(), request.expectedFrameId(), request.expectedSequence());
        return acknowledgement(sessionId, request.requestId(), result.confirmation(),
                ConfirmationActionResponse.Status.REJECTION_ACCEPTED,
                "최종 거절 요청을 처리했습니다.");
    }

    public AutomationSession rejectFinalAction(
            String sessionId,
            String confirmationId,
            Boolean approved
    ) {
        return rejectFinalActionResult(sessionId, confirmationId, approved,
                "legacy-request", "legacy-frame", 1L).session();
    }

    private ConfirmationDecisionResult rejectFinalActionResult(
            String sessionId, String confirmationId, Boolean approved,
            String requestId, String expectedFrameId, long expectedSequence
    ) {
        validateConfirmationRequest(
                confirmationId,
                approved
        );

        if (!Boolean.FALSE.equals(approved)) {
            throw new IllegalArgumentException(
                    "최종 실행 거절 요청에서는 approved가 false여야 합니다."
            );
        }

        AutomationSession session =
                getSession(sessionId);

        ensureConfirmationWorkflow(session);

        FinalConfirmationRequest confirmation = null;
        if (finalConfirmationStore != null) {
            var active = finalConfirmationStore.requireActive(sessionId, confirmationId);
            confirmation = finalConfirmationStore.consume(sessionId, confirmationId, requestId,
                    expectedFrameId.equals("legacy-frame")
                            ? active.sourceFrameId() : expectedFrameId,
                    expectedFrameId.equals("legacy-frame")
                            ? active.sourceFrameSequence() : expectedSequence);
            finalConfirmationStore.clear(sessionId);
        }

        session.rejectFinalConfirmation();

        AutomationSession savedSession =
                sessionRepository.save(
                        session
                );

        if (browserSessionManager.exists(
                sessionId
        )) {
            browserSessionManager.closeSession(
                    sessionId
            );
        }

        if (confirmation != null) {
            statusEventPublisher.publishConfirmationRejected(sessionId, confirmation);
            statusEventPublisher.publishConfirmationClear(sessionId, confirmation);
        }
        statusEventPublisher.publish(
                savedSession.getSessionId(),
                savedSession.getStatus(),
                "최종 실행이 거절되어 세션이 취소되었습니다."
        );

        return new ConfirmationDecisionResult(savedSession, confirmation);
    }

    private void validateCurrentConfirmationFrame(
            String sessionId,
            SubmitConfirmationRequest request
    ) {
        if (frameStore == null || finalConfirmationStore == null) {
            throw new ConfirmationException(ErrorCode.CONFIRMATION_FRAME_CAPTURE_FAILED);
        }
        BrowserFrameMetadata latest = frameStore.latest(sessionId)
                .orElseThrow(() -> new ConfirmationException(
                        ErrorCode.CONFIRMATION_FRAME_CAPTURE_FAILED))
                .metadata();
        var active = finalConfirmationStore.requireActive(
                sessionId, request.confirmationId());
        boolean requestMatchesCurrent = latest.frameId().equals(request.expectedFrameId())
                && latest.sequence() == request.expectedSequence();
        boolean requestMatchesSource = active.sourceFrameId()
                .equals(request.expectedFrameId())
                && active.sourceFrameSequence() == request.expectedSequence();
        if (!requestMatchesCurrent || !requestMatchesSource) {
            throw new ConfirmationException(ErrorCode.CONFIRMATION_STALE_FRAME);
        }
    }

    private ConfirmationActionResponse acknowledgement(
            String sessionId, String requestId,
            FinalConfirmationRequest confirmation,
            ConfirmationActionResponse.Status status, String message
    ) {
        if (confirmation == null) {
            throw new ConfirmationException(ErrorCode.CONFIRMATION_NOT_FOUND);
        }
        return new ConfirmationActionResponse(sessionId, requestId,
                confirmation.confirmationId(), confirmation.sourceFrameId(),
                confirmation.sourceFrameSequence(), status, message);
    }

    private void ensureConfirmationWorkflow(AutomationSession session) {
        if (session.getStatus() != WorkflowStatus.FINAL_CONFIRMATION_REQUIRED) {
            throw new ConfirmationException(ErrorCode.CONFIRMATION_WORKFLOW_CONFLICT);
        }
    }

    private ErrorCode errorFor(BrowserActionExecutionStatus status) {
        return switch (status) {
            case NO_ACTION -> ErrorCode.CONFIRMATION_TARGET_NOT_FOUND;
            case USER_ACTION_REQUIRED -> ErrorCode.CONFIRMATION_TARGET_DISABLED;
            case BLOCKED, SECURE_INPUT_REQUIRED, FINAL_CONFIRMATION_REQUIRED ->
                    ErrorCode.CONFIRMATION_POLICY_MISMATCH;
            default -> ErrorCode.CONFIRMATION_ACTION_FAILED;
        };
    }

    private void failConsumedConfirmation(
            String sessionId, FinalConfirmationRequest confirmation
    ) {
        finalConfirmationStore.clear(sessionId);
        statusEventPublisher.publishConfirmationClear(sessionId, confirmation);
        AutomationSession session = getSession(sessionId);
        session.transitionTo(WorkflowStatus.ERROR);
        sessionRepository.save(session);
        statusEventPublisher.publish(sessionId, WorkflowStatus.ERROR,
                "최종 실행을 안전하게 완료할 수 없어 중단했습니다.");
    }

    private record ConfirmationDecisionResult(
            AutomationSession session, FinalConfirmationRequest confirmation
    ) { }

    private AutomationSession getSession(
            String sessionId
    ) {
        if (sessionId == null
                || sessionId.isBlank()) {

            throw new IllegalArgumentException(
                    "세션 ID는 비어 있을 수 없습니다."
            );
        }

        return sessionRepository
                .findById(sessionId)
                .orElseThrow(
                        () -> new SessionNotFoundException(
                                sessionId
                        )
                );
    }

    private void validateDecisionStatus(
            AutomationSession session,
            DecisionType decisionType
    ) {
        WorkflowStatus currentStatus =
                session.getStatus();

        if (decisionType
                == DecisionType.ADDITIONAL_INFORMATION) {

            if (currentStatus
                    != WorkflowStatus.ADDITIONAL_INFORMATION_REQUIRED) {

                throw new IllegalStateException(
                        "추가 정보 대기 상태에서만 추가 정보를 제출할 수 있습니다."
                );
            }

            return;
        }

        if (currentStatus
                != WorkflowStatus.USER_DECISION_REQUIRED) {

            throw new IllegalStateException(
                    "사용자 결정 대기 상태에서만 선택을 제출할 수 있습니다."
            );
        }
    }

    private void validateConfirmationRequest(
            String confirmationId,
            Boolean approved
    ) {
        if (confirmationId == null
                || confirmationId.isBlank()) {

            throw new IllegalArgumentException(
                    "최종 확인 ID는 필수입니다."
            );
        }

        if (confirmationId.trim().length()
                > MAX_CONFIRMATION_ID_LENGTH) {

            throw new IllegalArgumentException(
                    "최종 확인 ID는 100자를 초과할 수 없습니다."
            );
        }

        if (approved == null) {
            throw new IllegalArgumentException(
                    "승인 여부는 필수입니다."
            );
        }
    }
}
