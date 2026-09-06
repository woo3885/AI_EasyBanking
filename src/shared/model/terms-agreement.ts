export interface AgreementTerm {
  id: string;
  label: string;
  required: boolean;
  description?: string;
  disabled?: boolean;
}

export type TermsAgreementListState = 'READY' | 'EMPTY' | 'INVALID';

export interface TermsAgreementAnalysis {
  state: TermsAgreementListState;
  terms: AgreementTerm[];
}

const AGREEMENT_TERM_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const NUMERIC_IDENTIFIER_PATTERN = /^\d+(?:-\d+)*$/;

function looksLikeSensitiveNumericIdentifier(value: string): boolean {
  return (
    NUMERIC_IDENTIFIER_PATTERN.test(value) &&
    Array.from(value.replace(/-/g, '')).length >= 8
  );
}

function cloneTerms(terms: readonly AgreementTerm[]): AgreementTerm[] {
  return terms.map((term) => ({ ...term }));
}

export function isValidAgreementTermId(value: string): boolean {
  return (
    AGREEMENT_TERM_ID_PATTERN.test(value) &&
    !looksLikeSensitiveNumericIdentifier(value)
  );
}

export function createAgreementTermElementId(termId: string): string | null {
  return isValidAgreementTermId(termId)
    ? `term-user-agreement-${termId}`
    : null;
}

export function analyzeAgreementTerms(
  terms: readonly AgreementTerm[]
): TermsAgreementAnalysis {
  if (terms.length === 0) {
    return { state: 'EMPTY', terms: [] };
  }

  const seenIds = new Set<string>();
  const isInvalid = terms.some((term) => {
    if (
      !isValidAgreementTermId(term.id) ||
      term.label.trim().length === 0 ||
      seenIds.has(term.id)
    ) {
      return true;
    }

    seenIds.add(term.id);
    return false;
  });

  return isInvalid
    ? { state: 'INVALID', terms: [] }
    : { state: 'READY', terms: cloneTerms(terms) };
}

export function getRequiredAgreementTermIds(
  terms: readonly AgreementTerm[]
): readonly string[] {
  const analysis = analyzeAgreementTerms(terms);
  if (analysis.state !== 'READY') {
    return [];
  }

  return analysis.terms
    .filter((term) => term.required)
    .map((term) => term.id);
}

export function getKnownSelectedAgreementTermIds(
  terms: readonly AgreementTerm[],
  selectedTermIds: ReadonlySet<string>
): readonly string[] {
  const analysis = analyzeAgreementTerms(terms);
  if (analysis.state !== 'READY') {
    return [];
  }

  return analysis.terms
    .filter((term) => !term.disabled && selectedTermIds.has(term.id))
    .map((term) => term.id);
}

export function hasUnknownSelectedAgreementTermId(
  terms: readonly AgreementTerm[],
  selectedTermIds: ReadonlySet<string>
): boolean {
  const knownIds = new Set(terms.map((term) => term.id));
  return Array.from(selectedTermIds).some((termId) => !knownIds.has(termId));
}

export function areAllRequiredAgreementTermsSelected(
  terms: readonly AgreementTerm[],
  selectedTermIds: ReadonlySet<string>
): boolean {
  const analysis = analyzeAgreementTerms(terms);
  if (analysis.state !== 'READY') {
    return false;
  }

  const requiredTerms = analysis.terms.filter((term) => term.required);
  return (
    requiredTerms.every((term) => !term.disabled) &&
    requiredTerms.every((term) => selectedTermIds.has(term.id))
  );
}

export function canConfirmTermsAgreement(
  terms: readonly AgreementTerm[],
  selectedTermIds: ReadonlySet<string>,
  disabled = false,
  isBusy = false
): boolean {
  const analysis = analyzeAgreementTerms(terms);

  return (
    analysis.state === 'READY' &&
    !disabled &&
    !isBusy &&
    !hasUnknownSelectedAgreementTermId(terms, selectedTermIds) &&
    areAllRequiredAgreementTermsSelected(terms, selectedTermIds)
  );
}

export function createTermsAgreementConfirmPayload(
  terms: readonly AgreementTerm[],
  selectedTermIds: ReadonlySet<string>
): readonly string[] | null {
  if (!canConfirmTermsAgreement(terms, selectedTermIds)) {
    return null;
  }

  return [...getKnownSelectedAgreementTermIds(terms, selectedTermIds)];
}
