import { useState } from 'react';

import DemoBankLayout from '../components/DemoBankLayout';
import { ELEMENT_IDS, elementIdentity } from '../constants/element-ids';
import {
  createDepositProductDetailPath,
  ROUTES
} from '../constants/routes';
import { depositProducts, formatWon } from '../data/demo-data';

export default function DepositProductsPage() {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null
  );
  const selectedProduct = depositProducts.find(
    (product) => product.id === selectedProductId
  );

  const handleNext = () => {
    if (!selectedProductId) {
      return;
    }

    window.location.assign(
      createDepositProductDetailPath(selectedProductId)
    );
  };

  return (
    <DemoBankLayout
      pageId={ELEMENT_IDS.PAGE_DEPOSIT_PRODUCTS}
      currentPath={ROUTES.DEPOSIT_PRODUCTS}
      eyebrow="예금 가입 1단계"
      title="예금 상품을 직접 비교해 주세요"
    >
      <p className="page-introduction">
        금리와 가입 조건을 확인한 뒤 원하는 상품을 직접 선택하는
        화면입니다.
      </p>

      <div className="card-grid">
        {depositProducts.map((product) => {
          const isSelected = selectedProductId === product.id;

          return (
            <article
              {...elementIdentity(product.cardElementId)}
              key={product.id}
              className={`information-card product-card${
                isSelected ? ' information-card-selected' : ''
              }`}
            >
              <div>
                <p className="card-kicker">정기예금</p>
                <h2>{product.name}</h2>
                <p className="card-description">{product.description}</p>
                {isSelected ? (
                  <p className="selection-indicator">
                    현재 선택된 상품
                  </p>
                ) : null}
              </div>

              <dl className="detail-list">
                <div>
                  <dt>가입 기간</dt>
                  <dd>{product.periodLabel}</dd>
                </div>
                <div>
                  <dt>기본 금리</dt>
                  <dd>{product.interestRateLabel}</dd>
                </div>
                <div>
                  <dt>최소 가입 금액</dt>
                  <dd>{formatWon(product.minimumAmount)}</dd>
                </div>
              </dl>

              <button
                {...elementIdentity(product.selectButtonElementId)}
                type="button"
                className="primary-button"
                aria-pressed={isSelected}
                aria-label={`${product.name} 선택`}
                aria-describedby={
                  ELEMENT_IDS.STATUS_SELECTED_DEPOSIT_PRODUCT
                }
                onClick={() => setSelectedProductId(product.id)}
              >
                {isSelected ? '선택됨' : '이 상품 선택'}
              </button>
            </article>
          );
        })}
      </div>

      <p
        {...elementIdentity(
          ELEMENT_IDS.STATUS_SELECTED_DEPOSIT_PRODUCT
        )}
        className="static-notice"
        role="status"
        aria-live="polite"
      >
        {selectedProduct
          ? `${selectedProduct.name}이 선택되었습니다.`
          : '선택된 예금 상품이 없습니다.'}
      </p>

      <div className="next-action-panel">
        <p>
          {selectedProduct
            ? '선택한 상품의 상세 조건을 확인할 수 있습니다.'
            : '다음으로 이동하려면 예금 상품을 먼저 선택해 주세요.'}
        </p>
        <button
          {...elementIdentity(ELEMENT_IDS.BUTTON_DEPOSIT_PRODUCT_NEXT)}
          type="button"
          className="primary-button"
          aria-describedby={
            ELEMENT_IDS.STATUS_SELECTED_DEPOSIT_PRODUCT
          }
          disabled={!selectedProduct}
          onClick={handleNext}
        >
          {selectedProduct
            ? '선택한 상품 상세 보기'
            : '상품 선택 후 다음'}
        </button>
      </div>

      <p className="no-transaction-notice">
        상품 상세와 가입 조건만 확인할 수 있으며 실제 예금 가입은
        진행되지 않습니다.
      </p>
    </DemoBankLayout>
  );
}
