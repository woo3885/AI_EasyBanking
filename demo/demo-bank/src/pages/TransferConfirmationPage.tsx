import { useState, type ChangeEvent } from 'react';

import DemoBankLayout from '../components/DemoBankLayout';
import { ELEMENT_IDS, elementIdentity } from '../constants/element-ids';
import {
  createTransferAmountPath,
  createTransferCompletedPath,
  createTransferConfirmationPath,
  createTransferOtpPath
} from '../constants/routes';
import type { DemoAccount } from '../data/demo-data';
import type { TransferRecipient } from '../data/transfer-recipients';

interface TransferConfirmationPageProps {
  account: DemoAccount;
  recipient: TransferRecipient;
}

export default function TransferConfirmationPage({
  account,
  recipient
}: TransferConfirmationPageProps) {
  const [isFinalConfirmationChecked, setIsFinalConfirmationChecked] =
    useState(false);
  const [isLocallyApproved, setIsLocallyApproved] = useState(false);
  const [approvalMessage, setApprovalMessage] = useState('');

  const handleConfirmationChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    setIsFinalConfirmationChecked(event.target.checked);
    setIsLocallyApproved(false);
    setApprovalMessage('');
  };

  const handleLocalApproval = () => {
    if (!isFinalConfirmationChecked || isLocallyApproved) {
      return;
    }

    setIsLocallyApproved(true);
    setApprovalMessage(
      '데모 최종 확인 UI를 직접 확인했습니다. 실제 거래 Action, 송금과 잔액 변경은 실행하지 않았습니다.'
    );
  };

  const handleCancel = () => {
    setIsFinalConfirmationChecked(false);
    setIsLocallyApproved(false);
    setApprovalMessage(
      '데모 최종 확인을 취소했습니다. 실제 거래 취소 API나 세션 종료는 실행하지 않았습니다.'
    );
  };

  return (
    <DemoBankLayout
      pageId={ELEMENT_IDS.PAGE_TRANSFER_CONFIRMATION}
      currentPath={createTransferConfirmationPath(
        account.id,
        recipient.id
      )}
      eyebrow="계좌이체 6단계"
      title="데모 이체 내용을 최종 확인해 주세요"
    >
      <p className="page-introduction">
        이 화면은 실제 거래 요약이 아니라 최종 확인 DOM과 사용자 승인
        Gate를 확인하는 Mock입니다.
      </p>

      <aside
        {...elementIdentity(ELEMENT_IDS.NOTICE_TRANSFER_CONFIRMATION)}
        className="transfer-confirmation-notice"
        aria-label="최종 확인 데모 안내"
      >
        <h2>실제 거래가 아닌 확인용 화면입니다</h2>
        <p>
          D10에서 입력한 금액은 화면 이동 중 저장하거나 전달하지 않아 이
          화면에서 확인할 수 없습니다.
        </p>
        <p>
          직접 URL 접근은 이전 단계 완료나 비밀번호·OTP 인증 성공을
          증명하지 않습니다. 실제 송금, 거래 승인과 잔액 변경은 발생하지
          않습니다.
        </p>
      </aside>

      <section
        className="transfer-confirmation-card"
        aria-labelledby="transfer-confirmation-summary-title"
      >
        <h2 id="transfer-confirmation-summary-title">데모 확인 정보</h2>
        <dl className="transfer-confirmation-summary">
          <div {...elementIdentity(ELEMENT_IDS.SUMMARY_TRANSACTION_TYPE)}>
            <dt>거래 유형</dt>
            <dd>계좌이체 데모</dd>
          </div>
          <div
            {...elementIdentity(
              ELEMENT_IDS.SUMMARY_TRANSFER_CONFIRMATION_SOURCE_ACCOUNT
            )}
          >
            <dt>출금 계좌</dt>
            <dd>
              <strong>{account.label}</strong>
              <span>{account.bankName}</span>
              <span className="masked-account-number">
                {account.maskedAccountNumber}
              </span>
            </dd>
          </div>
          <div {...elementIdentity(ELEMENT_IDS.SUMMARY_RECIPIENT)}>
            <dt>Mock 수취인</dt>
            <dd>
              <strong>{recipient.displayName}</strong>
              <span>{recipient.relationshipLabel}</span>
              <span>{recipient.bankLabel}</span>
              <span>{recipient.maskedAccountLabel}</span>
            </dd>
          </div>
          <div {...elementIdentity(ELEMENT_IDS.SUMMARY_AMOUNT)}>
            <dt>이체 금액</dt>
            <dd>전달되지 않음</dd>
          </div>
        </dl>

        <p
          {...elementIdentity(
            ELEMENT_IDS.STATUS_TRANSFER_CONFIRMATION_AMOUNT
          )}
          className="transfer-confirmation-amount-status"
        >
          이전 금액 입력값은 저장·전달되지 않아 현재 Mock에서 표시할 수
          없습니다. 실제 송금 검토나 거래 요약이 완료된 것이 아닙니다.
        </p>

        <fieldset className="transfer-final-confirmation-fieldset">
          <legend>사용자 직접 확인</legend>
          <label
            className="transfer-final-confirmation-label"
            htmlFor={ELEMENT_IDS.CHECKBOX_FINAL_CONFIRMATION}
          >
            <input
              {...elementIdentity(
                ELEMENT_IDS.CHECKBOX_FINAL_CONFIRMATION
              )}
              type="checkbox"
              checked={isFinalConfirmationChecked}
              onChange={handleConfirmationChange}
            />
            <span>
              이 화면이 실제 거래 요약이 아니며 실제 송금이 실행되지
              않는다는 내용을 확인했습니다.
            </span>
          </label>
          <p>
            체크 후 데모 최종 승인 버튼을 직접 눌러야 로컬 확인 상태가
            기록됩니다.
          </p>
        </fieldset>

        <p
          {...elementIdentity(ELEMENT_IDS.STATUS_TRANSFER_FINAL_APPROVAL)}
          className="transfer-final-approval-status"
          role="status"
          aria-live="polite"
        >
          {approvalMessage}
        </p>

        <div className="transfer-confirmation-actions">
          <button
            {...elementIdentity(ELEMENT_IDS.BUTTON_TRANSFER_OTP_BACK)}
            type="button"
            className="secondary-button"
            onClick={() =>
              window.location.assign(
                createTransferOtpPath(account.id, recipient.id)
              )
            }
          >
            OTP 화면으로 돌아가기
          </button>
          <button
            {...elementIdentity(ELEMENT_IDS.BUTTON_FINAL_EDIT)}
            type="button"
            className="secondary-button"
            onClick={() =>
              window.location.assign(
                createTransferAmountPath(account.id, recipient.id)
              )
            }
          >
            이체 금액 다시 입력하기
          </button>
          <button
            {...elementIdentity(ELEMENT_IDS.BUTTON_FINAL_CANCEL)}
            type="button"
            className="secondary-button"
            onClick={handleCancel}
          >
            최종 확인 취소
          </button>
          <button
            {...elementIdentity(ELEMENT_IDS.BUTTON_FINAL_APPROVE)}
            type="button"
            className="primary-button"
            data-ddd-policy="final-confirmation"
            disabled={!isFinalConfirmationChecked || isLocallyApproved}
            aria-describedby={ELEMENT_IDS.STATUS_TRANSFER_FINAL_APPROVAL}
            onClick={handleLocalApproval}
          >
            데모 최종 승인
          </button>
          <button
            {...elementIdentity(
              ELEMENT_IDS.BUTTON_TRANSFER_COMPLETION_START
            )}
            type="button"
            className="primary-button"
            disabled={!isLocallyApproved}
            aria-describedby={ELEMENT_IDS.STATUS_TRANSFER_FINAL_APPROVAL}
            onClick={() =>
              window.location.assign(
                createTransferCompletedPath(account.id, recipient.id)
              )
            }
          >
            데모 완료 화면으로 이동
          </button>
        </div>
      </section>

      <p className="no-transaction-notice">
        수정 화면으로 이동해도 기존 입력 금액은 복원되지 않습니다. 이
        페이지는 API, WebSocket 또는 실제 금융 Action을 실행하지 않습니다.
      </p>
    </DemoBankLayout>
  );
}
