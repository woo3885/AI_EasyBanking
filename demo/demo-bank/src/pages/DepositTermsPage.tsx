import { useState } from 'react';

import DemoBankLayout from '../components/DemoBankLayout';
import { ELEMENT_IDS, elementIdentity } from '../constants/element-ids';
import {
  createDepositConditionsPath,
  createDepositPasswordPath,
  createDepositTermsPath
} from '../constants/routes';
import type { DepositProduct } from '../data/demo-data';
import { depositTerms } from '../data/deposit-terms';
import {
  getDepositTermsSelectionSummary,
  toggleDepositTermSelection
} from '../utils/deposit-terms';

interface DepositTermsPageProps {
  product: DepositProduct;
}

export default function DepositTermsPage({
  product
}: DepositTermsPageProps) {
  const [selectedTermIds, setSelectedTermIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [confirmationMessage, setConfirmationMessage] = useState<
    string | null
  >(null);
  const [termsSelectionConfirmed, setTermsSelectionConfirmed] =
    useState(false);
  const selectionSummary = getDepositTermsSelectionSummary(
    depositTerms,
    selectedTermIds
  );

  const handleTermToggle = (termId: string) => {
    setSelectedTermIds((previousTermIds) =>
      toggleDepositTermSelection(previousTermIds, termId)
    );
    setConfirmationMessage(null);
    setTermsSelectionConfirmed(false);
  };

  const handleConfirm = () => {
    if (!selectionSummary.allRequiredSelected) {
      return;
    }

    const optionalSelectionMessage =
      selectionSummary.selectedOptionalCount > 0
        ? '선택 약관도 선택했습니다.'
        : '선택 약관은 선택하지 않았습니다.';

    setConfirmationMessage(
      `필수 약관 선택을 확인했습니다. ${optionalSelectionMessage} 실제 예금 가입은 진행되지 않았습니다. 보안 입력 화면으로 이동하려면 다음 버튼을 눌러 주세요.`
    );
    setTermsSelectionConfirmed(true);
  };

  const handlePasswordStart = () => {
    if (
      !selectionSummary.allRequiredSelected ||
      !termsSelectionConfirmed
    ) {
      return;
    }

    window.location.assign(createDepositPasswordPath(product.id));
  };

  const selectionMessage = selectionSummary.allRequiredSelected
    ? `필수 약관 ${selectionSummary.requiredTermCount}개를 모두 선택했습니다. 선택 약관 ${selectionSummary.optionalTermCount}개 중 ${selectionSummary.selectedOptionalCount}개를 선택했습니다.`
    : `필수 약관 ${selectionSummary.requiredTermCount}개 중 ${selectionSummary.selectedRequiredCount}개를 선택했습니다. 필수 약관을 모두 선택해 주세요.`;

  return (
    <DemoBankLayout
      pageId={ELEMENT_IDS.PAGE_DEPOSIT_TERMS}
      currentPath={createDepositTermsPath(product.id)}
      eyebrow="예금 가입 4단계"
      title="예금 약관을 직접 선택해 주세요"
    >
      <p className="page-introduction">
        아래 내용은 데모 흐름 검증을 위한 Mock 요약입니다. 실제 금융기관의
        법률 약관이 아닙니다.
      </p>

      <section className="deposit-terms-card" aria-label="선택 상품과 예금 약관">
        <div className="deposit-terms-product-summary">
          <span>선택 상품</span>
          <strong
            {...elementIdentity(
              ELEMENT_IDS.SUMMARY_DEPOSIT_TERMS_PRODUCT_NAME
            )}
          >
            {product.name}
          </strong>
          <span>가입 기간</span>
          <strong>{product.periodLabel}</strong>
        </div>

        <fieldset className="deposit-terms-fieldset">
          <legend>약관별 동의 여부</legend>
          <p className="deposit-terms-instruction">
            전체 동의 기능은 제공하지 않습니다. 각 약관을 확인하고 직접
            선택해 주세요.
          </p>

          <div className="deposit-terms-list">
            {depositTerms.map((term) => (
              <div
                key={term.id}
                {...elementIdentity(term.itemElementId)}
                className="deposit-term-item"
              >
                <label
                  htmlFor={term.checkboxElementId}
                  className="deposit-term-label"
                >
                  <input
                    {...elementIdentity(term.checkboxElementId)}
                    type="checkbox"
                    checked={selectedTermIds.has(term.id)}
                    required={term.required}
                    onChange={() => handleTermToggle(term.id)}
                  />
                  <span className="deposit-term-copy">
                    <span className="deposit-term-heading">
                      <span
                        className={`deposit-term-badge ${
                          term.required
                            ? 'deposit-term-badge-required'
                            : 'deposit-term-badge-optional'
                        }`}
                      >
                        {term.required ? '필수' : '선택'}
                      </span>
                      <strong>{term.label}</strong>
                    </span>
                    <span className="deposit-term-summary">{term.summary}</span>
                  </span>
                </label>
              </div>
            ))}
          </div>
        </fieldset>

        <p
          {...elementIdentity(ELEMENT_IDS.STATUS_DEPOSIT_TERMS_SELECTION)}
          className="deposit-terms-status"
          role="status"
          aria-live="polite"
        >
          {selectionMessage}
        </p>

        <p
          {...elementIdentity(ELEMENT_IDS.STATUS_DEPOSIT_TERMS_CONFIRMATION)}
          className="deposit-terms-confirmation"
          role="status"
          aria-live="polite"
        >
          {confirmationMessage ?? '약관 선택 확인 전입니다.'}
        </p>

        <div className="deposit-terms-actions">
          <button
            {...elementIdentity(ELEMENT_IDS.BUTTON_DEPOSIT_AMOUNT_BACK)}
            type="button"
            className="secondary-button"
            onClick={() =>
              window.location.assign(
                createDepositConditionsPath(product.id)
              )
            }
          >
            가입 금액 입력으로 돌아가기
          </button>
          <button
            {...elementIdentity(ELEMENT_IDS.BUTTON_DEPOSIT_TERMS_CONFIRM)}
            type="button"
            className="primary-button"
            disabled={!selectionSummary.allRequiredSelected}
            onClick={handleConfirm}
          >
            약관 선택 확인
          </button>
          <button
            {...elementIdentity(ELEMENT_IDS.BUTTON_DEPOSIT_TERMS_NEXT)}
            type="button"
            className="primary-button"
            disabled={
              !selectionSummary.allRequiredSelected ||
              !termsSelectionConfirmed
            }
            aria-describedby={
              ELEMENT_IDS.STATUS_DEPOSIT_TERMS_CONFIRMATION
            }
            onClick={handlePasswordStart}
          >
            비밀번호 입력으로 이동
          </button>
        </div>
      </section>

      <p className="no-transaction-notice">
        약관 선택은 이 화면의 로컬 상태에서만 확인합니다. 실제 예금 가입과
        보안 입력 화면으로 이동해도 실제 인증이나 예금 가입은 진행하지
        않습니다.
      </p>
    </DemoBankLayout>
  );
}
