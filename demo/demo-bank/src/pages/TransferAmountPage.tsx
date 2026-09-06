import { useState, type ChangeEvent } from 'react';

import DemoBankLayout from '../components/DemoBankLayout';
import { ELEMENT_IDS, elementIdentity } from '../constants/element-ids';
import {
  createTransferAmountPath,
  createTransferPasswordPath,
  createTransferRecipientsPath
} from '../constants/routes';
import { formatWon, type DemoAccount } from '../data/demo-data';
import type { TransferRecipient } from '../data/transfer-recipients';
import { validateTransferAmount } from '../utils/transfer-amount';

interface TransferAmountPageProps {
  account: DemoAccount;
  recipient: TransferRecipient;
}

export default function TransferAmountPage({
  account,
  recipient
}: TransferAmountPageProps) {
  const [rawAmount, setRawAmount] = useState('');
  const [confirmedMessage, setConfirmedMessage] = useState<
    string | null
  >(null);
  const [confirmedAmount, setConfirmedAmount] = useState<number | null>(
    null
  );
  const validation = validateTransferAmount(rawAmount, account.balance);
  const isValid = validation.state === 'VALID';
  const isInvalid = validation.state !== 'EMPTY' && !isValid;
  const isAmountConfirmed =
    isValid &&
    validation.parsedAmount !== null &&
    confirmedAmount === validation.parsedAmount;

  const handleAmountChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    setRawAmount(event.target.value);
    setConfirmedMessage(null);
    setConfirmedAmount(null);
  };

  const handleConfirm = () => {
    if (!isValid || validation.parsedAmount === null) {
      return;
    }

    setConfirmedMessage(
      `${formatWon(validation.parsedAmount)}을 데모 이체 금액으로 확인했습니다. 실제 송금은 진행되지 않았습니다. 비밀번호 입력은 별도 시작 버튼으로 이동합니다.`
    );
    setConfirmedAmount(validation.parsedAmount);
  };

  const handlePasswordStart = () => {
    if (!isAmountConfirmed) {
      return;
    }

    window.location.assign(
      createTransferPasswordPath(account.id, recipient.id)
    );
  };

  return (
    <DemoBankLayout
      pageId={ELEMENT_IDS.PAGE_TRANSFER_AMOUNT}
      currentPath={createTransferAmountPath(account.id, recipient.id)}
      eyebrow="계좌이체 3단계"
      title="이체 금액을 직접 입력해 주세요"
    >
      <p className="page-introduction">
        URL에서 확인된 Mock 계좌와 수취인을 확인하고, 출금 가능 잔액
        안에서 쉼표 없이 숫자로 입력해 주세요.
      </p>

      <section
        className="transfer-amount-card"
        aria-label="Mock 이체 문맥과 금액 입력"
      >
        <div className="transfer-amount-context-grid">
          <article
            {...elementIdentity(
              ELEMENT_IDS.SUMMARY_TRANSFER_AMOUNT_SOURCE_ACCOUNT
            )}
            className="transfer-amount-context-panel"
          >
            <span>URL에서 확인된 Mock 출금 계좌</span>
            <strong>{account.label}</strong>
            <span>{account.bankName}</span>
            <span className="masked-account-number">
              {account.maskedAccountNumber}
            </span>
            <span>출금 가능 Mock 잔액</span>
            <strong
              {...elementIdentity(
                ELEMENT_IDS.SUMMARY_TRANSFER_AMOUNT_BALANCE
              )}
            >
              {formatWon(account.balance)}
            </strong>
          </article>

          <article
            {...elementIdentity(
              ELEMENT_IDS.SUMMARY_TRANSFER_AMOUNT_RECIPIENT
            )}
            className="transfer-amount-context-panel"
          >
            <span>URL에서 확인된 Mock 수취인</span>
            <strong>{recipient.displayName}</strong>
            <span>{recipient.relationshipLabel}</span>
            <span>{recipient.bankLabel}</span>
            <span>{recipient.maskedAccountLabel}</span>
          </article>
        </div>

        <div className="deposit-amount-field">
          <label htmlFor={ELEMENT_IDS.INPUT_TRANSFER_AMOUNT}>
            이체 금액
          </label>
          <div className="deposit-amount-input-row">
            <input
              {...elementIdentity(ELEMENT_IDS.INPUT_TRANSFER_AMOUNT)}
              type="text"
              inputMode="numeric"
              value={rawAmount}
              aria-describedby={`${ELEMENT_IDS.SUMMARY_TRANSFER_AMOUNT_FORMATTED} ${ELEMENT_IDS.STATUS_TRANSFER_AMOUNT_VALIDATION}`}
              aria-invalid={isInvalid}
              autoComplete="off"
              onChange={handleAmountChange}
            />
            <span aria-hidden="true">원</span>
          </div>

          <p
            {...elementIdentity(
              ELEMENT_IDS.SUMMARY_TRANSFER_AMOUNT_FORMATTED
            )}
            className="formatted-amount"
          >
            {validation.formattedAmount
              ? `입력 금액: ${validation.formattedAmount}`
              : '유효한 금액을 입력하면 원화 형식으로 표시됩니다.'}
          </p>

          <p
            {...elementIdentity(
              ELEMENT_IDS.STATUS_TRANSFER_AMOUNT_VALIDATION
            )}
            className={`amount-validation amount-validation-${validation.state.toLowerCase()}`}
            role="status"
            aria-live="polite"
          >
            {validation.message}
          </p>

          <p
            {...elementIdentity(
              ELEMENT_IDS.STATUS_CONFIRMED_TRANSFER_AMOUNT
            )}
            className="transfer-amount-confirmation-status"
            role="status"
            aria-live="polite"
            aria-label="이체 금액 확인 상태"
          >
            {confirmedMessage ?? ''}
          </p>
        </div>

        <div className="deposit-amount-actions transfer-amount-actions">
          <button
            {...elementIdentity(
              ELEMENT_IDS.BUTTON_TRANSFER_RECIPIENT_BACK
            )}
            type="button"
            className="secondary-button"
            onClick={() =>
              window.location.assign(
                createTransferRecipientsPath(account.id)
              )
            }
          >
            수취인 선택으로 돌아가기
          </button>
          <button
            {...elementIdentity(
              ELEMENT_IDS.BUTTON_TRANSFER_AMOUNT_CONFIRM
            )}
            type="button"
            className="primary-button"
            disabled={!isValid}
            onClick={handleConfirm}
          >
            이체 금액 확인
          </button>
          <button
            {...elementIdentity(
              ELEMENT_IDS.BUTTON_TRANSFER_PASSWORD_START
            )}
            type="button"
            className="primary-button"
            disabled={!isAmountConfirmed}
            aria-describedby={
              ELEMENT_IDS.STATUS_CONFIRMED_TRANSFER_AMOUNT
            }
            onClick={handlePasswordStart}
          >
            비밀번호 입력 시작
          </button>
        </div>
      </section>

      <p className="no-transaction-notice">
        이체 금액은 이 화면의 로컬 상태에서만 확인하며 저장하거나
        전송하지 않습니다. 실제 잔액 차감과 송금은 발생하지 않습니다.
      </p>
    </DemoBankLayout>
  );
}
