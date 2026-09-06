import type {
  UserDecisionType,
} from "./userDecision.types.js";

import {
  isUserDecisionType,
} from "./userDecision.types.js";

export interface PendingUserDecision {
  decisionId: string;
  decisionType: UserDecisionType;
  optionIds: readonly string[];
  snapshotId: string;
}

export interface UserDecisionContext {
  decisionId: string;
  decisionType: UserDecisionType;
  selectedOptionIds: readonly string[];
  sourceSnapshotId: string;
}

function validateExactId(
  value: string,
  fieldName: string,
): string {
  const normalized = value.trim();

  if (!normalized || normalized !== value) {
    throw new Error(
      `[AI Engine] ${fieldName} must be a non-blank exact ID.`,
    );
  }

  return value;
}

function normalizeUniqueIds(
  values: readonly string[],
  fieldName: string,
  allowEmpty = false,
): readonly string[] {
  if (!allowEmpty && values.length === 0) {
    throw new Error(
      `[AI Engine] ${fieldName} must not be empty.`,
    );
  }

  const seen = new Set<string>();
  const normalized = values.map((value) => {
    const id = validateExactId(value, fieldName);

    if (seen.has(id)) {
      throw new Error(
        `[AI Engine] duplicate ${fieldName}: ${id}`,
      );
    }

    seen.add(id);
    return id;
  });

  return Object.freeze(normalized);
}

function clonePending(
  pending: PendingUserDecision,
): PendingUserDecision {
  if (!isUserDecisionType(pending.decisionType)) {
    throw new Error(
      "[AI Engine] pending decision type is not supported.",
    );
  }

  return Object.freeze({
    decisionId: validateExactId(
      pending.decisionId,
      "decisionId",
    ),
    decisionType: pending.decisionType,
    optionIds: normalizeUniqueIds(
      pending.optionIds,
      "decision option id",
    ),
    snapshotId: validateExactId(
      pending.snapshotId,
      "decision snapshotId",
    ),
  });
}

export class UserDecisionContextStore {
  private pending: PendingUserDecision | null = null;
  private latest: UserDecisionContext | null = null;
  private readonly consumedDecisionIds = new Set<string>();

  registerPending(
    value: PendingUserDecision,
  ): PendingUserDecision {
    const pending = clonePending(value);

    if (this.consumedDecisionIds.has(pending.decisionId)) {
      throw new Error(
        "[AI Engine] consumed decisionId cannot be registered again.",
      );
    }

    if (this.pending?.decisionId === pending.decisionId) {
      throw new Error(
        "[AI Engine] decisionId is already pending.",
      );
    }

    if (this.pending) {
      this.consumedDecisionIds.add(
        this.pending.decisionId,
      );
    }

    this.pending = pending;
    return pending;
  }

  consumeVerified(
    value: UserDecisionContext,
    pausedSnapshotId: string,
    resumedSnapshotId: string,
  ): UserDecisionContext {
    if (!isUserDecisionType(value.decisionType)) {
      throw new Error(
        "[AI Engine] resumed decision type is not supported.",
      );
    }

    const decisionId = validateExactId(
      value.decisionId,
      "decisionId",
    );

    if (this.consumedDecisionIds.has(decisionId)) {
      throw new Error(
        "[AI Engine] duplicate user decision resume is not allowed.",
      );
    }

    const pending = this.pending;

    if (!pending || pending.decisionId !== decisionId) {
      throw new Error(
        "[AI Engine] stale user decision cannot resume the agent loop.",
      );
    }

    if (pending.decisionType !== value.decisionType) {
      throw new Error(
        "[AI Engine] user decision type does not match the pending decision.",
      );
    }

    if (
      validateExactId(
        pausedSnapshotId,
        "paused snapshotId",
      ) !== pending.snapshotId
    ) {
      throw new Error(
        "[AI Engine] pending decision does not belong to the paused snapshot.",
      );
    }

    const selectedOptionIds = normalizeUniqueIds(
      value.selectedOptionIds,
      "selected option id",
      pending.decisionType === "TERMS_AGREEMENT",
    );
    const allowedIds = new Set(pending.optionIds);

    for (const selectedId of selectedOptionIds) {
      if (!allowedIds.has(selectedId)) {
        throw new Error(
          `[AI Engine] selected option is not in the pending decision: ${selectedId}`,
        );
      }
    }

    if (
      pending.decisionType !== "TERMS_AGREEMENT" &&
      selectedOptionIds.length !== 1
    ) {
      throw new Error(
        "[AI Engine] this decision type requires exactly one selected option.",
      );
    }

    const nextSnapshotId = validateExactId(
      resumedSnapshotId,
      "resumed snapshotId",
    );

    const sourceSnapshotId = validateExactId(
      value.sourceSnapshotId,
      "source snapshotId",
    );

    if (sourceSnapshotId !== pending.snapshotId) {
      throw new Error(
        "[AI Engine] verified decision source does not match the pending snapshot.",
      );
    }

    if (nextSnapshotId === pending.snapshotId) {
      throw new Error(
        "[AI Engine] user decision resume requires a new snapshot.",
      );
    }

    const context = Object.freeze({
      decisionId,
      decisionType: value.decisionType,
      selectedOptionIds,
      sourceSnapshotId,
    });

    this.latest = context;
    this.pending = null;
    this.consumedDecisionIds.add(decisionId);

    return context;
  }

  latestContext(): UserDecisionContext | null {
    return this.latest;
  }
}
