package com.ddd.backend.conversation.navigation;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class NavigationDecisionRegistryTest {
    private final NavigationDecisionRegistry registry = new NavigationDecisionRegistry();

    @Test
    void 동일한_decision은_navigation을_한번만_생성하고_변조된_재시도는_거부한다() {
        AtomicInteger created = new AtomicInteger();
        NavigationDecisionContext decision = context(
                BrowserSemanticRoute.DEPOSIT_PRODUCTS, BrowserNavigationMode.SPA_PUSH);

        NavigationDecisionContext first = registry.startOnce(decision, () -> navigation(created));
        NavigationDecisionContext duplicate = registry.startOnce(decision, () -> navigation(created));

        assertThat(first.navigationId()).isEqualTo(duplicate.navigationId());
        assertThat(created).hasValue(1);
        assertThatThrownBy(() -> registry.startOnce(
                context(BrowserSemanticRoute.TRANSFER_ACCOUNTS, BrowserNavigationMode.SPA_PUSH),
                () -> navigation(created)))
                .isInstanceOfSatisfying(BrowserNavigationException.class,
                        error -> assertThat(error.error()).isEqualTo(BrowserNavigationError.NAVIGATION_STALE));
    }

    @Test
    void page_ready_resume는_성공과_실패_모두_재시도하지_않는다() {
        NavigationDecisionContext stored = registry.startOnce(
                context(BrowserSemanticRoute.DEPOSIT_PRODUCTS, BrowserNavigationMode.SPA_PUSH),
                () -> navigation(new AtomicInteger()));

        registry.claimResume(stored.navigationId());
        registry.failResume(stored.navigationId());

        assertThatThrownBy(() -> registry.claimResume(stored.navigationId()))
                .isInstanceOfSatisfying(BrowserNavigationException.class,
                        error -> assertThat(error.error())
                                .isEqualTo(BrowserNavigationError.PAGE_READY_ALREADY_ACCEPTED));
    }

    private NavigationDecisionContext context(BrowserSemanticRoute route, BrowserNavigationMode mode) {
        return new NavigationDecisionContext("session-1", "decision-1", "request-1", "message-1",
                0, "snapshot-1", route, mode, null,
                NavigationDecisionContext.ResumeStatus.PENDING);
    }

    private PendingBrowserNavigation navigation(AtomicInteger created) {
        int number = created.incrementAndGet();
        return new PendingBrowserNavigation("navigation-" + number, "session-1", "binding-1",
                "page-1", "page-2", "/deposit/products", 0,
                BrowserNavigationMode.SPA_PUSH, Instant.now().plusSeconds(60),
                PendingBrowserNavigation.Status.ACTIVE);
    }
}
