import { useState } from 'react';

import DemoBankLayout from '../components/DemoBankLayout';
import { ELEMENT_IDS, elementIdentity } from '../constants/element-ids';
import {
  createTransferAmountPath,
  createTransferRecipientsPath,
  ROUTES
} from '../constants/routes';
import type { DemoAccount } from '../data/demo-data';
import { transferRecipients } from '../data/transfer-recipients';

interface TransferRecipientsPageProps {
  account: DemoAccount;
}

export default function TransferRecipientsPage({
  account
}: TransferRecipientsPageProps) {
  const [selectedRecipientId, setSelectedRecipientId] = useState<
    string | null
  >(null);
  const [confirmationMessage, setConfirmationMessage] = useState<
    string | null
  >(null);
  const [confirmedRecipientId, setConfirmedRecipientId] = useState<
    string | null
  >(null);
  const selectedRecipient = transferRecipients.find(
    (recipient) => recipient.id === selectedRecipientId
  );
  const isRecipientConfirmed =
    selectedRecipientId !== null &&
    confirmedRecipientId === selectedRecipientId;

  const handleRecipientSelect = (recipientId: string) => {
    if (recipientId === selectedRecipientId) {
      return;
    }

    setSelectedRecipientId(recipientId);
    setConfirmationMessage(null);
    setConfirmedRecipientId(null);
  };

  const handleConfirm = () => {
    if (!selectedRecipient) {
      return;
    }

    setConfirmedRecipientId(selectedRecipient.id);
    setConfirmationMessage(
      `${selectedRecipient.displayName} 수취인 선택을 확인했습니다. 실제 송금은 진행되지 않으며 이체 금액 입력은 후속 단계입니다.`
    );
  };

  const handleAmountStart = () => {
    if (!isRecipientConfirmed || !confirmedRecipientId) {
      return;
    }

    window.location.assign(
      createTransferAmountPath(account.id, confirmedRecipientId)
    );
  };

  return (
    <DemoBankLayout
      pageId={ELEMENT_IDS.PAGE_TRANSFER_RECIPIENTS}
      currentPath={createTransferRecipientsPath(account.id)}
      eyebrow="계좌이체 2단계"
      title="수취인을 직접 확인해 주세요"
    >
      <p className="page-introduction">
        아래 후보는 실제 고객이 아닌 데모용 Mock 정보입니다. 이름과 구분
        정보를 확인한 뒤 수취인을 직접 선택해 주세요.
      </p>

      <section
        {...elementIdentity(ELEMENT_IDS.SUMMARY_TRANSFER_SOURCE_ACCOUNT)}
        className="transfer-source-summary"
        aria-label="URL에서 확인된 Mock 출금 계좌"
      >
        <span>URL에서 확인된 Mock 출금 계좌</span>
        <strong>{account.label}</strong>
        <span>{account.bankName}</span>
        <span className="masked-account-number">
          {account.maskedAccountNumber}
        </span>
      </section>

      <section aria-labelledby="transfer-recipient-list-title">
        <h2 id="transfer-recipient-list-title" className="recipient-list-title">
          수취인 후보
        </h2>
        <ul className="recipient-list">
          {transferRecipients.map((recipient) => {
            const isSelected = recipient.id === selectedRecipientId;

            return (
              <li key={recipient.id} className="recipient-list-item">
                <article
                  {...elementIdentity(recipient.cardElementId)}
                  className={`information-card recipient-card${
                    isSelected ? ' information-card-selected' : ''
                  }`}
                >
                  <div>
                    <p className="card-kicker">
                      {recipient.relationshipLabel}
                    </p>
                    <h3>{recipient.displayName}</h3>
                    {isSelected ? (
                      <p className="selection-indicator">
                        현재 선택된 수취인
                      </p>
                    ) : null}
                  </div>

                  <dl className="detail-list">
                    <div>
                      <dt>은행</dt>
                      <dd>{recipient.bankLabel}</dd>
                    </div>
                    <div>
                      <dt>Mock 계좌 정보</dt>
                      <dd>{recipient.maskedAccountLabel}</dd>
                    </div>
                  </dl>

                  <button
                    {...elementIdentity(recipient.selectButtonElementId)}
                    type="button"
                    className="primary-button"
                    aria-pressed={isSelected}
                    aria-describedby={
                      ELEMENT_IDS.STATUS_SELECTED_TRANSFER_RECIPIENT
                    }
                    onClick={() => handleRecipientSelect(recipient.id)}
                  >
                    {isSelected ? '선택됨' : '이 수취인 선택'}
                  </button>
                </article>
              </li>
            );
          })}
        </ul>
      </section>

      <p
        {...elementIdentity(
          ELEMENT_IDS.STATUS_SELECTED_TRANSFER_RECIPIENT
        )}
        className="recipient-selection-status"
        role="status"
        aria-live="polite"
      >
        {selectedRecipient
          ? `${selectedRecipient.displayName} 수취인이 선택되었습니다.`
          : '선택된 수취인이 없습니다.'}
      </p>

      <p
        {...elementIdentity(
          ELEMENT_IDS.STATUS_CONFIRMED_TRANSFER_RECIPIENT
        )}
        className="recipient-confirmation-status"
        role="status"
        aria-live="polite"
        aria-label="수취인 확인 상태"
      >
        {confirmationMessage ?? ''}
      </p>

      <div className="transfer-recipient-actions">
        <button
          {...elementIdentity(ELEMENT_IDS.BUTTON_TRANSFER_ACCOUNT_BACK)}
          type="button"
          className="secondary-button"
          onClick={() => window.location.assign(ROUTES.TRANSFER_ACCOUNTS)}
        >
          출금 계좌 목록으로 돌아가기
        </button>
        <button
          {...elementIdentity(
            ELEMENT_IDS.BUTTON_TRANSFER_RECIPIENT_CONFIRM
          )}
          type="button"
          className="primary-button"
          disabled={!selectedRecipient}
          onClick={handleConfirm}
        >
          수취인 선택 확인
        </button>
        <button
          {...elementIdentity(ELEMENT_IDS.BUTTON_TRANSFER_AMOUNT_START)}
          type="button"
          className="primary-button"
          disabled={!isRecipientConfirmed}
          aria-describedby={
            ELEMENT_IDS.STATUS_CONFIRMED_TRANSFER_RECIPIENT
          }
          onClick={handleAmountStart}
        >
          이체 금액 입력하기
        </button>
      </div>

      <p className="no-transaction-notice">
        이 화면에서는 수취인 선택만 로컬로 확인합니다. 이체 금액 입력과
        실제 송금은 진행하지 않습니다.
      </p>
    </DemoBankLayout>
  );
}
