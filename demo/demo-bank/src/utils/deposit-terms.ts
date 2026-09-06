import type { DepositTerm } from '../data/deposit-terms';

export interface DepositTermsSelectionSummary {
  requiredTermIds: string[];
  selectedRequiredCount: number;
  requiredTermCount: number;
  selectedOptionalCount: number;
  optionalTermCount: number;
  allRequiredSelected: boolean;
}

export function toggleDepositTermSelection(
  selectedTermIds: ReadonlySet<string>,
  termId: string
): Set<string> {
  const nextSelectedTermIds = new Set(selectedTermIds);

  if (nextSelectedTermIds.has(termId)) {
    nextSelectedTermIds.delete(termId);
  } else {
    nextSelectedTermIds.add(termId);
  }

  return nextSelectedTermIds;
}

export function getDepositTermsSelectionSummary(
  terms: readonly DepositTerm[],
  selectedTermIds: ReadonlySet<string>
): DepositTermsSelectionSummary {
  const requiredTerms = terms.filter((term) => term.required);
  const optionalTerms = terms.filter((term) => !term.required);
  const requiredTermIds = requiredTerms.map((term) => term.id);
  const selectedRequiredCount = requiredTerms.filter((term) =>
    selectedTermIds.has(term.id)
  ).length;
  const selectedOptionalCount = optionalTerms.filter((term) =>
    selectedTermIds.has(term.id)
  ).length;

  return {
    requiredTermIds,
    selectedRequiredCount,
    requiredTermCount: requiredTerms.length,
    selectedOptionalCount,
    optionalTermCount: optionalTerms.length,
    allRequiredSelected: requiredTermIds.every((termId) =>
      selectedTermIds.has(termId)
    )
  };
}
