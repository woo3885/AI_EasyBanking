import { useState, type ChangeEvent } from 'react';

import type { WorkflowStatus } from '@/types/frontend-state';
import { Panel } from './Panel';
import { Text } from './Text';
import { WorkflowStatusPanel } from './WorkflowStatusPanel';

export const WORKFLOW_STATUS_PANEL_PREVIEW_SELECTORS = {
  preview: 'preview-workflow-status',
  select: 'select-preview-workflow-status'
} as const;

const UNKNOWN_RUNTIME_STATUS = 'UNKNOWN_RUNTIME_STATUS' as const;

type PreviewWorkflowStatus =
  | Extract<
      WorkflowStatus,
      'AI_EXECUTING' | 'PAGE_LOADING' | 'ERROR' | 'CANCELLED' | 'COMPLETED'
    >
  | typeof UNKNOWN_RUNTIME_STATUS;

const previewOptions: ReadonlyArray<{
  value: PreviewWorkflowStatus;
  label: string;
}> = [
  { value: 'AI_EXECUTING', label: 'AI 실행 중' },
  { value: 'PAGE_LOADING', label: '페이지 로딩' },
  { value: 'ERROR', label: '업무 오류' },
  { value: 'CANCELLED', label: '사용자 취소' },
  { value: 'COMPLETED', label: '업무 안내 완료' },
  { value: UNKNOWN_RUNTIME_STATUS, label: '알 수 없는 runtime 상태' }
];

const previewMessages: Partial<Record<WorkflowStatus, string>> = {
  AI_EXECUTING: 'AI가 현재 화면의 다음 안내를 준비하고 있습니다.',
  PAGE_LOADING: '금융 페이지를 안전하게 불러오고 있습니다.',
  ERROR: '요청을 처리하지 못했습니다. 현재 안내를 확인해 주세요.',
  CANCELLED: '사용자가 금융 업무 안내를 취소했습니다.',
  COMPLETED: '요청한 금융 업무의 안내 흐름이 완료되었습니다.'
};

function elementIdentity(value: string) {
  return { id: value, 'data-testid': value };
}

export function WorkflowStatusPanelPreview() {
  const [status, setStatus] = useState<PreviewWorkflowStatus>('AI_EXECUTING');

  const handleStatusChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setStatus(event.currentTarget.value as PreviewWorkflowStatus);
  };

  return (
    <section
      {...elementIdentity(WORKFLOW_STATUS_PANEL_PREVIEW_SELECTORS.preview)}
      aria-labelledby="heading-preview-workflow-status"
      className="mx-auto w-full max-w-4xl space-y-6 p-6"
    >
      <Text id="heading-preview-workflow-status" variant="title">
        Workflow 상태 패널 Preview
      </Text>
      <Text variant="body">
        개발자가 상태를 직접 선택해 공통 패널 표현을 확인하는 Mock입니다.
      </Text>

      <Panel title="Preview 상태 선택">
        <label
          htmlFor={WORKFLOW_STATUS_PANEL_PREVIEW_SELECTORS.select}
          className="block text-base font-bold text-text-primary"
        >
          확인할 Workflow 상태
        </label>
        <select
          {...elementIdentity(WORKFLOW_STATUS_PANEL_PREVIEW_SELECTORS.select)}
          value={status}
          onChange={handleStatusChange}
          className="mt-3 min-h-12 w-full rounded-xl border-2 border-border bg-surface px-4 text-base text-text-primary focus-visible:ring-4 focus-visible:ring-brand-100"
        >
          {previewOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Panel>

      <WorkflowStatusPanel
        // Preview에서만 잘못된 외부 runtime 값을 재현한다. 공통 union에는 추가하지 않는다.
        status={status as WorkflowStatus}
        message={previewMessages[status as WorkflowStatus]}
      />
    </section>
  );
}
