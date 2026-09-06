import DemoBankLayout from '../components/DemoBankLayout';
import { ELEMENT_IDS, elementIdentity } from '../constants/element-ids';
import {
  createTransferCompletedPath,
  ROUTES
} from '../constants/routes';
import type { DemoAccount } from '../data/demo-data';
import type { TransferRecipient } from '../data/transfer-recipients';

interface TransferCompletionPageProps {
  account: DemoAccount;
  recipient: TransferRecipient;
}

export default function TransferCompletionPage({
  account,
  recipient
}: TransferCompletionPageProps) {
  return (
    <DemoBankLayout
      pageId={ELEMENT_IDS.PAGE_TRANSFER_COMPLETION}
      currentPath={createTransferCompletedPath(account.id, recipient.id)}
      eyebrow="계좌이체 7단계"
      title="데모 이체 안내 흐름을 마쳤습니다"
    >
      <p className="page-introduction">
        사용자 승인 UI 절차를 확인하기 위한 데모 결과입니다. 실제 금융
        거래 결과가 아닙니다.
      </p>

      <aside
        {...elementIdentity(ELEMENT_IDS.NOTICE_TRANSFER_NO_TRANSACTION)}
        className="transfer-completion-notice"
        aria-label="실제 거래 미실행 안내"
      >
        <h2>실제 송금은 발생하지 않았습니다</h2>
        <p>
          정상 URL 직접 접근은 화면·DOM 계약 확인용입니다. URL은 이전
          checkbox 선택, 사용자 승인, 비밀번호 또는 OTP 인증 완료를
          증명하지 않습니다.
        </p>
        <p>
          금액은 이 화면으로 전달되지 않았으며 실제 잔액 변경, 거래 결과와
          거래번호도 없습니다.
        </p>
      </aside>

      <section
        className="transfer-completion-card"
        aria-labelledby="transfer-completion-summary-title"
      >
        <h2 id="transfer-completion-summary-title">데모 흐름 문맥</h2>
        <dl className="transfer-completion-summary">
          <div
            {...elementIdentity(
              ELEMENT_IDS.SUMMARY_TRANSFER_COMPLETION_SOURCE_ACCOUNT
            )}
          >
            <dt>Mock 출금 계좌</dt>
            <dd>
              <strong>{account.label}</strong>
              <span>{account.bankName}</span>
              <span className="masked-account-number">
                {account.maskedAccountNumber}
              </span>
            </dd>
          </div>
          <div
            {...elementIdentity(
              ELEMENT_IDS.SUMMARY_TRANSFER_COMPLETION_RECIPIENT
            )}
          >
            <dt>Mock 수취인</dt>
            <dd>
              <strong>{recipient.displayName}</strong>
              <span>{recipient.relationshipLabel}</span>
              <span>{recipient.bankLabel}</span>
              <span>{recipient.maskedAccountLabel}</span>
            </dd>
          </div>
        </dl>

        <p
          {...elementIdentity(
            ELEMENT_IDS.STATUS_TRANSFER_DEMO_COMPLETION
          )}
          className="transfer-demo-completion-status"
          role="status"
          aria-live="polite"
        >
          데모 계좌이체 안내 흐름과 사용자 승인 UI 확인 절차를 마쳤습니다.
          실제 송금과 잔액 변경은 발생하지 않았고 실제 인증 결과나
          거래번호도 없습니다.
        </p>

        <div className="transfer-completion-actions">
          <button
            {...elementIdentity(ELEMENT_IDS.BUTTON_TRANSFER_HOME)}
            type="button"
            className="primary-button"
            onClick={() => window.location.assign(ROUTES.HOME)}
          >
            데모 메인으로 돌아가기
          </button>
        </div>
      </section>
    </DemoBankLayout>
  );
}
