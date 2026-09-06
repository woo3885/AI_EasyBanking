package com.ddd.backend.automation.session;

import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.Page;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Collections;
import java.util.Deque;
import java.util.IdentityHashMap;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;

public final class BrowserSession implements AutoCloseable {

    private final String sessionId;
    private final BrowserContext browserContext;

    /*
     * 같은 BrowserContext 안에서 생성된 Page를 추적한다.
     *
     * Playwright 객체는 반드시 PlaywrightWorker
     * 스레드에서만 접근한다.
     */
    private final Deque<Page> openedPages;
    private final Set<Page> trackedPages;

    /*
     * 최초 Page가 아니라 현재 사용해야 하는 최신 Page.
     *
     * 팝업/새 탭이 생성되면 최신 Page로 변경되고,
     * 현재 Page가 닫히면 이전 Page로 복귀한다.
     */
    private Page currentPage;

    private final Instant createdAt;
    private final AtomicBoolean closed;

    public BrowserSession(
            String sessionId,
            BrowserContext browserContext,
            Page initialPage
    ) {
        if (sessionId == null
                || sessionId.isBlank()) {

            throw new IllegalArgumentException(
                    "브라우저 세션 ID는 비어 있을 수 없습니다."
            );
        }

        this.sessionId =
                sessionId;

        this.browserContext =
                Objects.requireNonNull(
                        browserContext,
                        "BrowserContext는 필수입니다."
                );

        Objects.requireNonNull(
                initialPage,
                "초기 Page는 필수입니다."
        );

        this.openedPages =
                new ArrayDeque<>();

        /*
         * Page 객체 자체의 identity를 기준으로 관리한다.
         */
        this.trackedPages =
                Collections.newSetFromMap(
                        new IdentityHashMap<>()
                );

        this.createdAt =
                Instant.now();

        this.closed =
                new AtomicBoolean(false);

        /*
         * 최초 Page를 먼저 등록한다.
         */
        registerPage(
                initialPage
        );

        /*
         * 이후 BrowserContext에서 새로 만들어지는
         * Page(새 탭/팝업)를 모두 추적한다.
         */
        this.browserContext.onPage(
                this::registerPage
        );
    }

    public String sessionId() {
        return sessionId;
    }

    BrowserContext browserContext() {
        ensureOpen();

        return browserContext;
    }

    /*
     * 기존 코드와 호환성을 위해 page()도 유지한다.
     *
     * 하지만 이제 최초 Page가 아니라
     * currentPage를 반환한다.
     */
    Page page() {
        return currentPage();
    }

    Page currentPage() {
        ensureOpen();

        if (currentPage == null) {
            throw new IllegalStateException(
                    "현재 사용할 수 있는 Page가 없습니다."
            );
        }

        return currentPage;
    }

    public Instant createdAt() {
        return createdAt;
    }

    String currentUrl() {
        return currentPage().url();
    }

    public boolean isClosed() {
        return closed.get();
    }

    int trackedPageCount() {
        return trackedPages.size();
    }

    private void registerPage(
            Page page
    ) {
        if (page == null
                || closed.get()) {

            return;
        }

        /*
         * 같은 Page가 중복 이벤트로 들어오더라도
         * 두 번 등록하지 않는다.
         */
        if (!trackedPages.add(page)) {
            return;
        }

        openedPages.addLast(
                page
        );

        currentPage =
                page;

        /*
         * 이 Page가 닫히면 추적 목록에서 제거한다.
         */
        page.onClose(
                this::handlePageClosed
        );
    }

    private void handlePageClosed(
            Page page
    ) {
        if (page == null) {
            return;
        }

        trackedPages.remove(
                page
        );

        openedPages.remove(
                page
        );

        /*
         * 닫힌 Page가 현재 Page였다면
         * 가장 최근에 살아 있는 이전 Page로 복귀한다.
         */
        if (currentPage == page) {
            currentPage =
                    openedPages.peekLast();
        }
    }

    private void ensureOpen() {
        if (closed.get()) {
            throw new IllegalStateException(
                    "이미 종료된 브라우저 세션입니다."
            );
        }
    }

    @Override
    public void close() {
        if (!closed.compareAndSet(
                false,
                true
        )) {
            return;
        }

        try {
            browserContext.close();

        } finally {
            openedPages.clear();
            trackedPages.clear();
            currentPage = null;
        }
    }
}