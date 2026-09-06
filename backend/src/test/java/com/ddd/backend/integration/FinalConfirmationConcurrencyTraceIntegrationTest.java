package com.ddd.backend.integration;

import com.ddd.backend.api.dto.session.ConfirmationActionResponse;
import com.ddd.backend.api.dto.session.SubmitConfirmationRequest;
import com.ddd.backend.automation.BrowserActionExecutionResult;
import com.ddd.backend.automation.BrowserActionType;
import com.ddd.backend.automation.session.BrowserSessionManager;
import com.ddd.backend.common.exception.ErrorCode;
import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.domain.session.AutomationSessionRepository;
import com.ddd.backend.domain.session.ConfirmationType;
import com.ddd.backend.domain.session.WorkflowStatus;
import com.ddd.backend.frame.BrowserFrameStore;
import com.ddd.backend.security.capture.CapturedBrowserFrame;
import com.ddd.backend.service.BrowserActionExecutionService;
import com.ddd.backend.service.UserDecisionService;
import com.ddd.backend.service.confirmation.ConfirmationException;
import com.ddd.backend.service.confirmation.FinalConfirmationRequest;
import com.ddd.backend.service.confirmation.FinalConfirmationStore;
import com.ddd.backend.service.confirmation.FinalConfirmationSummary;
import com.ddd.backend.support.ConfirmationSessionTraceHarness;
import com.ddd.backend.websocket.dto.AutomationUiEvent;
import com.ddd.backend.websocket.publisher.AutomationStatusEventPublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.RepeatedTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.atMostOnce;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@SpringBootTest(properties = {
        "ddd.session-store.type=memory",
        "ddd.final-confirmation.timeout=30s"
})
class FinalConfirmationConcurrencyTraceIntegrationTest {
    @Autowired private AutomationSessionRepository sessionRepository;
    @Autowired private UserDecisionService userDecisionService;
    @Autowired private FinalConfirmationStore confirmationStore;
    @Autowired private BrowserFrameStore frameStore;
    @Autowired private AutomationStatusEventPublisher eventPublisher;

    @MockitoBean private BrowserActionExecutionService actionExecutionService;
    @MockitoBean private BrowserSessionManager browserSessionManager;
    @MockitoBean private SimpMessagingTemplate messagingTemplate;

    private List<AutomationUiEvent> events;

    @BeforeEach
    void setUp() {
        reset(actionExecutionService, browserSessionManager, messagingTemplate);
        events = new CopyOnWriteArrayList<>();
        doAnswer(invocation -> {
            Object payload = invocation.getArgument(1);
            if (payload instanceof AutomationUiEvent event) {
                events.add(event);
            }
            return null;
        }).when(messagingTemplate).convertAndSend(anyString(), any(Object.class));
    }

    @RepeatedTest(20)
    void approve와_reject가_동시에_도착해도_하나만_수락한다() throws Exception {
        Fixture fixture = fixture("parallel");
        when(actionExecutionService.executeConfirmedFinalClick(
                fixture.sessionId(), "el-final"))
                .thenReturn(BrowserActionExecutionResult.executed(BrowserActionType.CLICK));
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);

        try (var executor = Executors.newFixedThreadPool(2)) {
            var approve = executor.submit(() -> concurrentDecision(ready, start, () ->
                    userDecisionService.confirmFinalActionAck(fixture.sessionId(),
                            request("req-approve", fixture, true))));
            var reject = executor.submit(() -> concurrentDecision(ready, start, () ->
                    userDecisionService.rejectFinalActionAck(fixture.sessionId(),
                            request("req-reject", fixture, false))));
            assertThat(ready.await(3, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            List<Result> results = List.of(approve.get(5, TimeUnit.SECONDS),
                    reject.get(5, TimeUnit.SECONDS));
            assertThat(results).filteredOn(Result::accepted).hasSize(1);
            assertThat(results).filteredOn(result -> !result.accepted()).hasSize(1)
                    .allSatisfy(result -> assertThat(result.errorCode()).isIn(
                            ErrorCode.CONFIRMATION_NOT_FOUND,
                            ErrorCode.CONFIRMATION_REQUEST_IN_PROGRESS,
                            ErrorCode.CONFIRMATION_WORKFLOW_CONFLICT));
        }

        verify(actionExecutionService, atMostOnce()).executeConfirmedFinalClick(
                fixture.sessionId(), "el-final");
        assertThat(confirmationStore.active(fixture.sessionId())).isEmpty();
        assertThat(eventPublisher.latestSnapshot(fixture.sessionId()).orElseThrow()
                .confirmation()).isNull();
    }

    @Test
    void 승인_trace는_source_frame부터_resolved_clear와_새_frame까지_연결된다() {
        Fixture fixture = fixture("trace");
        when(actionExecutionService.executeConfirmedFinalClick(
                fixture.sessionId(), "el-final")).thenAnswer(invocation -> {
            frameStore.publishAfterAction(fixture.sessionId(),
                    frame(new byte[]{9, 9, 9}));
            AutomationSession session = sessionRepository.findById(
                    fixture.sessionId()).orElseThrow();
            session.transitionTo(WorkflowStatus.PAGE_LOADING);
            sessionRepository.save(session);
            eventPublisher.publish(fixture.sessionId(), WorkflowStatus.PAGE_LOADING,
                    "변경된 화면을 안전하게 확인하고 있습니다.");
            return BrowserActionExecutionResult.executed(BrowserActionType.CLICK);
        });

        ConfirmationActionResponse response = userDecisionService.confirmFinalActionAck(
                fixture.sessionId(), request("req-trace", fixture, true));

        assertThat(response.status())
                .isEqualTo(ConfirmationActionResponse.Status.APPROVAL_ACCEPTED);
        verify(actionExecutionService).executeConfirmedFinalClick(
                fixture.sessionId(), "el-final");
        new ConfirmationSessionTraceHarness(
                fixture.sessionId(), events,
                eventPublisher.latestSnapshot(fixture.sessionId()).orElseThrow(),
                fixture.sourceFrame().metadata(),
                frameStore.latest(fixture.sessionId()).orElseThrow().metadata())
                .assertApprovedTrace(fixture.confirmation().confirmationId());
    }

    private Fixture fixture(String suffix) {
        AutomationSession session = AutomationSession.create("D28 confirmation " + suffix);
        session.transitionTo(WorkflowStatus.FINAL_CONFIRMATION_REQUIRED);
        sessionRepository.save(session);
        var sourceFrame = frameStore.publish(session.getSessionId(), frame(new byte[]{1, 2, 3}));
        FinalConfirmationRequest confirmation = confirmationStore.activate(
                session.getSessionId(), ConfirmationType.DEPOSIT_SUBSCRIPTION,
                "el-final", "snap-d28", sourceFrame.metadata().frameId(),
                sourceFrame.metadata().sequence(),
                new FinalConfirmationSummary("12개월 정기예금", "12개월", "1,000,000원"));
        eventPublisher.publishConfirmationRequired(session.getSessionId(), confirmation);
        return new Fixture(session.getSessionId(), sourceFrame, confirmation);
    }

    private SubmitConfirmationRequest request(
            String requestId, Fixture fixture, boolean approved
    ) {
        return new SubmitConfirmationRequest(requestId,
                fixture.confirmation().confirmationId(), approved,
                fixture.sourceFrame().metadata().frameId(),
                fixture.sourceFrame().metadata().sequence());
    }

    private Result concurrentDecision(
            CountDownLatch ready, CountDownLatch start, Decision decision
    ) throws InterruptedException {
        ready.countDown();
        if (!start.await(3, TimeUnit.SECONDS)) {
            throw new AssertionError("동시 요청 시작 gate가 열리지 않았습니다.");
        }
        try {
            return new Result(true, null, decision.execute());
        } catch (ConfirmationException exception) {
            return new Result(false, exception.getErrorCode(), null);
        }
    }

    private CapturedBrowserFrame frame(byte[] bytes) {
        return new CapturedBrowserFrame(bytes, 1280, 720, "image/png");
    }

    @FunctionalInterface
    private interface Decision {
        ConfirmationActionResponse execute();
    }

    private record Fixture(
            String sessionId,
            com.ddd.backend.frame.BrowserFramePayload sourceFrame,
            FinalConfirmationRequest confirmation
    ) { }

    private record Result(
            boolean accepted,
            ErrorCode errorCode,
            ConfirmationActionResponse response
    ) { }
}
