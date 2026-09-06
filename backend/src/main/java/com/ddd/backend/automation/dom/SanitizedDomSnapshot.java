package com.ddd.backend.automation.dom;

import java.util.List;
import java.util.Objects;

public record SanitizedDomSnapshot(
        String schemaVersion,
        String snapshotId,
        PageSnapshot page,
        List<ElementSnapshot> elements
) {

    public SanitizedDomSnapshot {
        Objects.requireNonNull(
                schemaVersion,
                "schemaVersion은 필수입니다."
        );

        Objects.requireNonNull(
                snapshotId,
                "snapshotId는 필수입니다."
        );

        Objects.requireNonNull(
                page,
                "page는 필수입니다."
        );

        elements =
                List.copyOf(
                        elements
                );
    }

    public record PageSnapshot(
            String url,
            String title,
            String productId,
            String productName,
            String productPeriod,
            String depositAmount
    ) {
        public PageSnapshot(String url, String title) {
            this(url, title, null, null, null, null);
        }

        public PageSnapshot(
                String url, String title, String productId,
                String productName, String productPeriod
        ) {
            this(url, title, productId, productName, productPeriod, null);
        }
    }

    public record ElementSnapshot(
            String elementId,
            String tag,
            String role,
            String text,
            String ariaLabel,
            String placeholder,
            String inputType,
            boolean visible,
            boolean enabled,
            Boolean checked,
            BoundingBoxSnapshot boundingBox,
            SecurityPolicy securityPolicy
    ) {

        public ElementSnapshot {
            Objects.requireNonNull(
                    elementId,
                    "elementId는 필수입니다."
            );

            Objects.requireNonNull(
                    tag,
                    "tag는 필수입니다."
            );

            Objects.requireNonNull(
                    securityPolicy,
                    "securityPolicy는 필수입니다."
            );
        }

        public ElementSnapshot(
                String elementId, String tag, String role, String text,
                String ariaLabel, String placeholder, String inputType,
                boolean visible, boolean enabled,
                BoundingBoxSnapshot boundingBox, SecurityPolicy securityPolicy
        ) {
            this(elementId, tag, role, text, ariaLabel, placeholder, inputType,
                    visible, enabled, null, boundingBox, securityPolicy);
        }
    }

    public record BoundingBoxSnapshot(
            double x,
            double y,
            double width,
            double height
    ) {
    }

    public enum SecurityPolicy {

        NORMAL,

        USER_DECISION,

        SECURE_INPUT,

        FINAL_CONFIRMATION,

        BLOCKED
    }
}
