import type {
  ConversationUserGoal,
  GoalAmount,
  GoalDuration,
  GoalIntent,
  UserGoalPatch,
} from "./conversationAgent.types.js";

export type SafeGoalValue = GoalAmount | GoalDuration | string;

export type GoalPatchExtractionResult =
  | { kind: "PATCH"; patch: UserGoalPatch }
  | {
      kind: "CONFLICT";
      fieldKey: string;
      currentValue: SafeGoalValue;
      proposedValue: SafeGoalValue;
      message: string;
    }
  | { kind: "AMBIGUOUS"; fieldKey: string; message: string }
  | { kind: "CANCEL"; patch: UserGoalPatch; message: string }
  | { kind: "SECURE_INPUT"; message: string };

const CREDENTIAL_CONTEXT =
  /(?:password|passwd|비밀번호|\botp\b|인증\s*번호|\bpin\b)/iu;
const CANCEL = /(?:취소할게|그만할래|하지\s*않을래)/u;
const AMBIGUOUS = /(?:잘\s*모르겠어|아무거나)/u;

export function containsCredentialContext(message: string): boolean {
  return CREDENTIAL_CONTEXT.test(message);
}

export function normalizeKrwAmount(message: string): GoalAmount | null {
  const compact = message.replace(/,/gu, "");
  const units: Array<[RegExp, bigint]> = [
    [/(\d+)\s*천\s*만\s*원?/u, 10_000_000n],
    [/(\d+)\s*만\s*원/u, 10_000n],
    [/(\d+)\s*원/u, 1n],
  ];

  for (const [pattern, multiplier] of units) {
    const match = compact.match(pattern);
    if (!match?.[1]) continue;
    const value = BigInt(match[1]) * multiplier;
    if (value <= 0n) return null;
    return { value: value.toString(), currency: "KRW" };
  }
  return null;
}

export function normalizeDuration(message: string): GoalDuration | null {
  const monthMatch = message.match(/(\d+)\s*개월/u);
  if (monthMatch?.[1]) {
    const value = Number(monthMatch[1]);
    return Number.isSafeInteger(value) && value > 0
      ? { value, unit: "MONTH" }
      : null;
  }
  const yearMatch = message.match(/(\d+)\s*년/u);
  if (yearMatch?.[1]) {
    const years = Number(yearMatch[1]);
    const value = years * 12;
    return Number.isSafeInteger(value) && years > 0
      ? { value, unit: "MONTH" }
      : null;
  }
  return null;
}

function detectIntent(message: string): GoalIntent {
  if (/(?:변경|바꿔|고쳐)/u.test(message)) return "CHANGE";
  if (/(?:이체|송금)/u.test(message)) return "TRANSFER";
  if (/(?:조회|알아보|확인)/u.test(message)) return "INQUIRY";
  if (/(?:예금|적금)/u.test(message)) return "DEPOSIT";
  return "UNKNOWN";
}

function missingFor(
  intent: GoalIntent,
  amount: GoalAmount | null,
  duration: GoalDuration | null,
): string[] {
  if (intent !== "DEPOSIT") return [];
  const missing: string[] = [];
  if (amount === null) missing.push("amount");
  if (duration === null) missing.push("duration");
  return missing;
}

export function extractInitialGoalPatch(
  goal: ConversationUserGoal,
  message: string,
): GoalPatchExtractionResult {
  if (containsCredentialContext(message)) {
    return {
      kind: "SECURE_INPUT",
      message: "민감정보는 금융 화면에 직접 입력해 주세요.",
    };
  }
  if (CANCEL.test(message)) {
    return {
      kind: "CANCEL",
      patch: { basedOnRevision: goal.revision, status: "CANCELLED" },
      message: "요청을 중단합니다.",
    };
  }

  const intent = detectIntent(message);
  const amount = normalizeKrwAmount(message);
  const duration = normalizeDuration(message);
  const missingFields = missingFor(intent, amount, duration);
  const patch: UserGoalPatch = {
    basedOnRevision: goal.revision,
    intent,
    missingFields,
    pendingQuestionFieldKey: missingFields[0] ?? null,
  };
  if (amount !== null) patch.amount = amount;
  if (duration !== null) patch.duration = duration;
  return { kind: "PATCH", patch };
}

function sameValue(left: SafeGoalValue, right: SafeGoalValue): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function mergeGoalAnswer(
  goal: ConversationUserGoal,
  message: string,
): GoalPatchExtractionResult {
  if (containsCredentialContext(message)) {
    return {
      kind: "SECURE_INPUT",
      message: "민감정보는 금융 화면에 직접 입력해 주세요.",
    };
  }
  if (CANCEL.test(message)) {
    return {
      kind: "CANCEL",
      patch: { basedOnRevision: goal.revision, status: "CANCELLED" },
      message: "요청을 중단합니다.",
    };
  }

  const fieldKey = goal.pendingQuestion?.fieldKey;
  if (fieldKey && AMBIGUOUS.test(message)) {
    return { kind: "AMBIGUOUS", fieldKey, message: questionMessage(fieldKey) };
  }

  if (fieldKey === "duration") {
    const duration = normalizeDuration(message);
    if (duration === null) {
      return { kind: "AMBIGUOUS", fieldKey, message: questionMessage(fieldKey) };
    }
    if (goal.duration !== null && !sameValue(goal.duration, duration)) {
      return conflict("duration", goal.duration, duration);
    }
    return {
      kind: "PATCH",
      patch: {
        basedOnRevision: goal.revision,
        duration,
        missingFields: goal.missingFields.filter((field) => field !== "duration"),
        pendingQuestionFieldKey: null,
      },
    };
  }

  if (fieldKey === "amount") {
    const amount = normalizeKrwAmount(message);
    if (amount === null) {
      return { kind: "AMBIGUOUS", fieldKey, message: questionMessage(fieldKey) };
    }
    if (goal.amount !== null && !sameValue(goal.amount, amount)) {
      return conflict("amount", goal.amount, amount);
    }
    const remaining = goal.missingFields.filter((field) => field !== "amount");
    return {
      kind: "PATCH",
      patch: {
        basedOnRevision: goal.revision,
        amount,
        missingFields: remaining,
        pendingQuestionFieldKey: remaining[0] ?? null,
      },
    };
  }

  const proposedDuration = normalizeDuration(message);
  if (goal.duration !== null && proposedDuration !== null
      && !sameValue(goal.duration, proposedDuration)) {
    return conflict("duration", goal.duration, proposedDuration);
  }
  const proposedAmount = normalizeKrwAmount(message);
  if (goal.amount !== null && proposedAmount !== null
      && !sameValue(goal.amount, proposedAmount)) {
    return conflict("amount", goal.amount, proposedAmount);
  }
  return { kind: "AMBIGUOUS", fieldKey: "goal", message: "요청을 구체적으로 알려 주세요." };
}

function conflict(
  fieldKey: string,
  currentValue: SafeGoalValue,
  proposedValue: SafeGoalValue,
): GoalPatchExtractionResult {
  return {
    kind: "CONFLICT",
    fieldKey,
    currentValue,
    proposedValue,
    message: "기존 값과 다른 값이 감지되었습니다. 변경 여부를 확인해 주세요.",
  };
}

export function questionMessage(fieldKey: string): string {
  if (fieldKey === "duration") return "가입 기간을 개월 단위로 알려 주세요.";
  if (fieldKey === "amount") return "가입 금액을 원 단위로 알려 주세요.";
  return "필요한 정보를 구체적으로 알려 주세요.";
}
