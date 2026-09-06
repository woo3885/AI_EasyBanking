import { useState, type ChangeEvent } from 'react';

import DemoBankLayout from '../components/DemoBankLayout';
import { ELEMENT_IDS, elementIdentity } from '../constants/element-ids';
import {
  createDepositCompletedPath,
  createDepositConfirmationPath,
  createDepositPasswordPath,
  ROUTES
} from '../constants/routes';
import {
  DEMO_DEPOSIT_CONFIRMATION_AMOUNT,
  formatWon,
  type DepositProduct
} from '../data/demo-data';

interface DepositConfirmationPageProps {
  product: DepositProduct;
}

export default function DepositConfirmationPage({
  product
}: DepositConfirmationPageProps) {
  const [confirmed, setConfirmed] = useState(false);

  const handleConfirmationChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    setConfirmed(event.currentTarget.checked);
  };

  return (
    <DemoBankLayout
      pageId={ELEMENT_IDS.PAGE_DEPOSIT_CONFIRMATION}
      currentPath={createDepositConfirmationPath(product.id)}
      eyebrow="예금 가입 6단계"
      title="예금 가입 내용을 최종 확인해 주세요"
    >
      <p className="page-introduction">
        상품과 가입 조건을 확인해 주세요. 최종 승인은 금융길잡이
        화면에서 직접 진행합니다.
      </p>

      <aside
        {...elementIdentity(ELEMENT_IDS.NOTICE_DEPOSIT_CONFIRMATION)}
        className="transfer-confirmation-notice"
        aria-label="예금 최종 확인 데모 안내"
      >
        <h2>실제 금융거래가 아닌 Demo 절차입니다</h2>
        <p>
          표시된 정보는 자동화 연동 확인용 Mock이며 실제 예금 가입, 인증,
          잔액 변경은 발생하지 않습니다.
        </p>
        <p>
          비밀번호와 인증정보는 이 화면의 요약, URL과 DOM 속성에 포함하지
          않습니다.
        </p>
      </aside>

      <section
        className="transfer-confirmation-card"
        aria-labelledby="deposit-confirmation-summary-title"
      >
        <h2 id="deposit-confirmation-summary-title">정기예금 가입 요약</h2>

        <dl
          {...elementIdentity(ELEMENT_IDS.SUMMARY_DEPOSIT_CONFIRMATION)}
          className="transfer-confirmation-summary"
          data-ddd-confirmation-summary="true"
        >
          <div data-ddd-summary-id="product-name">
            <dt>상품명</dt>
            <dd>{product.name}</dd>
          </div>
          <div data-ddd-summary-id="deposit-amount">
            <dt>가입 금액</dt>
            <dd>{formatWon(DEMO_DEPOSIT_CONFIRMATION_AMOUNT)}</dd>
          </div>
          <div data-ddd-summary-id="deposit-period">
            <dt>가입 기간</dt>
            <dd>{product.periodLabel}</dd>
          </div>
        </dl>

        <fieldset className="transfer-final-confirmation-fieldset">
          <legend>사용자 직접 확인</legend>
          <label
            className="transfer-final-confirmation-label"
            htmlFor={ELEMENT_IDS.CHECKBOX_FINAL_CONFIRMATION}
          >
            <input
              {...elementIdentity(ELEMENT_IDS.CHECKBOX_FINAL_CONFIRMATION)}
              type="checkbox"
              checked={confirmed}
              aria-describedby={ELEMENT_IDS.STATUS_DEPOSIT_FINAL_APPROVAL}
              onChange={handleConfirmationChange}
            />
            <span>
              표시된 Demo 예금 가입 내용을 확인했습니다.
            </span>
          </label>
          <p>
            Demo 내부 확인 항목은 최종 승인 버튼의 활성화
            조건이 아닙니다.
          </p>
        </fieldset>

        <p
          {...elementIdentity(ELEMENT_IDS.STATUS_DEPOSIT_FINAL_APPROVAL)}
          className="transfer-final-approval-status"
          role="status"
          aria-live="polite"
        >
          {confirmed
            ? 'Demo 내용을 확인했습니다. 최종 승인은 금융길잡이 화면에서 진행합니다.'
            : '최종 승인은 금융길잡이 화면에서 진행합니다.'}
        </p>

        <div className="transfer-confirmation-actions">
          <button
            {...elementIdentity(
              ELEMENT_IDS.BUTTON_DEPOSIT_CONFIRMATION_BACK
            )}
            type="button"
            className="secondary-button"
            onClick={() =>
              window.location.assign(createDepositPasswordPath(product.id))
            }
          >
            비밀번호 화면으로 돌아가기
          </button>
          <button
            {...elementIdentity(ELEMENT_IDS.BUTTON_FINAL_CANCEL)}
            type="button"
            className="secondary-button"
            onClick={() => window.location.assign(ROUTES.HOME)}
          >
            최종 승인 거절
          </button>
          <button
            {...elementIdentity(ELEMENT_IDS.BUTTON_FINAL_APPROVE)}
            type="button"
            className="primary-button"
            data-ddd-policy="final-confirmation"
            aria-describedby={ELEMENT_IDS.STATUS_DEPOSIT_FINAL_APPROVAL}
            onClick={() =>
              window.location.assign(createDepositCompletedPath(product.id))
            }
          >
            Demo 예금 최종 승인
          </button>
        </div>
      </section>

      <p className="no-transaction-notice">
        최종 승인 버튼은 Demo 완료 안내 화면으로만 이동하며 실제 금융기관
        요청이나 거래를 실행하지 않습니다.
      </p>
    </DemoBankLayout>
  );
}
