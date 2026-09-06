import { useState } from 'react';

import {
  CONTROLLER_PREVIEW_SELECTORS,
  getControllerActionMessage,
  INITIAL_CONTROLLER_ACTION_MESSAGE
} from '@/features/F5_MainController/model/controller-action';
import { Panel } from '@/shared/ui/Panel';
import { Text } from '@/shared/ui/Text';

import F5_MainController from './F5_MainController';

function elementIdentity(id: string) {
  return { id, 'data-testid': id };
}

export default function F5_MainControllerPreview() {
  const [isPaused, setIsPaused] = useState(false);
  const [lastAction, setLastAction] = useState(
    INITIAL_CONTROLLER_ACTION_MESSAGE
  );

  return (
    <main
      {...elementIdentity(CONTROLLER_PREVIEW_SELECTORS.root)}
      className="min-h-screen bg-slate-100 p-4 sm:p-8"
    >
      <div className="mx-auto max-w-6xl">
        <Panel
          title="Main Controller Mock Preview"
          description="실제 API나 음성 기능 없이 callback 계약만 확인하는 개발용 화면입니다."
        >
          <Text variant="guide">
            현재 화면에서 선택할 항목을 확인해 주세요.
          </Text>
          <div className="mt-6">
            <F5_MainController
              message="현재 화면에서 선택할 항목을 확인해 주세요."
              isPaused={isPaused}
              canReplay
              canPause
              canGoPrevious
              canCancel
              onReplay={() =>
                setLastAction(getControllerActionMessage('REPLAY'))
              }
              onPauseChange={(nextPausedState) => {
                setIsPaused(nextPausedState);
                setLastAction(
                  getControllerActionMessage(
                    nextPausedState ? 'PAUSE' : 'RESUME'
                  )
                );
              }}
              onPrevious={() =>
                setLastAction(getControllerActionMessage('PREVIOUS'))
              }
              onCancel={() =>
                setLastAction(getControllerActionMessage('CANCEL'))
              }
            />
          </div>
          <p
            {...elementIdentity(CONTROLLER_PREVIEW_SELECTORS.actionStatus)}
            className="mt-6 text-base leading-relaxed text-text-secondary"
          >
            마지막 callback: {lastAction}
          </p>
        </Panel>
      </div>
    </main>
  );
}
