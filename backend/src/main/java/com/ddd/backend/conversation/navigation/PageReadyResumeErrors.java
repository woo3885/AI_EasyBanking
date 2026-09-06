package com.ddd.backend.conversation.navigation;

import com.ddd.backend.automation.dom.ElementResolutionException;
import com.ddd.backend.conversation.overlay.GuideUserMaterializationException;
import com.ddd.backend.conversation.overlay.OverlayTargetError;
import com.ddd.backend.conversation.overlay.OverlayTargetException;

public final class PageReadyResumeErrors {
    private PageReadyResumeErrors() { }

    public static PageReadyResumeError classify(Throwable error) {
        PageReadyResumeError fallback = PageReadyResumeError.PAGE_READY_RESUME_FAILED;
        for (Throwable current = error; current != null; current = current.getCause()) {
            if (current instanceof PageReadyResumeException resume) {
                fallback = resume.error();
                continue;
            }
            if (current instanceof GuideUserMaterializationException materialization) {
                return materialization.error();
            }
            if (current instanceof ElementResolutionException resolution) {
                return switch (resolution.error()) {
                    case TARGET_NOT_FOUND -> PageReadyResumeError.OVERLAY_TARGET_NOT_FOUND;
                    case TARGET_AMBIGUOUS -> PageReadyResumeError.OVERLAY_TARGET_AMBIGUOUS;
                    case STALE_SNAPSHOT -> PageReadyResumeError.OVERLAY_TARGET_STALE_SNAPSHOT;
                    case POLICY_MISMATCH -> PageReadyResumeError.OVERLAY_TARGET_POLICY_MISMATCH;
                };
            }
            if (current instanceof OverlayTargetException target) {
                if (target.error() == OverlayTargetError.TARGET_NOT_FOUND) {
                    return PageReadyResumeError.OVERLAY_TARGET_NOT_FOUND;
                }
                if (target.error() == OverlayTargetError.TARGET_STALE_SNAPSHOT
                        || target.error() == OverlayTargetError.TARGET_STALE_PAGE) {
                    return PageReadyResumeError.OVERLAY_TARGET_STALE_SNAPSHOT;
                }
                return PageReadyResumeError.OVERLAY_TARGET_POLICY_MISMATCH;
            }
        }
        return fallback;
    }
}
