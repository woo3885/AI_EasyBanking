import DemoBankLayout from '../components/DemoBankLayout';
import { ELEMENT_IDS, elementIdentity } from '../constants/element-ids';
import { createDepositCompletedPath, ROUTES } from '../constants/routes';
import type { DepositProduct } from '../data/demo-data';

interface DepositCompletionPageProps {
  product: DepositProduct;
}

export default function DepositCompletionPage({
  product
}: DepositCompletionPageProps) {
  return (
    <DemoBankLayout
      pageId={ELEMENT_IDS.PAGE_DEPOSIT_COMPLETION}
      currentPath={createDepositCompletedPath(product.id)}
      eyebrow="예금 가입 Demo 종료"
      title="Demo 예금 가입 절차가 끝났습니다"
    >
      <section
        className="transfer-completion-card"
        aria-labelledby="deposit-completion-title"
      >
        <h2 id="deposit-completion-title">Demo 절차 확인 결과</h2>
        <p
          {...elementIdentity(ELEMENT_IDS.STATUS_DEPOSIT_DEMO_COMPLETION)}
          className="transfer-demo-completion-status"
          role="status"
          aria-live="polite"
        >
          {product.name}의 사용자 최종 확인 절차를 마쳤습니다.
        </p>
        <aside
          {...elementIdentity(ELEMENT_IDS.NOTICE_DEPOSIT_NO_TRANSACTION)}
          className="transfer-completion-notice"
          aria-label="실제 거래 미실행 안내"
        >
          <strong>실제 금융기관 가입 완료가 아닙니다.</strong>
          <p>
            실제 예금 가입, 인증, 계좌 잔액 변경, 금융기관 처리는 발생하지
            않았습니다.
          </p>
        </aside>
        <div className="transfer-completion-actions">
          <button
            {...elementIdentity(ELEMENT_IDS.BUTTON_DEPOSIT_HOME)}
            type="button"
            className="primary-button"
            onClick={() => window.location.assign(ROUTES.HOME)}
          >
            Demo 메인으로 돌아가기
          </button>
        </div>
      </section>
    </DemoBankLayout>
  );
}
