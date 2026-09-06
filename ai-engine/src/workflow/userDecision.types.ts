export const USER_DECISION_TYPES = [
  "PRODUCT_SELECTION",
  "SOURCE_ACCOUNT_SELECTION",
  "RECIPIENT_SELECTION",
  "TERMS_AGREEMENT",
  "ADDITIONAL_INFORMATION",
] as const;

export type UserDecisionType =
  (typeof USER_DECISION_TYPES)[number];

export const PRODUCTION_DECISION_RESPONSE_TYPES = [
  "PRODUCT_SELECTION",
  "SOURCE_ACCOUNT_SELECTION",
  "RECIPIENT_SELECTION",
  "TERMS_AGREEMENT",
] as const satisfies readonly UserDecisionType[];

export type ProductionDecisionResponseType =
  (typeof PRODUCTION_DECISION_RESPONSE_TYPES)[number];

export function isProductionDecisionResponseType(
  value: unknown,
): value is ProductionDecisionResponseType {
  return (
    typeof value === "string" &&
    (
      PRODUCTION_DECISION_RESPONSE_TYPES as readonly string[]
    ).includes(value)
  );
}

export function isUserDecisionType(
  value: unknown,
): value is UserDecisionType {
  return (
    typeof value === "string" &&
    (
      USER_DECISION_TYPES as readonly string[]
    ).includes(value)
  );
}

export interface DecisionOption {
  id: string;
  label: string;
  description?: string;
  disabled?: boolean;
  checked?: boolean | null;
}

export interface DecisionTerm extends DecisionOption {
  required: boolean;
}

export type StructuredDecisionItem =
  | DecisionOption
  | DecisionTerm;

function normalizeRequiredText(
  value: string,
  fieldName: string,
): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(
      `[AI Engine] ${fieldName} is required.`,
    );
  }

  return normalized;
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

function cloneOption(
  option: DecisionOption,
): DecisionOption {
  const cloned: DecisionOption = {
    id: validateExactId(
      option.id,
      "decision option id",
    ),
    label: normalizeRequiredText(
      option.label,
      "decision option label",
    ),
  };

  if (option.description !== undefined) {
    cloned.description = option.description.trim();
  }

  if (option.disabled !== undefined) {
    if (typeof option.disabled !== "boolean") {
      throw new Error(
        "[AI Engine] decision option disabled must be boolean.",
      );
    }

    cloned.disabled = option.disabled;
  }

  return Object.freeze(cloned);
}

export function validateDecisionOptions(
  options: readonly DecisionOption[],
): readonly DecisionOption[] {
  if (options.length === 0) {
    throw new Error(
      "[AI Engine] decision options must not be empty.",
    );
  }

  const seenIds = new Set<string>();

  const validated = options.map((option) => {
    const cloned = cloneOption(option);

    if (seenIds.has(cloned.id)) {
      throw new Error(
        `[AI Engine] duplicate decision option id: ${cloned.id}`,
      );
    }

    seenIds.add(cloned.id);
    return cloned;
  });

  return Object.freeze(validated);
}

export function validateDecisionTerms(
  terms: readonly DecisionTerm[],
): readonly DecisionTerm[] {
  const options = validateDecisionOptions(terms);

  return Object.freeze(
    options.map((option, index) => {
      const source = terms[index];

      if (!source || typeof source.required !== "boolean") {
        throw new Error(
          "[AI Engine] decision term required must be boolean.",
        );
      }

      return Object.freeze({
        ...option,
        required: source.required,
      });
    }),
  );
}

export function validateStructuredDecisionItems(
  decisionType: UserDecisionType | null,
  items: readonly StructuredDecisionItem[] | null,
): readonly StructuredDecisionItem[] | null {
  if (items === null) {
    return null;
  }

  if (decisionType === null) {
    throw new Error(
      "[AI Engine] decisionType is required when options are present.",
    );
  }

  if (decisionType === "TERMS_AGREEMENT") {
    return validateDecisionTerms(
      items as readonly DecisionTerm[],
    );
  }

  return validateDecisionOptions(items);
}
