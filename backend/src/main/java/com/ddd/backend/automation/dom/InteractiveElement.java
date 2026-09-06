package com.ddd.backend.automation.dom;

import java.util.Locale;

public record InteractiveElement(
        int index,
        String tagName,
        String text,
        String role,
        String ariaLabel,
        String placeholder,
        String inputType,
        String domId,
        String name,
        String autocomplete,
        String explicitPolicy,
        boolean visible,
        boolean enabled,
        Boolean checked,
        Double x,
        Double y,
        Double width,
        Double height
) {

    public InteractiveElement {

        if (index < 0) {
            throw new IllegalArgumentException(
                    "요소 index는 0 이상이어야 합니다."
            );
        }

        if (tagName == null
                || tagName.isBlank()) {

            throw new IllegalArgumentException(
                    "요소 tagName은 필수입니다."
            );
        }

        tagName =
                tagName
                        .trim()
                        .toLowerCase(
                                Locale.ROOT
                        );

        text =
                normalizeText(
                        text
                );

        role =
                normalizeNullableText(
                        role
                );

        ariaLabel =
                normalizeNullableText(
                        ariaLabel
                );

        placeholder =
                normalizeNullableText(
                        placeholder
                );

        inputType =
                normalizeNullableText(
                        inputType
                );

        domId =
                normalizeNullableText(
                        domId
                );

        name =
                normalizeNullableText(
                        name
                );

        autocomplete =
                normalizeNullableText(
                        autocomplete
                );

        explicitPolicy =
                normalizeNullableText(
                        explicitPolicy
                );

        boolean hasAnyCoordinate =
                x != null
                        || y != null
                        || width != null
                        || height != null;

        boolean hasAllCoordinates =
                x != null
                        && y != null
                        && width != null
                        && height != null;

        if (hasAnyCoordinate
                && !hasAllCoordinates) {

            throw new IllegalArgumentException(
                    "좌표 정보는 x/y/width/height가 모두 있어야 합니다."
            );
        }
    }

    /*
     * D14 시점의 기존 생성자와 호환.
     */
    public InteractiveElement(
            int index,
            String tagName,
            String text,
            String role,
            String ariaLabel,
            String inputType,
            boolean visible,
            boolean enabled,
            Double x,
            Double y,
            Double width,
            Double height
    ) {
        this(
                index,
                tagName,
                text,
                role,
                ariaLabel,
                null,
                inputType,
                null,
                null,
                null,
                null,
                visible,
                enabled,
                null,
                x,
                y,
                width,
                height
        );
    }

    public InteractiveElement(
            int index, String tagName, String text, String role,
            String ariaLabel, String placeholder, String inputType,
            String domId, String name, String autocomplete,
            String explicitPolicy, boolean visible, boolean enabled,
            Double x, Double y, Double width, Double height
    ) {
        this(index, tagName, text, role, ariaLabel, placeholder, inputType,
                domId, name, autocomplete, explicitPolicy, visible, enabled,
                null, x, y, width, height);
    }

    public boolean hasBoundingBox() {
        return x != null
                && y != null
                && width != null
                && height != null;
    }

    private static String normalizeText(
            String value
    ) {
        if (value == null
                || value.isBlank()) {

            return "";
        }

        return value
                .trim()
                .replaceAll(
                        "\\s+",
                        " "
                );
    }

    private static String normalizeNullableText(
            String value
    ) {
        if (value == null
                || value.isBlank()) {

            return null;
        }

        return value.trim();
    }
}
