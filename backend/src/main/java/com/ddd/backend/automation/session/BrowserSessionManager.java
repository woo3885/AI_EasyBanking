package com.ddd.backend.automation.session;

import com.ddd.backend.automation.worker.BrowserTask;
import com.ddd.backend.automation.worker.BrowserTaskResult;
import com.ddd.backend.automation.worker.BrowserTaskStatus;
import com.ddd.backend.automation.worker.PlaywrightWorker;
import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;

import java.net.URI;
import java.time.Duration;
import java.util.Map;
import java.util.Set;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
public class BrowserSessionManager implements AutoCloseable {

    private static final Logger log =
            LoggerFactory.getLogger(
                    BrowserSessionManager.class
            );

    /*
     * D17 Viewer 기준 해상도.
     *
     * Browser screenshot과
     * Frontend Viewer 좌표계가
     * 동일한 1280 x 720을 사용한다.
     */
    private static final int VIEWPORT_WIDTH =
            1280;

    private static final int VIEWPORT_HEIGHT =
            720;

    private static final double DEVICE_SCALE_FACTOR =
            1.0;

    private static final Duration SESSION_CREATE_TIMEOUT =
            Duration.ofSeconds(15);

    private static final Duration SESSION_CLOSE_TIMEOUT =
            Duration.ofSeconds(10);

    private static final Duration URL_READ_TIMEOUT =
            Duration.ofSeconds(5);

    /*
     * Worker 작업 제한시간.
     */
    private static final Duration NAVIGATION_TIMEOUT =
            Duration.ofSeconds(25);

    /*
     * Playwright 자체 navigation timeout.
     *
     * Worker timeout보다 짧게 둔다.
     */
    private static final double PLAYWRIGHT_NAVIGATION_TIMEOUT_MILLIS =
            20_000.0;

    private static final Duration MANAGER_CLOSE_TIMEOUT =
            Duration.ofSeconds(15);

    private static final long WAIT_MARGIN_MILLIS =
            2_000L;

    private static final String MANAGER_TASK_SESSION_ID =
            "browser-session-manager";

    private final Map<String, BrowserSession> sessions =
            new ConcurrentHashMap<>();

    private final PlaywrightWorker playwrightWorker;
    private final boolean headedSecureTakeoverEnabled;
    private final boolean headedDemoAgentBridgeEnabled;

    private final AtomicBoolean closed =
            new AtomicBoolean(false);

    /*
     * Playwright,
     * Browser,
     * BrowserContext,
     * Page는
     *
     * 반드시 PlaywrightWorker 스레드에서만 접근한다.
     */
    private Playwright playwright;
    private Browser browser;

    public BrowserSessionManager(
            PlaywrightWorker playwrightWorker
    ) {
        this(playwrightWorker, false, false);
    }

    public BrowserSessionManager(
            PlaywrightWorker playwrightWorker,
            @Value("${ddd.secure-takeover.demo-headed-enabled:false}")
            boolean headedSecureTakeoverEnabled
    ) {
        this(playwrightWorker, headedSecureTakeoverEnabled, false);
    }

    @Autowired
    public BrowserSessionManager(
            PlaywrightWorker playwrightWorker,
            @Value("${ddd.secure-takeover.demo-headed-enabled:false}")
            boolean headedSecureTakeoverEnabled,
            @Value("${ddd.demo-agent-bridge.headed-enabled:false}")
            boolean headedDemoAgentBridgeEnabled
    ) {
        this.playwrightWorker =
                Objects.requireNonNull(
                        playwrightWorker,
                        "PlaywrightWorker는 필수입니다."
                );
        this.headedSecureTakeoverEnabled = headedSecureTakeoverEnabled;
        this.headedDemoAgentBridgeEnabled = headedDemoAgentBridgeEnabled;
    }

    /*
     * 새로운 BrowserSession 생성.
     */
    public synchronized void createSession(
            String sessionId
    ) {
        validateSessionId(
                sessionId
        );

        ensureManagerOpen();

        if (sessions.containsKey(
                sessionId
        )) {
            throw new IllegalStateException(
                    "이미 생성된 브라우저 세션입니다."
            );
        }

        executeWorkerTask(
                sessionId,
                SESSION_CREATE_TIMEOUT,
                () -> {
                    createSessionOnWorker(
                            sessionId
                    );

                    return null;
                }
        );
    }

    /*
     * BrowserSession 존재 여부 확인.
     */
    public synchronized boolean exists(
            String sessionId
    ) {
        validateSessionId(
                sessionId
        );

        BrowserSession session =
                sessions.get(
                        sessionId
                );

        return session != null
                && !session.isClosed();
    }

    /*
     * 현재 살아 있는 BrowserSession 수.
     */
    public synchronized int activeSessionCount() {
        return (int) sessions.values()
                .stream()
                .filter(
                        session ->
                                !session.isClosed()
                )
                .count();
    }

    /*
     * D8
     *
     * 현재 BrowserSessionManager가 관리 중인
     * 세션 ID Snapshot을 반환한다.
     *
     * Scheduler가 Redis에서 만료된 세션과
     * BrowserSession을 비교할 때 사용한다.
     */
    public synchronized Set<String> activeSessionIds() {
        return Set.copyOf(
                sessions.keySet()
        );
    }

    /*
     * 현재 최신 Page의 URL 반환.
     */
    public synchronized String currentUrl(
            String sessionId
    ) {
        return execute(
                sessionId,
                URL_READ_TIMEOUT,
                Page::url
        );
    }

    /*
     * D17 세션 시작 시
     * Demo Bank 실제 페이지로 이동한다.
     *
     * URL 보안 검증 자체는
     * DemoNavigationPolicy에서 수행한다.
     */
    public synchronized String navigate(
            String sessionId,
            URI targetUri
    ) {
        validateSessionId(
                sessionId
        );

        Objects.requireNonNull(
                targetUri,
                "탐색 대상 URI는 필수입니다."
        );

        if (!targetUri.isAbsolute()) {
            throw new IllegalArgumentException(
                    "탐색 대상 URI는 절대 URI여야 합니다."
            );
        }

        return execute(
                sessionId,
                NAVIGATION_TIMEOUT,
                page -> {
                    page.navigate(
                            targetUri.toString(),
                            new Page.NavigateOptions()
                                    .setTimeout(
                                            PLAYWRIGHT_NAVIGATION_TIMEOUT_MILLIS
                                    )
                    );

                    /*
                     * redirect까지 완료된 뒤
                     * 실제 현재 URL을 반환한다.
                     *
                     * AutomationSessionService에서
                     * DemoNavigationPolicy를 이용해
                     * 다시 검증한다.
                     */
                    return page.url();
                }
        );
    }

    /*
     * Browser 작업 실행.
     *
     * 반드시 현재 최신 Page를 사용한다.
     */
    public synchronized <T> T execute(
            String sessionId,
            Duration timeout,
            BrowserCommand<T> command
    ) {
        validateSessionId(
                sessionId
        );

        validateTimeout(
                timeout
        );

        ensureManagerOpen();

        Objects.requireNonNull(
                command,
                "브라우저 명령은 필수입니다."
        );

        if (!exists(
                sessionId
        )) {
            throw new IllegalArgumentException(
                    "브라우저 세션을 찾을 수 없습니다."
            );
        }

        return executeWorkerTask(
                sessionId,
                timeout,
                () -> {
                    BrowserSession session =
                            getRequiredSessionOnWorker(
                                    sessionId
                            );

                    /*
                     * D10:
                     *
                     * 최초 Page가 아니라
                     * popup / 새 탭까지 반영된
                     * currentPage를 사용한다.
                     */
                    return command.execute(
                            session.currentPage()
                    );
                }
        );
    }

    /*
     * 개별 BrowserSession 종료.
     */
    public synchronized void closeSession(
            String sessionId
    ) {
        validateSessionId(
                sessionId
        );

        ensureManagerOpen();

        if (!exists(
                sessionId
        )) {
            throw new IllegalArgumentException(
                    "브라우저 세션을 찾을 수 없습니다."
            );
        }

        executeWorkerTask(
                sessionId,
                SESSION_CLOSE_TIMEOUT,
                () -> {
                    closeSessionOnWorker(
                            sessionId
                    );

                    return null;
                }
        );
    }

    /*
     * 실제 BrowserContext/Page 생성.
     *
     * 반드시 PlaywrightWorker에서 실행된다.
     */
    private void createSessionOnWorker(
            String sessionId
    ) {
        /*
         * 실제 생성 직전에도
         * 중복 여부를 다시 확인한다.
         */
        if (sessions.containsKey(
                sessionId
        )) {
            throw new IllegalStateException(
                    "이미 생성된 브라우저 세션입니다."
            );
        }

        ensureBrowserStartedOnWorker();

        /*
         * D17 Viewer의 기준 좌표계.
         *
         * 모든 Session BrowserContext를
         * 1280 x 720 / DPR 1로 고정한다.
         */
        BrowserContext context =
                browser.newContext(
                        new Browser.NewContextOptions()
                                .setViewportSize(
                                        VIEWPORT_WIDTH,
                                        VIEWPORT_HEIGHT
                                )
                                .setDeviceScaleFactor(
                                        DEVICE_SCALE_FACTOR
                                )
                );

        try {
            Page page =
                    context.newPage();

            BrowserSession browserSession =
                    new BrowserSession(
                            sessionId,
                            context,
                            page
                    );

            sessions.put(
                    sessionId,
                    browserSession
            );

        } catch (RuntimeException exception) {

            /*
             * Page 또는 BrowserSession 생성에
             * 실패하면 Context를 남기지 않는다.
             */
            context.close();

            throw exception;
        }
    }

    /*
     * Worker 안에서 BrowserSession 조회.
     */
    private BrowserSession getRequiredSessionOnWorker(
            String sessionId
    ) {
        BrowserSession session =
                sessions.get(
                        sessionId
                );

        if (session == null
                || session.isClosed()) {

            throw new IllegalArgumentException(
                    "브라우저 세션을 찾을 수 없습니다."
            );
        }

        return session;
    }

    /*
     * Worker 안에서 Session 종료.
     */
    private void closeSessionOnWorker(
            String sessionId
    ) {
        BrowserSession session =
                sessions.remove(
                        sessionId
                );

        if (session == null
                || session.isClosed()) {

            throw new IllegalArgumentException(
                    "브라우저 세션을 찾을 수 없습니다."
            );
        }

        session.close();
    }

    /*
     * Chromium이 아직 없다면 시작한다.
     */
    private void ensureBrowserStartedOnWorker() {
        if (browser != null
                && browser.isConnected()) {

            return;
        }

        if (playwright == null) {
            playwright =
                    Playwright.create();
        }

        try {
            browser =
                    playwright
                            .chromium()
                            .launch(
                                    new BrowserType.LaunchOptions()
                                            .setHeadless(
                                                    !(headedSecureTakeoverEnabled
                                                            || headedDemoAgentBridgeEnabled)
                                            )
                            );

        } catch (RuntimeException exception) {

            closePlaywrightAfterLaunchFailure();

            throw exception;
        }
    }

    /*
     * Chromium 시작 실패 시
     * Playwright까지 정리한다.
     */
    private void closePlaywrightAfterLaunchFailure() {
        if (playwright != null) {

            try {
                playwright.close();

            } catch (RuntimeException closeException) {

                log.warn(
                        "Playwright cleanup failed. "
                                + "exceptionType={}",
                        closeException
                                .getClass()
                                .getSimpleName()
                );
            }
        }

        playwright = null;
        browser = null;
    }

    /*
     * PlaywrightWorker에 실제 작업 제출.
     */
    private <T> T executeWorkerTask(
            String sessionId,
            Duration timeout,
            BrowserTaskCommand<T> command
    ) {
        BrowserTask<T> task =
                BrowserTask.create(
                        sessionId,
                        timeout,
                        command::execute
                );

        CompletableFuture<BrowserTaskResult<T>> future =
                playwrightWorker.submit(
                        task
                );

        BrowserTaskResult<T> result =
                waitForResult(
                        task,
                        future
                );

        return unwrapResult(
                result
        );
    }

    /*
     * Worker 결과 대기.
     */
    private <T> BrowserTaskResult<T> waitForResult(
            BrowserTask<T> task,
            CompletableFuture<BrowserTaskResult<T>> future
    ) {
        long waitMillis =
                task.getTimeout()
                        .toMillis()
                        + WAIT_MARGIN_MILLIS;

        try {
            return future.get(
                    waitMillis,
                    TimeUnit.MILLISECONDS
            );

        } catch (InterruptedException exception) {

            Thread.currentThread()
                    .interrupt();

            throw new IllegalStateException(
                    "브라우저 작업 대기 중 중단되었습니다."
            );

        } catch (TimeoutException exception) {

            throw new IllegalStateException(
                    "Playwright Worker 응답 제한시간을 "
                            + "초과했습니다."
            );

        } catch (ExecutionException exception) {

            throw new IllegalStateException(
                    "Playwright Worker 작업 처리에 "
                            + "실패했습니다."
            );
        }
    }

    /*
     * BrowserTaskResult를
     * 실제 반환값 또는 예외로 변환한다.
     */
    private <T> T unwrapResult(
            BrowserTaskResult<T> result
    ) {
        if (result.status()
                == BrowserTaskStatus.SUCCESS) {

            return result.data();
        }

        String safeMessage =
                result.message();

        if (safeMessage == null
                || safeMessage.isBlank()) {

            safeMessage =
                    "브라우저 작업 처리에 실패했습니다.";
        }

        if (result.status()
                == BrowserTaskStatus.TIMED_OUT) {

            throw new IllegalStateException(
                    safeMessage
            );
        }

        if (result.status()
                == BrowserTaskStatus.CANCELLED) {

            throw new IllegalStateException(
                    safeMessage
            );
        }

        throw new IllegalStateException(
                safeMessage
        );
    }

    private void ensureManagerOpen() {
        if (closed.get()) {

            throw new IllegalStateException(
                    "종료된 브라우저 세션 관리자입니다."
            );
        }
    }

    private void validateSessionId(
            String sessionId
    ) {
        if (sessionId == null
                || sessionId.isBlank()) {

            throw new IllegalArgumentException(
                    "브라우저 세션 ID는 "
                            + "비어 있을 수 없습니다."
            );
        }
    }

    private void validateTimeout(
            Duration timeout
    ) {
        if (timeout == null
                || timeout.isZero()
                || timeout.isNegative()) {

            throw new IllegalArgumentException(
                    "브라우저 명령 제한시간은 "
                            + "0보다 커야 합니다."
            );
        }
    }

    /*
     * Spring 종료 시 전체 Playwright 리소스 정리.
     */
    @PreDestroy
    @Override
    public synchronized void close() {
        if (!closed.compareAndSet(
                false,
                true
        )) {
            return;
        }

        try {
            BrowserTask<Void> task =
                    BrowserTask.create(
                            MANAGER_TASK_SESSION_ID,
                            MANAGER_CLOSE_TIMEOUT,
                            () -> {
                                closeResourcesOnWorker();

                                return null;
                            }
                    );

            BrowserTaskResult<Void> result =
                    waitForResult(
                            task,
                            playwrightWorker.submit(
                                    task
                            )
                    );

            if (result.status()
                    != BrowserTaskStatus.SUCCESS) {

                log.warn(
                        "Browser manager close failed. "
                                + "status={}",
                        result.status()
                );
            }

        } catch (RuntimeException exception) {

            log.warn(
                    "Browser manager close failed. "
                            + "exceptionType={}",
                    exception
                            .getClass()
                            .getSimpleName()
            );
        }
    }

    /*
     * 전체 BrowserSession,
     * Browser,
     * Playwright 정리.
     *
     * 반드시 Worker에서 실행된다.
     */
    private void closeResourcesOnWorker() {

        for (BrowserSession session :
                sessions.values()) {

            try {
                session.close();

            } catch (RuntimeException exception) {

                log.warn(
                        "Browser session close failed. "
                                + "exceptionType={}",
                        exception
                                .getClass()
                                .getSimpleName()
                );
            }
        }

        sessions.clear();

        if (browser != null) {

            try {
                browser.close();

            } catch (RuntimeException exception) {

                log.warn(
                        "Browser close failed. "
                                + "exceptionType={}",
                        exception
                                .getClass()
                                .getSimpleName()
                );

            } finally {
                browser = null;
            }
        }

        if (playwright != null) {

            try {
                playwright.close();

            } catch (RuntimeException exception) {

                log.warn(
                        "Playwright close failed. "
                                + "exceptionType={}",
                        exception
                                .getClass()
                                .getSimpleName()
                );

            } finally {
                playwright = null;
            }
        }
    }

    /*
     * Worker에서 실행될 내부 명령.
     */
    @FunctionalInterface
    private interface BrowserTaskCommand<T> {

        T execute() throws Exception;
    }
}
