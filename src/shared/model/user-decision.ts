export interface UserDecisionOption {
  /** 공개 가능하고 민감정보를 포함하지 않는 UI 식별자 */
  id: string;
  /** 사용자에게 표시하도록 정제된 문자열 */
  label: string;
  /** D15 프론트 표현용 선택 설명이며 현재 transport 확정 필드가 아니다. */
  description?: string;
  /** D15 프론트 표현용 비활성 상태이며 현재 transport 확정 필드가 아니다. */
  disabled?: boolean;
}

export type UserDecisionOptionsState = 'READY' | 'EMPTY' | 'INVALID';

export interface UserDecisionOptionsAnalysis {
  state: UserDecisionOptionsState;
  options: UserDecisionOption[];
}

const USER_DECISION_OPTION_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const NUMERIC_IDENTIFIER_PATTERN = /^\d+(?:-\d+)*$/;

function looksLikeSensitiveNumericIdentifier(value: string): boolean {
  return (
    NUMERIC_IDENTIFIER_PATTERN.test(value) &&
    Array.from(value.replace(/-/g, '')).length >= 8
  );
}

function cloneOptions(
  options: readonly UserDecisionOption[]
): UserDecisionOption[] {
  return options.map((option) => ({ ...option }));
}

export function isValidUserDecisionOptionId(value: string): boolean {
  return (
    USER_DECISION_OPTION_ID_PATTERN.test(value) &&
    !looksLikeSensitiveNumericIdentifier(value)
  );
}

export function createUserDecisionOptionElementId(
  optionId: string
): string | null {
  return isValidUserDecisionOptionId(optionId)
    ? `option-user-decision-${optionId}`
    : null;
}

export function analyzeUserDecisionOptions(
  options: readonly UserDecisionOption[]
): UserDecisionOptionsAnalysis {
  if (options.length === 0) {
    return { state: 'EMPTY', options: [] };
  }

  const seenIds = new Set<string>();
  const isInvalid = options.some((option) => {
    if (
      !isValidUserDecisionOptionId(option.id) ||
      option.label.trim().length === 0 ||
      seenIds.has(option.id)
    ) {
      return true;
    }

    seenIds.add(option.id);
    return false;
  });

  return isInvalid
    ? { state: 'INVALID', options: [] }
    : { state: 'READY', options: cloneOptions(options) };
}

export function getSelectedUserDecisionOption(
  options: readonly UserDecisionOption[],
  selectedOptionId: string | null
): UserDecisionOption | null {
  if (selectedOptionId === null) {
    return null;
  }

  const analysis = analyzeUserDecisionOptions(options);
  if (analysis.state !== 'READY') {
    return null;
  }

  const selectedOption = analysis.options.find(
    (option) => option.id === selectedOptionId && !option.disabled
  );

  return selectedOption ? { ...selectedOption } : null;
}

export function canConfirmUserDecision(
  options: readonly UserDecisionOption[],
  selectedOptionId: string | null,
  disabled = false,
  isBusy = false
): boolean {
  return (
    !disabled &&
    !isBusy &&
    getSelectedUserDecisionOption(options, selectedOptionId) !== null
  );
}
