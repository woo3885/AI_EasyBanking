import { useState, type ChangeEvent } from 'react';

import DemoBankLayout from '../components/DemoBankLayout';
import { ELEMENT_IDS, elementIdentity } from '../constants/element-ids';
import {
  createDepositConditionsPath,
  createDepositProductDetailPath,
  createDepositTermsPath
} from '../constants/routes';
import {
  formatWon,
  type DepositProduct
} from '../data/demo-data';
import { validateDepositAmount } from '../utils/deposit-amount';

interface DepositAmountPageProps {
  product: DepositProduct;
}

export default function DepositAmountPage({
  product
}: DepositAmountPageProps) {
  const [rawAmount, setRawAmount] = useState('');
  const [confirmedMessage, setConfirmedMessage] = useState<string | null>(
    null
  );
  const validation = validateDepositAmount(
    rawAmount,
    product.minimumAmount
  );
  const isValid = validation.state === 'VALID';
  const isInvalid = validation.state !== 'EMPTY' && !isValid;
  const isAmountConfirmed = confirmedMessage !== null;

  const handleAmountChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    setRawAmount(event.target.value);
    setConfirmedMessage(null);
  };

  const handleConfirm = () => {
    if (!isValid || !validation.formattedAmount) {
      return;
    }

    setConfirmedMessage(
      `${validation.formattedAmount}을 가입 금액으로 확인했습니다. 실제 가입은 진행하지 않았습니다.`
    );
  };

  const handleTermsStart = () => {
    if (!isAmountConfirmed) {
      return;
    }

    window.location.assign(createDepositTermsPath(product.id));
  };

  return (
    <DemoBankLayout
      pageId={ELEMENT_IDS.PAGE_DEPOSIT_AMOUNT}
      currentPath={createDepositConditionsPath(product.id)}
      eyebrow="예금 가입 3단계"
      title="가입 금액을 직접 입력해 주세요"
    >
      <p className="page-introduction">
        선택한 데모 상품의 최소 가입 금액을 확인한 뒤 쉼표 없이 숫자로
        입력해 주세요.
      </p>

      <section className="deposit-amount-card" aria-label="선택 상품과 가입 금액">
        <div className="deposit-amount-summary">
          <div>
            <span>선택 상품</span>
            <strong
              {...elementIdentity(
                ELEMENT_IDS.SUMMARY_DEPOSIT_AMOUNT_PRODUCT_NAME
              )}
            >
              {product.name}
            </strong>
          </div>
          <div>
            <span>가입 기간</span>
            <strong>{product.periodLabel}</strong>
          </div>
          <div>
            <span>예시 금리</span>
            <strong>{product.interestRateLabel}</strong>
          </div>
          <div>
            <span>최소 가입 금액</span>
            <strong
              {...elementIdentity(
                ELEMENT_IDS.SUMMARY_DEPOSIT_AMOUNT_MINIMUM
              )}
            >
              {formatWon(product.minimumAmount)}
            </strong>
          </div>
        </div>

        <div className="deposit-amount-field">
          <label htmlFor={ELEMENT_IDS.INPUT_DEPOSIT_AMOUNT}>
            가입 금액
          </label>
          <div className="deposit-amount-input-row">
            <input
              {...elementIdentity(ELEMENT_IDS.INPUT_DEPOSIT_AMOUNT)}
              type="text"
              inputMode="numeric"
              value={rawAmount}
              aria-describedby={
                ELEMENT_IDS.STATUS_DEPOSIT_AMOUNT_VALIDATION
              }
              aria-invalid={isInvalid}
              autoComplete="off"
              onChange={handleAmountChange}
            />
            <span aria-hidden="true">원</span>
          </div>

          <p
            {...elementIdentity(
              ELEMENT_IDS.SUMMARY_DEPOSIT_AMOUNT_FORMATTED
            )}
            className="formatted-amount"
          >
            {validation.formattedAmount
              ? `입력 금액: ${validation.formattedAmount}`
              : '유효한 금액을 입력하면 원화 형식으로 표시됩니다.'}
          </p>

          <p
            {...elementIdentity(
              ELEMENT_IDS.STATUS_DEPOSIT_AMOUNT_VALIDATION
            )}
            className={`amount-validation amount-validation-${validation.state.toLowerCase()}`}
            role="status"
            aria-live="polite"
          >
            {confirmedMessage ?? validation.message}
          </p>
        </div>

        <div className="deposit-amount-actions">
          <button
            {...elementIdentity(
              ELEMENT_IDS.BUTTON_DEPOSIT_PRODUCT_DETAIL_BACK
            )}
            type="button"
            className="secondary-button"
            onClick={() =>
              window.location.assign(
                createDepositProductDetailPath(product.id)
              )
            }
          >
            상품 상세로 돌아가기
          </button>
          <button
            {...elementIdentity(
              ELEMENT_IDS.BUTTON_DEPOSIT_AMOUNT_CONFIRM
            )}
            type="button"
            className="primary-button"
            disabled={!isValid}
            onClick={handleConfirm}
          >
            입력 금액 확인
          </button>
          <button
            {...elementIdentity(ELEMENT_IDS.BUTTON_DEPOSIT_TERMS_START)}
            type="button"
            className="primary-button"
            disabled={!isAmountConfirmed}
            onClick={handleTermsStart}
          >
            약관 확인으로 이동
          </button>
        </div>
      </section>

      <p className="no-transaction-notice">
        입력 금액은 이 화면의 로컬 상태에서만 확인하며 저장하거나
        전송하지 않습니다. 실제 예금 가입과 금융거래는 발생하지 않습니다.
      </p>
    </DemoBankLayout>
  );
}
