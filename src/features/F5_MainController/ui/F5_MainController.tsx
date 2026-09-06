import { useEffect, useRef, useState } from 'react';

import {
  CONTROLLER_SELECTORS,
  getControllerActionMessage,
  INITIAL_CONTROLLER_ACTION_MESSAGE
} from '@/features/F5_MainController/model/controller-action';
import { Button } from '@/shared/ui/Button';
import { Panel } from '@/shared/ui/Panel';
import { Text } from '@/shared/ui/Text';

export interface MainControllerProps {
  message?: string;
  isPaused: boolean;
  canReplay?: boolean;
  canPause?: boolean;
  canGoPrevious?: boolean;
  canCancel?: boolean;
  isBusy?: boolean;
  onReplay: () => void;
  onPauseChange: (isPaused: boolean) => void;
  onPrevious: () => void;
  onCancel: () => void;
}

function elementIdentity(id: string) {
  return { id, 'data-testid': id };
}

export default function F5_MainController({
  message = '',
  isPaused,
  canReplay = false,
  canPause = false,
  canGoPrevious = false,
  canCancel = false,
  isBusy = false,
  onReplay,
  onPauseChange,
  onPrevious,
  onCancel
}: MainControllerProps) {
  const [isCancelConfirmationOpen, setIsCancelConfirmationOpen] =
    useState(false);
  const [actionMessage, setActionMessage] = useState(
    INITIAL_CONTROLLER_ACTION_MESSAGE
  );
  const controllerRef = useRef<HTMLElement>(null);
  const wasCancelConfirmationOpen = useRef(false);

  useEffect(() => {
    if (isCancelConfirmationOpen) {
      document
        .getElementById(CONTROLLER_SELECTORS.cancelDismissButton)
        ?.focus();
      wasCancelConfirmationOpen.current = true;
      return;
    }

    if (wasCancelConfirmationOpen.current) {
      controllerRef.current
        ?.querySelector<HTMLButtonElement>(
          `#${CONTROLLER_SELECTORS.cancelButton}`
        )
        ?.focus();
      wasCancelConfirmationOpen.current = false;
    }
  }, [isCancelConfirmationOpen]);

  const requestReplay = () => {
    setActionMessage(getControllerActionMessage('REPLAY'));
    onReplay();
  };

  const requestPauseChange = () => {
    const nextPausedState = !isPaused;
    setActionMessage(
      getControllerActionMessage(nextPausedState ? 'PAUSE' : 'RESUME')
    );
    onPauseChange(nextPausedState);
  };

  const requestPrevious = () => {
    setActionMessage(getControllerActionMessage('PREVIOUS'));
    onPrevious();
  };

  const closeCancelConfirmation = () => {
    setIsCancelConfirmationOpen(false);
  };

  const requestCancel = () => {
    setActionMessage(getControllerActionMessage('CANCEL'));
    closeCancelConfirmation();
    onCancel();
  };

  const replayDisabled = !canReplay || isBusy || message.trim().length === 0;
  const pauseDisabled = !canPause || isBusy;
  const previousDisabled = !canGoPrevious || isBusy;
  const cancelDisabled = !canCancel || isBusy;

  return (
    <section
      {...elementIdentity(CONTROLLER_SELECTORS.root)}
      ref={controllerRef}
      aria-label="업무 진행 컨트롤"
      aria-busy={isBusy}
      className="w-full rounded-2xl border-2 border-border bg-surface p-5 text-text-primary shadow-sm sm:p-6"
    >
      <Text as="h2" variant="heading">
        업무 진행 컨트롤
      </Text>
      <Text variant="body" className="mt-2 text-text-secondary">
        필요한 동작을 직접 선택해 주세요.
      </Text>

      <div className="mt-5 grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Button
          {...elementIdentity(CONTROLLER_SELECTORS.replayButton)}
          variant="secondary"
          size="lg"
          className="w-full whitespace-normal"
          disabled={replayDisabled}
          onClick={requestReplay}
        >
          다시 듣기
        </Button>

        <Button
          {...elementIdentity(CONTROLLER_SELECTORS.pauseButton)}
          variant="secondary"
          size="lg"
          className="w-full whitespace-normal"
          disabled={pauseDisabled}
          aria-pressed={isPaused}
          onClick={requestPauseChange}
        >
          {isPaused ? '계속 진행' : '일시정지'}
        </Button>

        <Button
          {...elementIdentity(CONTROLLER_SELECTORS.previousButton)}
          variant="secondary"
          size="lg"
          className="w-full whitespace-normal"
          disabled={previousDisabled}
          onClick={requestPrevious}
        >
          이전 단계
        </Button>

        <Button
          {...elementIdentity(CONTROLLER_SELECTORS.cancelButton)}
          variant="danger"
          size="lg"
          className="w-full whitespace-normal"
          disabled={cancelDisabled}
          onClick={() => setIsCancelConfirmationOpen(true)}
        >
          취소
        </Button>
      </div>

      {isCancelConfirmationOpen && (
        <Panel
          {...elementIdentity(CONTROLLER_SELECTORS.cancelConfirmationPanel)}
          role="alertdialog"
          title="업무 진행을 취소할까요?"
          description="취소를 확인하면 현재 업무를 중단하도록 요청합니다. 실제 중단 완료 여부는 연동 결과로 확인해야 합니다."
          className="mt-5 border-danger bg-red-50"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              closeCancelConfirmation();
            }
          }}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button
              {...elementIdentity(CONTROLLER_SELECTORS.cancelDismissButton)}
              variant="secondary"
              size="lg"
              className="w-full whitespace-normal"
              onClick={closeCancelConfirmation}
            >
              계속 이용
            </Button>
            <Button
              {...elementIdentity(CONTROLLER_SELECTORS.cancelConfirmButton)}
              variant="danger"
              size="lg"
              className="w-full whitespace-normal"
              disabled={isBusy}
              onClick={requestCancel}
            >
              취소 확인
            </Button>
          </div>
        </Panel>
      )}

      <p
        {...elementIdentity(CONTROLLER_SELECTORS.actionStatus)}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="mt-5 rounded-xl border border-border bg-slate-50 p-3 text-base leading-relaxed text-text-secondary"
      >
        {actionMessage}
      </p>
    </section>
  );
}
