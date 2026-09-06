import { intentClassifier } from "../intents/intent.classifier.js";
import type {
  DurationUnit,
  GoalDuration,
  UserGoal,
} from "./userGoal.types.js";

const CONDITION_KEYWORDS = [
  "금리가 높은",
  "금리가 낮은",
  "수수료 없는",
  "수수료가 없는",
  "우대금리",
  "비과세",
  "안전한",
  "예금자 보호",
  "중도 해지 가능한",
  "가입 기간이 짧은",
  "한도가 높은",
] as const;

/**
 * 한국어 금액 표현을 원 단위 숫자로 변환한다.
 *
 * 예:
 * 10만 원   → 100000
 * 300만원   → 3000000
 * 1억 원    → 100000000
 * 50,000원  → 50000
 */
function extractAmount(text: string): number | null {
  const normalizedText = text.replace(/,/g, "");

  const eokMatch = normalizedText.match(
    /(\d+(?:\.\d+)?)\s*억\s*원?/,
  );

  if (eokMatch) {
    return Math.round(Number(eokMatch[1]) * 100_000_000);
  }

  const manMatch = normalizedText.match(
    /(\d+(?:\.\d+)?)\s*만\s*원?/,
  );

  if (manMatch) {
    return Math.round(Number(manMatch[1]) * 10_000);
  }

  const cheonMatch = normalizedText.match(
    /(\d+(?:\.\d+)?)\s*천\s*원?/,
  );

  if (cheonMatch) {
    return Math.round(Number(cheonMatch[1]) * 1_000);
  }

  const wonMatch = normalizedText.match(/(\d+)\s*원/);

  if (wonMatch) {
    return Number(wonMatch[1]);
  }

  return null;
}

/**
 * 기간 표현을 추출한다.
 *
 * 예:
 * 3일, 2주, 6개월, 1년
 */
function extractDuration(text: string): GoalDuration | null {
  const durationMatch = text.match(
    /(\d+)\s*(일|주|개월|달|년)/,
  );

  if (!durationMatch) {
    return null;
  }

  const valueText = durationMatch[1];
  const koreanUnit = durationMatch[2];
  const originalText = durationMatch[0];

  if (!valueText || !koreanUnit || !originalText) {
    return null;
  }

  const unitMap: Record<string, DurationUnit> = {
    일: "DAY",
    주: "WEEK",
    개월: "MONTH",
    달: "MONTH",
    년: "YEAR",
  };

  const unit = unitMap[koreanUnit];

  if (!unit) {
    return null;
  }

  return {
    value: Number(valueText),
    unit,
    originalText,
  };
}

/**
 * 송금 문장에서 수취인을 추출한다.
 *
 * 예:
 * 민수에게 10만 원 보내줘 → 민수
 * 친구 계좌로 송금해 줘 → 친구
 */
function extractRecipient(text: string): string | null {
  const recipientPatterns = [
    /([가-힣A-Za-z0-9]{1,20})에게(?:로)?/,
    /([가-힣A-Za-z0-9]{1,20})한테(?:로)?/,
    /([가-힣A-Za-z0-9]{1,20})\s*계좌로/,
  ];

  for (const pattern of recipientPatterns) {
    const match = text.match(pattern);

    const recipient = match?.[1];

    if (recipient) {
      return recipient;
    }
  }

  return null;
}

function extractConditions(text: string): string[] {
  return CONDITION_KEYWORDS.filter((condition) =>
    text.includes(condition),
  );
}

function findMissingFields(
  goal: Pick<
    UserGoal,
    "intent" | "amount" | "recipient"
  >,
): string[] {
  const missingFields: string[] = [];

  if (goal.intent === "TRANSFER") {
    if (goal.amount === null) {
      missingFields.push("amount");
    }

    if (goal.recipient === null) {
      missingFields.push("recipient");
    }
  }

  return missingFields;
}

export function extractUserGoal(text: string): UserGoal {
  const intentResult = intentClassifier.classify(text);

  const amount = extractAmount(text);
  const duration = extractDuration(text);
  const recipient = extractRecipient(text);
  const conditions = extractConditions(text);

  const baseGoal = {
    intent: intentResult.intent,
    amount,
    recipient,
    duration,
  };

  return {
    originalText: text,

    intent: intentResult.intent,
    confidence: intentResult.confidence,

    amount,
    currency: amount === null ? null : "KRW",

    duration,
    recipient,

    conditions,
    missingFields: findMissingFields(baseGoal),
  };
}
