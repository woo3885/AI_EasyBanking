import { useRef, useState, type FormEvent } from 'react';

import DemoBankLayout from '../components/DemoBankLayout';
import { ELEMENT_IDS, elementIdentity } from '../constants/element-ids';
import {
  createTransferConfirmationPath,
  createTransferOtpPath,
  createTransferPasswordPath
} from '../constants/routes';
import type { DemoAccount } from '../data/demo-data';
import type { TransferRecipient } from '../data/transfer-recipients';
import {
  getTransferOtpInputState,
  type TransferOtpInputState
} from '../utils/transfer-otp';

interface TransferOtpPageProps {
  account: DemoAccount;
  recipient: TransferRecipient;
}

export default function TransferOtpPage({
  account,
  recipient
}: TransferOtpPageProps) {
  const otpInputRef = useRef<HTMLInputElement>(null);
  const [inputState, setInputState] =
    useState<TransferOtpInputState>('EMPTY');
  const otpInputCompleted = inputState === 'COMPLETION_RECORDED';

  const handleOtpInput = (event: FormEvent<HTMLInputElement>) => {
    setInputState(
      getTransferOtpInputState(event.currentTarget.value.length > 0)
    );
  };

  const handleInputComplete = () => {
    if (
      inputState !== 'ENTERED' ||
      !otpInputRef.current ||
      otpInputRef.current.value.length === 0
    ) {
      return;
    }

    otpInputRef.current.value = '';
    setInputState('COMPLETION_RECORDED');
  };

  const inputStatusMessage = otpInputCompleted
    ? '보안 입력 절차가 완료 요청 상태로 전환되었습니다. 안전 확인이 끝날 때까지 기다려 주세요.'
    : inputState === 'ENTERED'
      ? 'OTP 입력값이 존재합니다. 입력 완료 버튼을 눌러 주세요.'
      : '데모 OTP를 사용자가 직접 입력해 주세요.';

  return (
    <DemoBankLayout
      pageId={ELEMENT_IDS.PAGE_TRANSFER_OTP}
      currentPath={createTransferOtpPath(account.id, recipient.id)}
      eyebrow="계좌이체 5단계"
      title="데모 OTP를 직접 입력해 주세요"
    >
      <p className="page-introduction">
        이 화면의 직접 URL 접근은 화면과 보안 DOM 계약 확인용입니다. 이전
        비밀번호 입력 완료나 실제 인증 완료를 의미하지 않습니다.
      </p>

      <section
        className="transfer-password-card"
        aria-label="OTP 보안 입력"
      >
        <div className="transfer-password-context-grid">
          <article
            {...elementIdentity(
              ELEMENT_IDS.SUMMARY_TRANSFER_OTP_SOURCE_ACCOUNT
            )}
            className="transfer-password-context-panel"
          >
            <span>URL에서 확인된 Mock 출금 계좌</span>
            <strong>{account.label}</strong>
          </article>
          <article
            {...elementIdentity(
              ELEMENT_IDS.SUMMARY_TRANSFER_OTP_RECIPIENT
            )}
            className="transfer-password-context-panel"
          >
            <span>URL에서 확인된 Mock 수취인</span>
            <strong>{recipient.displayName}</strong>
          </article>
        </div>

        <aside
          {...elementIdentity(
            ELEMENT_IDS.NOTICE_TRANSFER_OTP_SECURE_INPUT
          )}
          className="transfer-secure-input-notice"
          aria-label="OTP 보안 입력 주의"
        >
          <h2>데모 OTP 보안 입력 모드</h2>
          <p>
            실제 OTP를 사용하지 말고 데모 전용 임의 입력만 사용해 주세요.
          </p>
          <p>
            자동화와 AI는 이 값을 입력하거나 읽어서는 안 되며, 입력값은
            저장하거나 전송하지 않습니다.
          </p>
        </aside>

        <div className="transfer-password-field">
          {!otpInputCompleted ? (
            <>
              <label htmlFor={ELEMENT_IDS.INPUT_OTP}>OTP</label>
              <input
                {...elementIdentity(ELEMENT_IDS.INPUT_OTP)}
                ref={otpInputRef}
                type="password"
                autoComplete="off"
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="none"
                data-ddd-policy="secure-input"
                aria-describedby={`${ELEMENT_IDS.NOTICE_TRANSFER_OTP_SECURE_INPUT} ${ELEMENT_IDS.STATUS_TRANSFER_OTP_INPUT} ${ELEMENT_IDS.STATUS_CONFIRMED_TRANSFER_OTP}`}
                onInput={handleOtpInput}
              />
            </>
          ) : null}

          <p
            {...elementIdentity(ELEMENT_IDS.STATUS_TRANSFER_OTP_INPUT)}
            className="transfer-password-input-status"
            role="status"
            aria-live="polite"
          >
            {inputStatusMessage}
          </p>

          <p
            {...elementIdentity(
              ELEMENT_IDS.STATUS_CONFIRMED_TRANSFER_OTP
            )}
            className="transfer-password-completion-status"
            role="status"
            aria-live="polite"
            data-ddd-secure-state={
              otpInputCompleted ? 'completed' : undefined
            }
          >
            {otpInputCompleted
              ? '보안 입력 절차가 완료 요청 상태로 전환되었습니다. 실제 인증과 송금 완료를 의미하지 않습니다.'
              : ''}
          </p>
        </div>

        <div className="transfer-password-actions">
          <button
            {...elementIdentity(
              ELEMENT_IDS.BUTTON_TRANSFER_PASSWORD_BACK
            )}
            type="button"
            className="secondary-button"
            onClick={() =>
              window.location.assign(
                createTransferPasswordPath(account.id, recipient.id)
              )
            }
          >
            비밀번호 화면으로 돌아가기
          </button>
          <button
            {...elementIdentity(ELEMENT_IDS.BUTTON_SECURE_INPUT_COMPLETE)}
            type="button"
            className="primary-button"
            disabled={inputState !== 'ENTERED'}
            aria-describedby={`${ELEMENT_IDS.STATUS_TRANSFER_OTP_INPUT} ${ELEMENT_IDS.STATUS_CONFIRMED_TRANSFER_OTP}`}
            onClick={handleInputComplete}
          >
            {otpInputCompleted ? '입력 완료 요청됨' : '입력 완료'}
          </button>
          <button
            {...elementIdentity(
              ELEMENT_IDS.BUTTON_TRANSFER_CONFIRMATION_START
            )}
            type="button"
            className="primary-button"
            disabled={!otpInputCompleted}
            aria-describedby={ELEMENT_IDS.STATUS_CONFIRMED_TRANSFER_OTP}
            onClick={() =>
              window.location.assign(
                createTransferConfirmationPath(
                  account.id,
                  recipient.id
                )
              )
            }
          >
            최종 확인 화면으로 이동
          </button>
        </div>
      </section>

      <p className="no-transaction-notice">
        OTP 입력은 로컬 데모 절차이며 실제 인증, 거래 최종 확인, 잔액 차감과
        송금은 발생하지 않습니다. 입력 완료 후에도 사용자가 별도 버튼을
        직접 눌러야 최종 확인 Mock으로 이동합니다.
      </p>
    </DemoBankLayout>
  );
}
