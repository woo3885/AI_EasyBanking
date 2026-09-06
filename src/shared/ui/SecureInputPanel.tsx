import {
  canRequestSecureInputCompletion,
  getSecureInputPhase,
  getSecureInputStatusMessage
} from '@/shared/model/secure-input';
import { Button } from './Button';
import { NoticeBox } from './NoticeBox';
import { Panel } from './Panel';

export const SECURE_INPUT_PANEL_SELECTORS = {
  panel: 'panel-secure-input',
  heading: 'heading-secure-input',
  protectionNotice: 'notice-secure-input-protection',
  status: 'status-secure-input',
  completeButton: 'btn-secure-input-complete'
} as const;

export interface SecureInputPanelProps {
  /** 부모 또는 서버가 보안 원문을 제거한 뒤 전달하는 일반 안내 문장이다. */
  message?: string;
  completionRequested?: boolean;
  disabled?: boolean;
  isBusy?: boolean;
  onComplete: () => void;
  className?: string;
}

const DEFAULT_MESSAGE =
  '원격 금융 화면에서 보안 정보를 직접 입력한 뒤 입력 완료 버튼을 눌러 주세요.';

function elementIdentity(value: string) {
  return { id: value, 'data-testid': value };
}

export function SecureInputPanel({
  message,
  completionRequested = false,
  disabled = false,
  isBusy = false,
  onComplete,
  className
}: SecureInputPanelProps) {
  const phase = getSecureInputPhase(completionRequested);
  const availability = { phase, disabled, isBusy };
  const canRequestCompletion =
    canRequestSecureInputCompletion(availability);
  const displayedMessage = message?.trim() || DEFAULT_MESSAGE;
  const statusMessage = getSecureInputStatusMessage(availability);

  const handleComplete = () => {
    if (canRequestCompletion) {
      onComplete();
    }
  };

  return (
    <Panel
      {...elementIdentity(SECURE_INPUT_PANEL_SELECTORS.panel)}
      className={['w-full', className].filter(Boolean).join(' ')}
      aria-labelledby={SECURE_INPUT_PANEL_SELECTORS.heading}
      aria-describedby={`${SECURE_INPUT_PANEL_SELECTORS.protectionNotice} ${SECURE_INPUT_PANEL_SELECTORS.status}`}
      aria-busy={isBusy}
    >
      <h2
        {...elementIdentity(SECURE_INPUT_PANEL_SELECTORS.heading)}
        className="text-2xl font-bold leading-snug text-text-primary"
      >
        개인정보 보호 모드
      </h2>

      <NoticeBox
        {...elementIdentity(
          SECURE_INPUT_PANEL_SELECTORS.protectionNotice
        )}
        variant="secure"
        title="보안 정보는 원격 금융 화면에서 직접 입력해 주세요."
        announce="off"
        role="note"
        className="mt-5"
      >
        <p>{displayedMessage}</p>
        <p className="mt-2">
          이 패널은 보안 입력값을 받지 않으며 입력 완료 버튼은 안전 확인을
          요청할 뿐입니다.
        </p>
      </NoticeBox>

      <p
        {...elementIdentity(SECURE_INPUT_PANEL_SELECTORS.status)}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="mt-5 rounded-xl border-2 border-border bg-slate-50 p-4 text-base font-semibold leading-relaxed text-text-primary"
      >
        {statusMessage}
      </p>

      <Button
        {...elementIdentity(SECURE_INPUT_PANEL_SELECTORS.completeButton)}
        type="button"
        size="lg"
        className="mt-5 w-full whitespace-normal sm:w-auto"
        disabled={!canRequestCompletion}
        aria-describedby={SECURE_INPUT_PANEL_SELECTORS.status}
        onClick={handleComplete}
      >
        입력 완료 요청
      </Button>
    </Panel>
  );
}
