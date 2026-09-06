import DemoBankLayout from '../components/DemoBankLayout';
import { ELEMENT_IDS, elementIdentity } from '../constants/element-ids';
import { ROUTES } from '../constants/routes';

export default function HomePage() {
  return (
    <DemoBankLayout
      pageId={ELEMENT_IDS.PAGE_HOME}
      currentPath={ROUTES.HOME}
      eyebrow="데모 업무 선택"
      title="안전하게 시작하는 금융 업무"
    >
      <p className="page-introduction">
        원하는 업무를 직접 선택해 주세요.
      </p>

      <div className="card-grid home-action-grid">
        <section className="information-card">
          <p className="card-kicker">예금</p>
          <h2>예금 가입</h2>
          <p>
            예금 상품의 기간, 금리와 최소 가입 금액을 비교하는 정적
            화면을 확인합니다.
          </p>
          <button
            {...elementIdentity(ELEMENT_IDS.BUTTON_START_DEPOSIT)}
            type="button"
            className="primary-button"
            onClick={() => window.location.assign(ROUTES.DEPOSIT_PRODUCTS)}
          >
            예금 가입 시작
          </button>
        </section>

        <section className="information-card">
          <p className="card-kicker">계좌이체</p>
          <h2>계좌이체</h2>
          <p>
            마스킹된 계좌 정보와 잔액을 확인하는 정적 화면을
            살펴봅니다.
          </p>
          <button
            {...elementIdentity(ELEMENT_IDS.BUTTON_START_TRANSFER)}
            type="button"
            className="primary-button"
            onClick={() => window.location.assign(ROUTES.TRANSFER_ACCOUNTS)}
          >
            계좌이체 시작
          </button>
        </section>
      </div>
    </DemoBankLayout>
  );
}
