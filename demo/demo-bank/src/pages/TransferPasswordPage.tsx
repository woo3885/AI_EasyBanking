import { useRef, useState, type FormEvent } from 'react';

import DemoBankLayout from '../components/DemoBankLayout';
import { ELEMENT_IDS, elementIdentity } from '../constants/element-ids';
import {
  createTransferAmountPath,
  createTransferOtpPath,
  createTransferPasswordPath
} from '../constants/routes';
import type { DemoAccount } from '../data/demo-data';
import type { TransferRecipient } from '../data/transfer-recipients';
import {
  resolveTransferPasswordInputState,
  type TransferPasswordInputState
} from '../utils/transfer-password';

interface TransferPasswordPageProps {
  account: DemoAccount;
  recipient: TransferRecipient;
}

export default function TransferPasswordPage({
  account,
  recipient
}: TransferPasswordPageProps) {
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const [inputState, setInputState] =
    useState<TransferPasswordInputState>('EMPTY');
  const passwordInputCompleted = inputState === 'COMPLETION_RECORDED';

  const handlePasswordInput = (event: FormEvent<HTMLInputElement>) => {
    const hasInput = event.currentTarget.value.length > 0;
    setInputState(resolveTransferPasswordInputState(hasInput));
  };

  const handleInputComplete = () => {
    if (
      inputState !== 'ENTERED' ||
      !passwordInputRef.current ||
      passwordInputRef.current.value.length === 0
    ) {
      return;
    }

    passwordInputRef.current.value = '';
    setInputState('COMPLETION_RECORDED');
  };

  const inputStatusMessage = passwordInputCompleted
    ? '보안 입력 절차가 완료 요청 상태로 전환되었습니다. 안전 확인이 끝날 때까지 기다려 주세요.'
    : inputState === 'ENTERED'
      ? '비밀번호가 입력되었습니다. 입력 완료 버튼을 눌러 주세요.'
      : '비밀번호를 사용자가 직접 입력해 주세요.';

  return (
    <DemoBankLayout
      pageId={ELEMENT_IDS.PAGE_TRANSFER_PASSWORD}
      currentPath={createTransferPasswordPath(account.id, recipient.id)}
      eyebrow="계좌이체 4단계"
      title="계좌 비밀번호를 직접 입력해 주세요"
    >
      <p className="page-introduction">
        URL에서 확인된 Mock 계좌와 수취인 정보만 표시합니다. 이전 화면의
        금액 입력이나 확인 완료 상태는 이 화면에 전달되지 않습니다.
      </p>

      <section
        className="transfer-password-card"
        aria-label="계좌 비밀번호 보안 입력"
      >
        <div className="transfer-password-context-grid">
          <article
            {...elementIdentity(
              ELEMENT_IDS.SUMMARY_TRANSFER_PASSWORD_SOURCE_ACCOUNT
            )}
            className="transfer-password-context-panel"
          >
            <span>URL에서 확인된 Mock 출금 계좌</span>
            <strong>{account.label}</strong>
          </article>
          <article
            {...elementIdentity(
              ELEMENT_IDS.SUMMARY_TRANSFER_PASSWORD_RECIPIENT
            )}
            className="transfer-password-context-panel"
          >
            <span>URL에서 확인된 Mock 수취인</span>
            <strong>{recipient.displayName}</strong>
          </article>
        </div>

        <aside
          {...elementIdentity(ELEMENT_IDS.NOTICE_TRANSFER_SECURE_INPUT)}
          className="transfer-secure-input-notice"
          aria-label="보안 입력 주의"
        >
          <h2>데모 보안 입력 모드</h2>
          <p>
            실제 금융 비밀번호를 입력하지 말고 데모 전용 입력만 사용해
            주세요.
          </p>
          <p>
            자동화와 AI는 이 값을 입력하거나 읽어서는 안 되며, 화면 캡처와
            DOM 전달 중단은 개발자 B의 후속 연동 책임입니다.
          </p>
        </aside>

        <div className="transfer-password-field">
          {!passwordInputCompleted ? (
            <>
              <label htmlFor={ELEMENT_IDS.INPUT_ACCOUNT_PASSWORD}>
                계좌 비밀번호
              </label>
              <input
                {...elementIdentity(ELEMENT_IDS.INPUT_ACCOUNT_PASSWORD)}
                ref={passwordInputRef}
                type="password"
                autoComplete="off"
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="none"
                data-ddd-policy="secure-input"
                aria-describedby={`${ELEMENT_IDS.NOTICE_TRANSFER_SECURE_INPUT} ${ELEMENT_IDS.STATUS_TRANSFER_PASSWORD_INPUT} ${ELEMENT_IDS.STATUS_CONFIRMED_TRANSFER_PASSWORD}`}
                onInput={handlePasswordInput}
              />
            </>
          ) : null}

          <p
            {...elementIdentity(
              ELEMENT_IDS.STATUS_TRANSFER_PASSWORD_INPUT
            )}
            className="transfer-password-input-status"
            role="status"
            aria-live="polite"
          >
            {inputStatusMessage}
          </p>

          <p
            {...elementIdentity(
              ELEMENT_IDS.STATUS_CONFIRMED_TRANSFER_PASSWORD
            )}
            className="transfer-password-completion-status"
            role="status"
            aria-live="polite"
            data-ddd-secure-state={
              passwordInputCompleted ? 'completed' : undefined
            }
          >
            {passwordInputCompleted
              ? '보안 입력 절차가 완료 요청 상태로 전환되었습니다. 실제 인증과 송금 완료를 의미하지 않습니다. 다음 화면 이동은 사용자가 직접 선택해 주세요.'
              : '아직 완료된 데모 비밀번호 입력이 없습니다.'}
          </p>
        </div>

        <div className="transfer-password-actions">
          <button
            {...elementIdentity(ELEMENT_IDS.BUTTON_TRANSFER_AMOUNT_BACK)}
            type="button"
            className="secondary-button"
            onClick={() =>
              window.location.assign(
                createTransferAmountPath(account.id, recipient.id)
              )
            }
          >
            이체 금액 화면으로 돌아가기
          </button>
          <button
            {...elementIdentity(ELEMENT_IDS.BUTTON_SECURE_INPUT_COMPLETE)}
            type="button"
            className="primary-button"
            disabled={inputState !== 'ENTERED'}
            aria-describedby={`${ELEMENT_IDS.STATUS_TRANSFER_PASSWORD_INPUT} ${ELEMENT_IDS.STATUS_CONFIRMED_TRANSFER_PASSWORD}`}
            onClick={handleInputComplete}
          >
            {passwordInputCompleted ? '입력 완료 요청됨' : '입력 완료'}
          </button>
          <button
            {...elementIdentity(ELEMENT_IDS.BUTTON_TRANSFER_OTP_START)}
            type="button"
            className="primary-button"
            disabled={!passwordInputCompleted}
            aria-describedby={
              ELEMENT_IDS.STATUS_CONFIRMED_TRANSFER_PASSWORD
            }
            onClick={() =>
              window.location.assign(
                createTransferOtpPath(account.id, recipient.id)
              )
            }
          >
            OTP 입력 시작
          </button>
        </div>
      </section>

      <p className="no-transaction-notice">
        입력값은 API, WebSocket, URL 또는 저장소로 전송하지 않습니다. 실제
        인증, 잔액 차감과 송금은 발생하지 않으며 OTP 화면 이동은 별도
        버튼으로만 진행합니다.
      </p>
    </DemoBankLayout>
  );
}
