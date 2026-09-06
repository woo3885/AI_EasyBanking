import type {
  DetectedTerm,
  TermsAgreementResult,
} from "./termsAgreement.types.js";

/**
 * 탐지된 약관 목록을 A팀 약관 UI에서 사용할 수 있는
 * TERMS_AGREEMENT 결과로 변환합니다.
 */
export function createTermsAgreementResult(
  terms: DetectedTerm[],
): TermsAgreementResult {
  const requiredTerms = terms.filter(
    (term) => term.requirement === "REQUIRED",
  );

  const optionalTerms = terms.filter(
    (term) => term.requirement === "OPTIONAL",
  );

  const unknownTerms = terms.filter(
    (term) => term.requirement === "UNKNOWN",
  );

  const allRequiredAgreed =
    requiredTerms.length > 0 &&
    requiredTerms.every((term) => term.checked);

  const detected = terms.length > 0;

  let message: string;

  if (!detected) {
    message =
      "현재 화면에서 약관 항목을 찾지 못했어요.";
  } else if (allRequiredAgreed) {
    message =
      "필수 약관에 모두 동의했어요. 선택 약관은 원하는 항목만 고르세요.";
  } else {
    message =
      "필수 약관 내용을 확인하고 직접 동의해 주세요.";
  }

  const summary = detected
    ? `필수 ${requiredTerms.length}개, 선택 ${optionalTerms.length}개, 확인 필요 ${unknownTerms.length}개가 있어요.`
    : "확인할 약관이 없어요.";

  return {
    decisionType: "TERMS_AGREEMENT",

    detected,
    requiresUserAction: detected,

    requiredTerms,
    optionalTerms,
    unknownTerms,

    allRequiredAgreed,

    message,
    summary,
  };
}

/**
 * 테스트 및 연동 확인용 JSON 출력 함수입니다.
 */
export function stringifyTermsAgreementResult(
  result: TermsAgreementResult,
): string {
  return JSON.stringify(result, null, 2);
}