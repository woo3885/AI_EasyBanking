import { useRef, useState, type FormEvent } from 'react';

import DemoBankLayout from '../components/DemoBankLayout';
import { ELEMENT_IDS, elementIdentity } from '../constants/element-ids';
import {
  createDepositConfirmationPath,
  createDepositPasswordPath,
  createDepositTermsPath,
  ROUTES
} from '../constants/routes';
import type { DepositProduct } from '../data/demo-data';
import {
  getDepositPasswordInputState,
  type DepositPasswordInputState
} from '../utils/deposit-password';

interface DepositPasswordPageProps {
  product: DepositProduct;
}

export default function DepositPasswordPage({
  product
}: DepositPasswordPageProps) {
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const [inputState, setInputState] =
    useState<DepositPasswordInputState>('EMPTY');
  const passwordInputCompleted = inputState === 'COMPLETION_RECORDED';

  const handlePasswordInput = (event: FormEvent<HTMLInputElement>) => {
    setInputState(
      getDepositPasswordInputState(event.currentTarget.value.length > 0)
    );
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
      ? '데모 비밀번호가 입력되었습니다. 입력 완료 버튼을 눌러 주세요.'
      : '실제 금융 비밀번호가 아닌 데모용 값을 직접 입력해 주세요.';

  return (
    <DemoBankLayout
      pageId={ELEMENT_IDS.PAGE_DEPOSIT_PASSWORD}
      currentPath={createDepositPasswordPath(product.id)}
      eyebrow="예금 가입 5단계"
      title="계좌 비밀번호를 직접 입력해 주세요"
    >
      <p className="page-introduction">
        이 직접 URL은 화면과 보안 DOM 계약 확인용입니다. 이전 약관 확인이나
        실제 인증·가입 완료를 증명하지 않습니다.
      </p>

      <section
        className="deposit-password-card"
        aria-label="예금 계좌 비밀번호 보안 입력"
      >
        <div className="deposit-password-context-grid">
          <article className="deposit-password-context-panel">
            <span>URL에서 확인된 Mock 상품</span>
            <strong
              {...elementIdentity(
                ELEMENT_IDS.SUMMARY_DEPOSIT_PASSWORD_PRODUCT_NAME
              )}
            >
              {product.name}
            </strong>
          </article>
          <article className="deposit-password-context-panel">
            <span>상품 기간</span>
            <strong
              {...elementIdentity(
                ELEMENT_IDS.SUMMARY_DEPOSIT_PASSWORD_PRODUCT_PERIOD
              )}
            >
              {product.periodLabel}
            </strong>
          </article>
        </div>

        <aside
          {...elementIdentity(ELEMENT_IDS.NOTICE_DEPOSIT_SECURE_INPUT)}
          className="deposit-secure-input-notice"
          aria-label="예금 보안 입력 주의"
        >
          <h2>데모 보안 입력 모드</h2>
          <p>
            실제 금융 비밀번호를 입력하지 말고 데모용 임의 입력만 사용해
            주세요.
          </p>
          <p>
            자동화·AI·캡처 시스템은 이 보안 입력을 감지하고 수집을 중단해야
            합니다. 실제 중단과 재개는 개발자 B의 후속 연동 범위입니다.
          </p>
        </aside>

        <div className="deposit-password-field">
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
                aria-describedby={`${ELEMENT_IDS.NOTICE_DEPOSIT_SECURE_INPUT} ${ELEMENT_IDS.STATUS_DEPOSIT_PASSWORD_INPUT} ${ELEMENT_IDS.STATUS_CONFIRMED_DEPOSIT_PASSWORD}`}
                onInput={handlePasswordInput}
              />
            </>
          ) : null}

          <p
            {...elementIdentity(ELEMENT_IDS.STATUS_DEPOSIT_PASSWORD_INPUT)}
            className="deposit-password-input-status"
            role="status"
            aria-live="polite"
          >
            {inputStatusMessage}
          </p>

          <p
            {...elementIdentity(
              ELEMENT_IDS.STATUS_CONFIRMED_DEPOSIT_PASSWORD
            )}
            className="deposit-password-completion-status"
            role="status"
            aria-live="polite"
            data-ddd-secure-state={
              passwordInputCompleted ? 'completed' : undefined
            }
          >
            {passwordInputCompleted
              ? '보안 입력 절차가 완료 요청 상태로 전환되었습니다. 실제 인증이나 예금 가입 완료를 의미하지 않습니다.'
              : ''}
          </p>
        </div>

        <div className="deposit-password-actions">
          <button
            {...elementIdentity(ELEMENT_IDS.BUTTON_DEPOSIT_TERMS_BACK)}
            type="button"
            className="secondary-button"
            onClick={() =>
              window.location.assign(createDepositTermsPath(product.id))
            }
          >
            약관 화면으로 돌아가기
          </button>
          <button
            {...elementIdentity(ELEMENT_IDS.BUTTON_SECURE_INPUT_COMPLETE)}
            type="button"
            className="primary-button"
            disabled={inputState !== 'ENTERED'}
            aria-describedby={`${ELEMENT_IDS.STATUS_DEPOSIT_PASSWORD_INPUT} ${ELEMENT_IDS.STATUS_CONFIRMED_DEPOSIT_PASSWORD}`}
            onClick={handleInputComplete}
          >
            {passwordInputCompleted ? '입력 완료 요청됨' : '입력 완료'}
          </button>
          <button
            {...elementIdentity(
              ELEMENT_IDS.BUTTON_DEPOSIT_CONFIRMATION_START
            )}
            type="button"
            className="primary-button"
            disabled={!passwordInputCompleted}
            aria-describedby={ELEMENT_IDS.STATUS_CONFIRMED_DEPOSIT_PASSWORD}
            onClick={() =>
              window.location.assign(
                createDepositConfirmationPath(product.id)
              )
            }
          >
            예금 최종 확인으로 이동
          </button>
          <button
            {...elementIdentity(ELEMENT_IDS.BUTTON_DEPOSIT_PASSWORD_CANCEL)}
            type="button"
            className="secondary-button"
            onClick={() => window.location.assign(ROUTES.HOME)}
          >
            데모 흐름 나가기
          </button>
        </div>
      </section>

      <p className="no-transaction-notice">
        입력값은 URL, 저장소, API 또는 WebSocket으로 전송하지 않습니다.
        실제 인증, 예금 가입, 잔액 변경과 최종 승인은 발생하지 않습니다.
      </p>
    </DemoBankLayout>
  );
}
