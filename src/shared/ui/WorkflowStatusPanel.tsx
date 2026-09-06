import type { WorkflowStatus } from '@/types/frontend-state';
import {
  getWorkflowStatusPresentation,
  type WorkflowStatusTone
} from '@/shared/model/workflow-status-presentation';
import { NoticeBox, type NoticeBoxVariant } from './NoticeBox';
import { Panel } from './Panel';
import { StatusBadge } from './StatusBadge';

export const WORKFLOW_STATUS_PANEL_SELECTORS = {
  panel: 'panel-workflow-status',
  heading: 'heading-workflow-status',
  indicator: 'indicator-workflow-status',
  message: 'message-workflow-status'
} as const;

export interface WorkflowStatusPanelProps {
  status: WorkflowStatus;
  /** 부모 또는 서버가 사용자 표시용으로 정제한 안전한 문장만 전달한다. */
  message?: string;
  className?: string;
}

const toneLabels: Record<WorkflowStatusTone, string> = {
  neutral: '상태 안내',
  progress: '진행 중',
  success: '완료',
  warning: '확인 필요',
  danger: '주의 필요'
};

const noticeVariants: Record<WorkflowStatusTone, NoticeBoxVariant> = {
  neutral: 'info',
  progress: 'progress',
  success: 'info',
  warning: 'warning',
  danger: 'danger'
};

function elementIdentity(value: string) {
  return { id: value, 'data-testid': value };
}

export function WorkflowStatusPanel({
  status,
  message,
  className
}: WorkflowStatusPanelProps) {
  const presentation = getWorkflowStatusPresentation(status);
  const normalizedMessage = message?.trim();
  const displayedMessage = normalizedMessage || presentation.description;
  const liveRole = presentation.isError ? 'alert' : 'status';

  return (
    <Panel
      {...elementIdentity(WORKFLOW_STATUS_PANEL_SELECTORS.panel)}
      className={['w-full', className].filter(Boolean).join(' ')}
      role={liveRole}
      aria-live={presentation.isError ? 'assertive' : 'polite'}
      aria-busy={presentation.isBusy}
      aria-labelledby={WORKFLOW_STATUS_PANEL_SELECTORS.heading}
      aria-describedby={WORKFLOW_STATUS_PANEL_SELECTORS.message}
    >
      <div className="flex items-start gap-4">
        {presentation.showIndicator ? (
          <span
            {...elementIdentity(WORKFLOW_STATUS_PANEL_SELECTORS.indicator)}
            aria-hidden="true"
            className="mt-1 size-6 shrink-0 rounded-full border-4 border-current border-r-transparent motion-safe:animate-spin"
          />
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2
              {...elementIdentity(WORKFLOW_STATUS_PANEL_SELECTORS.heading)}
              className="text-2xl font-bold leading-snug text-text-primary"
            >
              {presentation.title}
            </h2>
            <StatusBadge variant={presentation.tone}>
              {toneLabels[presentation.tone]}
            </StatusBadge>
          </div>

          <NoticeBox
            {...elementIdentity(WORKFLOW_STATUS_PANEL_SELECTORS.message)}
            variant={noticeVariants[presentation.tone]}
            announce="off"
            role="presentation"
            className="mt-4"
          >
            {displayedMessage}
          </NoticeBox>
        </div>
      </div>
    </Panel>
  );
}
