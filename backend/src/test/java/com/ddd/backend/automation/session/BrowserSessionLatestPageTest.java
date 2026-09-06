package com.ddd.backend.automation.session;

import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.Page;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class BrowserSessionLatestPageTest {

    @Test
    void 최초에는_initialPage를_현재Page로_사용한다() {
        BrowserContext context =
                mock(BrowserContext.class);

        Page initialPage =
                mock(Page.class);

        BrowserSession session =
                new BrowserSession(
                        "session-1",
                        context,
                        initialPage
                );

        assertThat(
                session.currentPage()
        ).isSameAs(
                initialPage
        );

        assertThat(
                session.trackedPageCount()
        ).isEqualTo(
                1
        );
    }

    @Test
    @SuppressWarnings("unchecked")
    void 새_Page가_생성되면_현재Page를_새Page로_변경한다() {
        BrowserContext context =
                mock(BrowserContext.class);

        Page initialPage =
                mock(Page.class);

        Page popupPage =
                mock(Page.class);

        BrowserSession session =
                new BrowserSession(
                        "session-1",
                        context,
                        initialPage
                );

        ArgumentCaptor<Consumer<Page>> onPageCaptor =
                ArgumentCaptor.forClass(
                        Consumer.class
                );

        verify(context).onPage(
                onPageCaptor.capture()
        );

        onPageCaptor
                .getValue()
                .accept(
                        popupPage
                );

        assertThat(
                session.currentPage()
        ).isSameAs(
                popupPage
        );

        assertThat(
                session.trackedPageCount()
        ).isEqualTo(
                2
        );
    }

    @Test
    @SuppressWarnings("unchecked")
    void 현재Page가_닫히면_이전Page로_복귀한다() {
        BrowserContext context =
                mock(BrowserContext.class);

        Page initialPage =
                mock(Page.class);

        Page popupPage =
                mock(Page.class);

        BrowserSession session =
                new BrowserSession(
                        "session-1",
                        context,
                        initialPage
                );

        ArgumentCaptor<Consumer<Page>> contextPageCaptor =
                ArgumentCaptor.forClass(
                        Consumer.class
                );

        verify(context).onPage(
                contextPageCaptor.capture()
        );

        contextPageCaptor
                .getValue()
                .accept(
                        popupPage
                );

        ArgumentCaptor<Consumer<Page>> popupCloseCaptor =
                ArgumentCaptor.forClass(
                        Consumer.class
                );

        verify(popupPage).onClose(
                popupCloseCaptor.capture()
        );

        popupCloseCaptor
                .getValue()
                .accept(
                        popupPage
                );

        assertThat(
                session.currentPage()
        ).isSameAs(
                initialPage
        );

        assertThat(
                session.trackedPageCount()
        ).isEqualTo(
                1
        );
    }

    @Test
    @SuppressWarnings("unchecked")
    void 여러_Page가_열리면_가장_최근_Page를_사용한다() {
        BrowserContext context =
                mock(BrowserContext.class);

        Page initialPage =
                mock(Page.class);

        Page secondPage =
                mock(Page.class);

        Page thirdPage =
                mock(Page.class);

        BrowserSession session =
                new BrowserSession(
                        "session-1",
                        context,
                        initialPage
                );

        ArgumentCaptor<Consumer<Page>> onPageCaptor =
                ArgumentCaptor.forClass(
                        Consumer.class
                );

        verify(context).onPage(
                onPageCaptor.capture()
        );

        Consumer<Page> listener =
                onPageCaptor.getValue();

        listener.accept(
                secondPage
        );

        listener.accept(
                thirdPage
        );

        assertThat(
                session.currentPage()
        ).isSameAs(
                thirdPage
        );

        assertThat(
                session.trackedPageCount()
        ).isEqualTo(
                3
        );
    }

    @Test
    @SuppressWarnings("unchecked")
    void 마지막_Page까지_닫히면_현재Page_접근을_거부한다() {
        BrowserContext context =
                mock(BrowserContext.class);

        Page initialPage =
                mock(Page.class);

        BrowserSession session =
                new BrowserSession(
                        "session-1",
                        context,
                        initialPage
                );

        ArgumentCaptor<Consumer<Page>> closeCaptor =
                ArgumentCaptor.forClass(
                        Consumer.class
                );

        verify(initialPage).onClose(
                closeCaptor.capture()
        );

        closeCaptor
                .getValue()
                .accept(
                        initialPage
                );

        assertThatThrownBy(
                session::currentPage
        )
                .isInstanceOf(
                        IllegalStateException.class
                )
                .hasMessageContaining(
                        "Page"
                );
    }

    @Test
    void 세션을_닫으면_BrowserContext를_닫는다() {
        BrowserContext context =
                mock(BrowserContext.class);

        Page initialPage =
                mock(Page.class);

        BrowserSession session =
                new BrowserSession(
                        "session-1",
                        context,
                        initialPage
                );

        session.close();

        verify(context).close();

        assertThat(
                session.isClosed()
        ).isTrue();

        assertThatThrownBy(
                session::currentPage
        )
                .isInstanceOf(
                        IllegalStateException.class
                );
    }
}