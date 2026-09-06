import type {
  NextActionDecision,
} from "../actions/nextAction.types.js";

export interface TargetAccuracyCaseResult {
  name: string;

  expectedAction: string;

  expectedTargetId: string | null;

  actualAction: string;

  actualTargetId: string | null;

  correct: boolean;
}

export interface TargetAccuracySummary {
  total: number;

  correct: number;

  accuracy: number;

  results: TargetAccuracyCaseResult[];
}

export function compareTargetDecision(
  name: string,
  expectedAction: string,
  expectedTargetId: string | null,
  decision: NextActionDecision,
): TargetAccuracyCaseResult {
  const actualTargetId =
    decision.targetId ?? null;

  return {
    name,

    expectedAction,

    expectedTargetId,

    actualAction:
      decision.action,

    actualTargetId,

    correct:
      decision.action === expectedAction &&
      actualTargetId === expectedTargetId,
  };
}

export function evaluateTargetAccuracy(
  results: TargetAccuracyCaseResult[],
): TargetAccuracySummary {
  const correct =
    results.filter(
      (result) => result.correct,
    ).length;

  const total =
    results.length;

  return {
    total,

    correct,

    accuracy:
      total === 0
        ? 0
        : correct / total,

    results,
  };
}