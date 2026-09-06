import { useState } from 'react';

import { NoticeBox } from './NoticeBox';
import {
  SecureInputPanel,
  SECURE_INPUT_PANEL_SELECTORS
} from './SecureInputPanel';
import { Text } from './Text';

export const SECURE_INPUT_PANEL_PREVIEW_SELECTORS = {
  root: 'preview-secure-input',
  stateSelect: 'select-preview-secure-input-state'
} as const;

export type SecureInputPanelPreviewState =
  | 'WAITING'
  | 'COMPLETION_REQUESTED'
  | 'BUSY'
  | 'DISABLED'
  | 'CUSTOM_MESSAGE'
  | 'EMPTY_MESSAGE';

const PREVIEW_OPTIONS: ReadonlyArray<{
  value: SecureInputPanelPreviewState;
  label: string;
}> = [
  { value: 'WAITING', label: '사용자 입력 대기' },
  { value: 'COMPLETION_REQUESTED', label: '입력 완료 요청 후' },
  { value: 'BUSY', label: '완료 요청 처리 중' },
  { value: 'DISABLED', label: '완료 요청 비활성화' },
  { value: 'CUSTOM_MESSAGE', label: '정제된 안내 문장' },
  { value: 'EMPTY_MESSAGE', label: '빈 안내 문장 fallback' }
];

const CUSTOM_MESSAGE =
  '보호된 정보는 원격 금융 화면에서 직접 입력해 주세요.';

function elementIdentity(value: string) {
  return { id: value, 'data-testid': value };
}

export default function SecureInputPanelPreview() {
  const [previewState, setPreviewState] =
    useState<SecureInputPanelPreviewState>('WAITING');
  const [completionNotice, setCompletionNotice] = useState(
    'Preview에서 완료 요청을 보내지 않았습니다.'
  );

  const completionRequested =
    previewState === 'COMPLETION_REQUESTED';
  const isBusy = previewState === 'BUSY';
  const disabled = previewState === 'DISABLED';
  const message =
    previewState === 'CUSTOM_MESSAGE'
      ? `  ${CUSTOM_MESSAGE}  `
      : previewState === 'EMPTY_MESSAGE'
        ? '   '
        : undefined;

  const handleComplete = () => {
    setCompletionNotice(
      'Preview에서 입력 완료 요청만 확인했습니다. 보호 모드는 계속 유지됩니다.'
    );
    setPreviewState('COMPLETION_REQUESTED');
  };

  return (
    <main
      {...elementIdentity(SECURE_INPUT_PANEL_PREVIEW_SELECTORS.root)}
      className="mx-auto min-h-screen w-full max-w-4xl space-y-6 bg-slate-50 p-4 text-text-primary sm:p-6 lg:p-8"
    >
      <header>
        <Text as="h1" variant="title">
          D17 보안 입력 패널 Preview
        </Text>
        <Text variant="guide" className="mt-3 text-text-secondary">
          실제 보안 입력이나 전송 없이 개인정보 보호 모드 UI만 확인합니다.
        </Text>
      </header>

      <NoticeBox
        variant="warning"
        announce="off"
        role="note"
        title="독립 개발 Preview입니다."
      >
        실제 API, WebSocket, 자동화 재개 또는 금융거래를 실행하지 않습니다.
      </NoticeBox>

      <div>
        <label
          htmlFor={SECURE_INPUT_PANEL_PREVIEW_SELECTORS.stateSelect}
          className="block text-lg font-bold leading-relaxed"
        >
          확인할 보호 모드 상태
        </label>
        <select
          {...elementIdentity(
            SECURE_INPUT_PANEL_PREVIEW_SELECTORS.stateSelect
          )}
          value={previewState}
          onChange={(event) => {
            setPreviewState(
              event.currentTarget.value as SecureInputPanelPreviewState
            );
            setCompletionNotice(
              'Preview에서 완료 요청을 보내지 않았습니다.'
            );
          }}
          className="mt-2 min-h-14 w-full rounded-xl border-2 border-border bg-surface px-4 text-lg text-text-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 focus-visible:ring-offset-2"
        >
          {PREVIEW_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <SecureInputPanel
        message={message}
        completionRequested={completionRequested}
        isBusy={isBusy}
        disabled={disabled}
        onComplete={handleComplete}
      />

      <p className="text-base leading-relaxed text-text-secondary">
        {completionNotice}
      </p>

      <Text variant="caption">
        완료 버튼 selector는 {SECURE_INPUT_PANEL_SELECTORS.completeButton}이며
        원격 Demo-bank와는 별개의 DOM에서 사용됩니다.
      </Text>
    </main>
  );
}
