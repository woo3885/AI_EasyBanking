package com.ddd.backend.api.dto.action;

import com.ddd.backend.automation.BrowserActionType;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record BrowserActionRequest(

        @NotBlank(
                message = "requestId는 비어 있을 수 없습니다."
        )
        @Size(
                max = 100,
                message = "requestId는 100자를 초과할 수 없습니다."
        )
        @Pattern(
                regexp = "^[A-Za-z0-9_-]+$",
                message = "requestId 형식이 올바르지 않습니다."
        )
        String requestId,

        @NotNull(
                message = "actionType은 필수입니다."
        )
        BrowserActionType actionType,

        /*
         * Public API에서는 반드시 USER_VIEWER를
         * 명시적으로 전달해야 한다.
         */
        @NotNull(
                message = "source는 필수입니다."
        )
        PublicBrowserActionSource source,

        /*
         * 기존 elementId CLICK용.
         *
         * 좌표 CLICK / SCROLL에서는 null.
         */
        @Pattern(
                regexp = "^el-[A-Za-z0-9]{8}-\\d{3}$",
                message = "elementId 형식이 올바르지 않습니다."
        )
        String elementId,

        /*
         * 1280 x 720 CSS viewport 좌표.
         */
        @Min(
                value = 0,
                message = "x는 0 이상이어야 합니다."
        )
        @Max(
                value = 1279,
                message = "x는 1279 이하여야 합니다."
        )
        Integer x,

        @Min(
                value = 0,
                message = "y는 0 이상이어야 합니다."
        )
        @Max(
                value = 719,
                message = "y는 719 이하여야 합니다."
        )
        Integer y,

        /*
         * SCROLL delta.
         * 단위는 CSS pixel.
         */
        @Min(
                value = -3000,
                message = "deltaX는 -3000 이상이어야 합니다."
        )
        @Max(
                value = 3000,
                message = "deltaX는 3000 이하여야 합니다."
        )
        Integer deltaX,

        @Min(
                value = -3000,
                message = "deltaY는 -3000 이상이어야 합니다."
        )
        @Max(
                value = 3000,
                message = "deltaY는 3000 이하여야 합니다."
        )
        Integer deltaY,

        @NotBlank(
                message = "expectedFrameId는 비어 있을 수 없습니다."
        )
        @Size(
                max = 100,
                message = "expectedFrameId는 100자를 초과할 수 없습니다."
        )
        String expectedFrameId,

        @NotNull(
                message = "expectedSequence는 필수입니다."
        )
        @Positive(
                message = "expectedSequence는 1 이상이어야 합니다."
        )
        Long expectedSequence

) {

        public BrowserActionRequest {
                if (elementId != null) {
                        String normalized =
                                elementId.trim();

                        elementId =
                                normalized.isEmpty()
                                        ? null
                                        : normalized;
                }
        }

        /*
         * 기존 Java 단위 테스트 및
         * 기존 elementId CLICK 코드 호환용.
         *
         * HTTP JSON에서는 이 생성자를 사용하지 않는다.
         */
        public BrowserActionRequest(
                String requestId,
                BrowserActionType actionType,
                String elementId,
                String expectedFrameId,
                Long expectedSequence
        ) {
                this(
                        requestId,
                        actionType,
                        PublicBrowserActionSource.USER_VIEWER,
                        elementId,
                        null,
                        null,
                        null,
                        null,
                        expectedFrameId,
                        expectedSequence
                );
        }
}