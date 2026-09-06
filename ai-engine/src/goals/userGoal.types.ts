export type UserGoalIntent =
  | "DEPOSIT"
  | "TRANSFER"
  | "INQUIRY"
  | "CHANGE"
  | "RISK"
  | "UNKNOWN";

export type DurationUnit =
  | "DAY"
  | "WEEK"
  | "MONTH"
  | "YEAR";

export interface GoalDuration {
  value: number;
  unit: DurationUnit;
  originalText: string;
}

export interface UserGoal {
  originalText: string;

  intent: UserGoalIntent;
  confidence: number;

  amount: number | null;
  currency: "KRW" | null;

  duration: GoalDuration | null;
  recipient: string | null;

  conditions: string[];
  missingFields: string[];
}