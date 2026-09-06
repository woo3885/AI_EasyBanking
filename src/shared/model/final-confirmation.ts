export interface FinalConfirmationSummaryItem {
  id: string;
  label: string;
  value: string;
}

export interface FinalConfirmationSummary {
  transactionType: string;
  items: readonly FinalConfirmationSummaryItem[];
}

export type FinalConfirmationSummaryState = 'READY' | 'EMPTY' | 'INVALID';

export interface FinalConfirmationSummaryAnalysis {
  state: FinalConfirmationSummaryState;
  summary: FinalConfirmationSummary | null;
}

const SUMMARY_ITEM_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const NUMERIC_IDENTIFIER_PATTERN = /^\d+(?:-\d+)*$/;
const SENSITIVE_ID_PATTERN =
  /(?:^|-)(?:password|otp|pin)(?:-|$)|(?:^|-)verification-code(?:-|$)/;
const RESIDENT_REGISTRATION_NUMBER_PATTERN = /\b\d{6}-?[1-4]\d{6}\b/;
const MOBILE_PHONE_NUMBER_PATTERN = /\b01[016789][ -]?\d{3,4}[ -]?\d{4}\b/;
const LANDLINE_PHONE_NUMBER_PATTERN =
  /\b(?:02|0[3-6][1-5])[ -]?\d{3,4}[ -]?\d{4}\b/;
const UNMASKED_GROUPED_NUMBER_PATTERN = /\b\d{2,6}(?:-\d{2,6}){2,4}\b/;
const LONG_UNFORMATTED_NUMBER_PATTERN = /\b\d{8,}\b/;
const FORMATTED_WON_AMOUNT_PATTERN = /^\d{1,3}(?:,\d{3})+\s*원$/;
const PERIOD_PATTERN = /^\d+\s*(?:일|개월|년)$/;

function hasLongNumericIdentifier(value: string): boolean {
  return (
    NUMERIC_IDENTIFIER_PATTERN.test(value) &&
    Array.from(value.replace(/-/g, '')).length >= 8
  );
}

function isAllowedFormattedNumericValue(value: string): boolean {
  return (
    FORMATTED_WON_AMOUNT_PATTERN.test(value) || PERIOD_PATTERN.test(value)
  );
}

function containsSensitiveValue(value: string): boolean {
  if (isAllowedFormattedNumericValue(value)) {
    return false;
  }

  return (
    RESIDENT_REGISTRATION_NUMBER_PATTERN.test(value) ||
    MOBILE_PHONE_NUMBER_PATTERN.test(value) ||
    LANDLINE_PHONE_NUMBER_PATTERN.test(value) ||
    UNMASKED_GROUPED_NUMBER_PATTERN.test(value) ||
    LONG_UNFORMATTED_NUMBER_PATTERN.test(value)
  );
}

function cloneNormalizedSummary(
  summary: FinalConfirmationSummary
): FinalConfirmationSummary {
  return {
    transactionType: summary.transactionType.trim(),
    items: summary.items.map((item) => ({
      id: item.id,
      label: item.label.trim(),
      value: item.value.trim()
    }))
  };
}

export function isValidFinalConfirmationSummaryItemId(value: string): boolean {
  return (
    SUMMARY_ITEM_ID_PATTERN.test(value) &&
    !hasLongNumericIdentifier(value) &&
    !SENSITIVE_ID_PATTERN.test(value)
  );
}

export function createFinalConfirmationSummaryItemElementId(
  itemId: string
): string | null {
  return isValidFinalConfirmationSummaryItemId(itemId)
    ? `summary-final-confirmation-${itemId}`
    : null;
}

export function analyzeFinalConfirmationSummary(
  summary: FinalConfirmationSummary
): FinalConfirmationSummaryAnalysis {
  const transactionType = summary.transactionType.trim();

  if (
    transactionType.length === 0 ||
    containsSensitiveValue(transactionType)
  ) {
    return { state: 'INVALID', summary: null };
  }

  if (summary.items.length === 0) {
    return { state: 'EMPTY', summary: null };
  }

  const seenIds = new Set<string>();
  const invalid = summary.items.some((item) => {
    if (
      !isValidFinalConfirmationSummaryItemId(item.id) ||
      seenIds.has(item.id) ||
      item.label.trim().length === 0 ||
      item.value.trim().length === 0 ||
      containsSensitiveValue(item.label.trim()) ||
      containsSensitiveValue(item.value.trim())
    ) {
      return true;
    }

    seenIds.add(item.id);
    return false;
  });

  return invalid
    ? { state: 'INVALID', summary: null }
    : { state: 'READY', summary: cloneNormalizedSummary(summary) };
}

export function canApproveFinalConfirmation(
  summary: FinalConfirmationSummary,
  confirmed: boolean,
  disabled = false,
  isBusy = false,
  approvalRequested = false
): boolean {
  return (
    analyzeFinalConfirmationSummary(summary).state === 'READY' &&
    confirmed &&
    !disabled &&
    !isBusy &&
    !approvalRequested
  );
}
