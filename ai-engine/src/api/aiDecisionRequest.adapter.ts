import { randomUUID } from "node:crypto";

import { extractUserGoal } from "../goals/userGoal.extractor.js";

import type {
  AiActionRequest,
} from "./aiRequest.types.js";

import {
  validateBackendAiDecisionRequest,
} from "./aiDecisionRequest.validator.js";

export function adaptBackendRequestToAiActionRequest(
  value: unknown,
): AiActionRequest {
  const request =
    validateBackendAiDecisionRequest(value);

  const userGoal =
    extractUserGoal(
      request.userRequest,
    );

  const userDecisionContext =
    request.userDecision;

  if (
    userDecisionContext &&
    userDecisionContext.sourceSnapshotId ===
      request.snapshot.snapshotId
  ) {
    throw new Error(
      "[AI Engine] resumed user decision requires a new snapshot.",
    );
  }

  return {
    requestId:
      `req-${randomUUID()}`,

    userGoal: {
      rawMessage:
        request.userRequest,

      intent:
        userGoal.intent,

      amount:
        userGoal.amount ?? undefined,

      recipient:
        userGoal.recipient ?? undefined,

      duration:
        userGoal.duration
          ? {
              value: userGoal.duration.value,
              unit: userGoal.duration.unit,
            }
          : undefined,

      conditions:
        userGoal.conditions,
    },

    domSnapshot:
      request.snapshot,

    ...(userDecisionContext
      ? {
          userDecisionContext:
            userDecisionContext,
        }
      : {}),
  };
}
