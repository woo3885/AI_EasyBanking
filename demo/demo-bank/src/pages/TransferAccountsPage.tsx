import { useState } from 'react';

import DemoBankLayout from '../components/DemoBankLayout';
import { ELEMENT_IDS, elementIdentity } from '../constants/element-ids';
import {
  createTransferRecipientsPath,
  ROUTES
} from '../constants/routes';
import { demoAccounts, formatWon } from '../data/demo-data';

export default function TransferAccountsPage() {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null
  );
  const selectedAccount = demoAccounts.find(
    (account) => account.id === selectedAccountId
  );

  const handleNext = () => {
    if (!selectedAccountId) {
      return;
    }

    window.location.assign(
      createTransferRecipientsPath(selectedAccountId)
    );
  };

  return (
    <DemoBankLayout
      pageId={ELEMENT_IDS.PAGE_TRANSFER_ACCOUNTS}
      currentPath={ROUTES.TRANSFER_ACCOUNTS}
      eyebrow="계좌이체 1단계"
      title="출금 계좌를 직접 확인해 주세요"
    >
      <p className="page-introduction">
        계좌번호는 마스킹된 값만 표시하며 출금 계좌를 직접 선택할 수
        있습니다.
      </p>

      <div className="card-grid">
        {demoAccounts.map((account) => {
          const isSelected = selectedAccountId === account.id;

          return (
            <article
              {...elementIdentity(account.cardElementId)}
              key={account.id}
              className={`information-card account-card${
                isSelected ? ' information-card-selected' : ''
              }`}
            >
              <div>
                <p className="card-kicker">{account.bankName}</p>
                <h2>{account.label}</h2>
                <p className="masked-account-number">
                  {account.maskedAccountNumber}
                </p>
                {isSelected ? (
                  <p className="selection-indicator">
                    현재 선택된 계좌
                  </p>
                ) : null}
              </div>

              <dl className="detail-list">
                <div>
                  <dt>은행명</dt>
                  <dd>{account.bankName}</dd>
                </div>
                <div>
                  <dt>출금 가능 잔액</dt>
                  <dd>{formatWon(account.balance)}</dd>
                </div>
              </dl>

              <button
                {...elementIdentity(account.selectButtonElementId)}
                type="button"
                className="primary-button"
                aria-pressed={isSelected}
                aria-describedby={
                  ELEMENT_IDS.STATUS_SELECTED_TRANSFER_ACCOUNT
                }
                onClick={() => setSelectedAccountId(account.id)}
              >
                {isSelected ? '선택됨' : '이 계좌 선택'}
              </button>
            </article>
          );
        })}
      </div>

      <p
        {...elementIdentity(
          ELEMENT_IDS.STATUS_SELECTED_TRANSFER_ACCOUNT
        )}
        className="static-notice"
        role="status"
        aria-live="polite"
      >
        {selectedAccount
          ? `${selectedAccount.label}가 선택되었습니다.`
          : '선택된 출금 계좌가 없습니다.'}
      </p>

      <div className="next-action-panel">
        <p>
          {selectedAccount
            ? '선택한 출금 계좌로 수취인 후보를 확인할 수 있습니다.'
            : '다음으로 이동하려면 출금 계좌를 먼저 선택해 주세요.'}
        </p>
        <button
          {...elementIdentity(ELEMENT_IDS.BUTTON_TRANSFER_ACCOUNT_NEXT)}
          type="button"
          className="primary-button"
          aria-describedby={
            ELEMENT_IDS.STATUS_SELECTED_TRANSFER_ACCOUNT
          }
          disabled={!selectedAccount}
          onClick={handleNext}
        >
          {selectedAccount
            ? '수취인 선택으로 이동'
            : '출금 계좌 선택 후 다음'}
        </button>
      </div>

      <p className="no-transaction-notice">
        수취인 선택까지 확인할 수 있으며 실제 계좌이체는 진행되지
        않습니다.
      </p>
    </DemoBankLayout>
  );
}
