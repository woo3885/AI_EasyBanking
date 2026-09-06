package com.ddd.backend.api.dto.session;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

@JsonIgnoreProperties(ignoreUnknown = false)
public record CompleteSecureInputRequest(
        @NotBlank @Size(max = 100) String requestId,
        @NotBlank @Size(max = 100) String expectedFrameId,
        @Positive long expectedSequence
) {}
