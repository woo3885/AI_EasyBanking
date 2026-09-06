package com.ddd.backend.api.dto.conversation;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record BrowserPageReadyRequest(
        @NotBlank String requestId,
        @NotBlank String navigationId,
        @NotBlank String sourcePageIdentity,
        @NotBlank String destinationPageIdentity,
        @Min(1) long routeRevision,
        @NotBlank String renderedRoute,
        @Min(1) @Max(10000) int viewportWidth,
        @Min(1) @Max(10000) int viewportHeight,
        @DecimalMin("0.1") @DecimalMax("10.0") double devicePixelRatio
) {
}
