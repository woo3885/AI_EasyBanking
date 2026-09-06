package com.ddd.backend.conversation.navigation;

import com.ddd.backend.automation.dom.ElementResolutionError;
import com.ddd.backend.automation.dom.ElementResolutionException;
import com.ddd.backend.conversation.overlay.GuideUserMaterializationException;
import org.junit.jupiter.api.Test;

import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutionException;

import static org.assertj.core.api.Assertions.assertThat;

class PageReadyResumeErrorsTest {
    @Test
    void async_wrapper와_domain_wrapper를_끝까지_unwrap한다() {
        Throwable wrapped = new CompletionException(new ExecutionException(
                new PageReadyResumeException(PageReadyResumeError.PAGE_READY_RESUME_FAILED,
                        new ElementResolutionException(ElementResolutionError.TARGET_NOT_FOUND))));

        assertThat(PageReadyResumeErrors.classify(wrapped))
                .isEqualTo(PageReadyResumeError.OVERLAY_TARGET_NOT_FOUND);
    }

    @Test
    void guide_user_materialization_reason을_보존한다() {
        Throwable wrapped = new CompletionException(new GuideUserMaterializationException(
                PageReadyResumeError.GUIDE_USER_TARGET_INVALID));

        assertThat(PageReadyResumeErrors.classify(wrapped))
                .isEqualTo(PageReadyResumeError.GUIDE_USER_TARGET_INVALID);
    }
}
