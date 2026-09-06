package com.ddd.backend.api.dto.conversation;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;

public record InteractionObservationRequest(
        @NotBlank @Size(max = 128) String requestId,
        @NotBlank @Size(max = 128) String targetId,
        @NotBlank @Size(max = 128) String sourceSnapshotId,
        @NotBlank @Pattern(regexp = "USER_CLICK") String observationType,
        @NotNull Instant clientOccurredAt
) { }
