package com.ddd.backend.ai;

import com.ddd.backend.automation.BrowserActionExecutionStatus;
import com.ddd.backend.automation.BrowserActionType;
import com.ddd.backend.automation.session.BrowserSessionManager;
import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.domain.session.WorkflowStatus;
import com.ddd.backend.infrastructure.session.InMemoryAutomationSessionRepository;
import com.ddd.backend.security.capture.FrameCaptureDecision;
import com.ddd.backend.security.capture.FrameCaptureGuard;
import com.ddd.backend.websocket.publisher.AutomationStatusEventPublisher;
import com.ddd.backend.frame.BrowserFrameStore;
import com.ddd.backend.security.capture.CapturedBrowserFrame;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.concurrent.atomic.AtomicInteger;
import java.time.Duration;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.times;

class AgentLoopServiceTest {

    private InMemoryAutomationSessionRepository repository;
    private AiDecisionExecutionService executionService;
    private FrameCaptureGuard captureGuard;
    private BrowserSessionManager browserSessionManager;
    private DepositScreenInspector screenInspector;
    private AgentLoopService loop;
    private String sessionId;

    @BeforeEach
    void setUp() {
        repository = new InMemoryAutomationSessionRepository();
        AutomationSession session = AutomationSession.create(
                "100만 원을 12개월 정기예금 상품에 가입하고 싶다");
        repository.save(session);
        sessionId = session.getSessionId();
        executionService = mock(AiDecisionExecutionService.class);
        captureGuard = mock(FrameCaptureGuard.class);
        browserSessionManager = mock(BrowserSessionManager.class);
        screenInspector = mock(DepositScreenInspector.class);
        when(browserSessionManager.currentUrl(sessionId))
                .thenReturn("http://127.0.0.1:5190/deposit/products");
        when(captureGuard.evaluate(sessionId)).thenReturn(FrameCaptureDecision.ALLOW);
        when(screenInspector.inspect(sessionId)).thenReturn(
                new DepositScreenInspector.Inspection(
                        DepositPageClassifier.DepositPage.PRODUCT_LIST, true));
        loop = new AgentLoopService(repository, executionService, captureGuard,
                mock(AutomationStatusEventPublisher.class), screenInspector);
    }

    @AfterEach
    void tearDown() {
        loop.close();
    }

    @Test
    void secure_input은_Snapshot_AI_Action_이전에_중단한다() {
        when(captureGuard.evaluate(sessionId))
                .thenReturn(FrameCaptureDecision.SECURE_INPUT_BLOCKED);
        when(browserSessionManager.currentUrl(sessionId)).thenReturn(
                "http://127.0.0.1:5190/deposit/secure/password/deposit-12m");
        when(screenInspector.inspect(sessionId)).thenReturn(
                new DepositScreenInspector.Inspection(
                        DepositPageClassifier.DepositPage.SECURE_PASSWORD, true));

        loop.runNowForTest(sessionId);

        assertEquals(WorkflowStatus.SECURE_INPUT_REQUIRED,
                repository.findById(sessionId).orElseThrow().getStatus());
        verify(executionService, never()).execute(anyString());
    }

    @Test
    void 같은_세션의_최초_AI는_동시에_한번만_예약한다() throws Exception {
        CountDownLatch entered = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        when(executionService.execute(sessionId)).thenAnswer(ignored -> {
            entered.countDown();
            assertTrue(release.await(2, TimeUnit.SECONDS));
            AutomationSession session = repository.findById(sessionId).orElseThrow();
            session.transitionTo(WorkflowStatus.USER_DECISION_REQUIRED);
            repository.save(session);
            return new AiDecisionExecutionResult("snap-once",
                    BrowserActionType.WAIT_FOR_USER,
                    BrowserActionType.WAIT_FOR_USER,
                    BrowserActionExecutionStatus.USER_ACTION_REQUIRED,
                    "사용자 선택", "decision-once");
        });

        assertTrue(loop.start(sessionId));
        assertTrue(entered.await(2, TimeUnit.SECONDS));
        assertFalse(loop.start(sessionId));
        release.countDown();

        verify(executionService, times(1)).execute(sessionId);
    }

    @Test
    void 자동_금융_Action_실패는_retry하지_않는다() {
        when(executionService.execute(sessionId))
                .thenThrow(new IllegalStateException("action failed"));

        loop.runNowForTest(sessionId);

        verify(executionService, times(1)).execute(sessionId);
        assertEquals(WorkflowStatus.ERROR,
                repository.findById(sessionId).orElseThrow().getStatus());
    }

    @Test
    void Action후_Frame_sequence가_증가하지_않으면_다음_AI를_호출하지_않는다() {
        BrowserFrameStore frames = frameStoreWithInitialFrame();
        AgentLoopService stableLoop = new AgentLoopService(repository,
                executionService, captureGuard,
                mock(AutomationStatusEventPublisher.class), screenInspector, frames);
        when(captureGuard.evaluate(sessionId)).thenReturn(
                FrameCaptureDecision.ALLOW, FrameCaptureDecision.ALLOW);
        when(executionService.execute(sessionId)).thenReturn(executed("first"));

        stableLoop.runNowForTest(sessionId);

        assertEquals(WorkflowStatus.ERROR,
                repository.findById(sessionId).orElseThrow().getStatus());
        verify(executionService, times(1)).execute(sessionId);
        stableLoop.close();
    }

    @Test
    void Action후_secure_capture_차단은_ERROR가_아닌_secure상태로_중단한다() {
        BrowserFrameStore frames = frameStoreWithInitialFrame();
        AgentLoopService stableLoop = new AgentLoopService(repository,
                executionService, captureGuard,
                mock(AutomationStatusEventPublisher.class), screenInspector, frames);
        when(captureGuard.evaluate(sessionId)).thenReturn(
                FrameCaptureDecision.ALLOW,
                FrameCaptureDecision.SECURE_INPUT_BLOCKED);
        when(executionService.execute(sessionId)).thenReturn(executed("terms-next"));

        stableLoop.runNowForTest(sessionId);

        assertEquals(WorkflowStatus.SECURE_INPUT_REQUIRED,
                repository.findById(sessionId).orElseThrow().getStatus());
        verify(executionService, times(1)).execute(sessionId);
        stableLoop.close();
    }

    @Test
    void 최대_step을_넘기면_ERROR로_안전하게_중단한다() {
        AtomicInteger sequence = new AtomicInteger();
        when(executionService.execute(sessionId)).thenAnswer(
                ignored -> executed("action-" + sequence.incrementAndGet()));

        loop.runNowForTest(sessionId);

        assertEquals(WorkflowStatus.ERROR,
                repository.findById(sessionId).orElseThrow().getStatus());
        assertEquals(AgentLoopService.MAX_STEPS, sequence.get());
    }

    @Test
    void loop_timeout이면_AI를_호출하지_않고_ERROR로_중단한다() {
        loop.close();
        loop = new AgentLoopService(repository, executionService, captureGuard,
                mock(AutomationStatusEventPublisher.class), screenInspector,
                AgentLoopService.MAX_STEPS, Duration.ZERO);

        loop.runNowForTest(sessionId);

        assertEquals(WorkflowStatus.ERROR,
                repository.findById(sessionId).orElseThrow().getStatus());
        verify(executionService, never()).execute(anyString());
    }

    @Test
    void 실행중_AI가_timeout되면_future를_취소하고_ERROR로_중단한다() {
        loop.close();
        loop = new AgentLoopService(repository, executionService, captureGuard,
                mock(AutomationStatusEventPublisher.class), screenInspector,
                AgentLoopService.MAX_STEPS, Duration.ofMillis(100));
        when(executionService.execute(sessionId)).thenAnswer(ignored -> {
            try {
                Thread.sleep(5_000);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("interrupted");
            }
            return executed("too-late");
        });

        loop.runNowForTest(sessionId);

        assertEquals(WorkflowStatus.ERROR,
                repository.findById(sessionId).orElseThrow().getStatus());
        verify(executionService, times(1)).execute(sessionId);
    }

    @Test
    void D25_상품선택부터_약관선택후_password_보안중단까지_연속_재개한다() {
        AutomationSession session = repository.findById(sessionId).orElseThrow();
        when(screenInspector.inspect(sessionId)).thenReturn(
                inspection(DepositPageClassifier.DepositPage.PRODUCT_LIST),
                inspection(DepositPageClassifier.DepositPage.PRODUCT_DETAIL),
                inspection(DepositPageClassifier.DepositPage.CONDITIONS),
                inspection(DepositPageClassifier.DepositPage.TERMS),
                inspection(DepositPageClassifier.DepositPage.TERMS),
                inspection(DepositPageClassifier.DepositPage.SECURE_PASSWORD));
        when(captureGuard.evaluate(sessionId)).thenReturn(
                FrameCaptureDecision.ALLOW,
                FrameCaptureDecision.ALLOW,
                FrameCaptureDecision.ALLOW,
                FrameCaptureDecision.ALLOW,
                FrameCaptureDecision.ALLOW,
                FrameCaptureDecision.SECURE_INPUT_BLOCKED);
        AtomicInteger aiStep = new AtomicInteger();
        when(executionService.execute(sessionId)).thenAnswer(ignored -> {
            int step = aiStep.incrementAndGet();
            if (step == 1 || step == 4) {
                session.transitionTo(WorkflowStatus.USER_DECISION_REQUIRED);
                repository.save(session);
                return new AiDecisionExecutionResult("snap-" + step,
                        BrowserActionType.WAIT_FOR_USER,
                        BrowserActionType.WAIT_FOR_USER,
                        BrowserActionExecutionStatus.USER_ACTION_REQUIRED,
                        "사용자 선택", "decision-" + step);
            }
            return executed("action-" + step);
        });

        // 최초 상품 decision에서 중단한다.
        loop.runNowForTest(sessionId);
        assertEquals(WorkflowStatus.USER_DECISION_REQUIRED, session.getStatus());

        // 상품 제출 후 상세→가입 금액→약관 decision까지 재개한다.
        session.submitDecision();
        repository.save(session);
        loop.runNowForTest(sessionId);
        assertEquals(WorkflowStatus.USER_DECISION_REQUIRED, session.getStatus());

        // 약관 제출 후 다음 버튼을 실행하고 password 화면에서 즉시 중단한다.
        session.submitDecision();
        repository.save(session);
        loop.runNowForTest(sessionId);

        assertEquals(WorkflowStatus.SECURE_INPUT_REQUIRED, session.getStatus());
        assertEquals(5, aiStep.get());
        verify(executionService, times(5)).execute(sessionId);
    }

    private DepositScreenInspector.Inspection inspection(
            DepositPageClassifier.DepositPage page
    ) {
        return new DepositScreenInspector.Inspection(page, true);
    }

    private AiDecisionExecutionResult executed(String key) {
        return new AiDecisionExecutionResult("snap-test", BrowserActionType.CLICK,
                BrowserActionType.CLICK, BrowserActionExecutionStatus.EXECUTED,
                "실행", key);
    }

    private BrowserFrameStore frameStoreWithInitialFrame() {
        BrowserFrameStore frames = new BrowserFrameStore();
        frames.publish(sessionId, new CapturedBrowserFrame(
                new byte[]{1, 2, 3}, 1280, 720, "image/png"));
        return frames;
    }
}
