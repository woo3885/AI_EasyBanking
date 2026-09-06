import {
  canRequestRiskCancellation,
  createRiskWarningPresentation,
  type RiskWarningDetails
} from '@/shared/model/risk-warning';
import { Button } from './Button';
import { NoticeBox } from './NoticeBox';
import { Panel } from './Panel';
import { StatusBadge } from './StatusBadge';
import { Text } from './Text';

export const RISK_WARNING_PANEL_SELECTORS = {
  panel: 'panel-risk-warning',
  heading: 'heading-risk-warning',
  notice: 'notice-risk-warning',
  guidance: 'guidance-risk-warning',
  status: 'status-risk-warning',
  cancel: 'btn-risk-cancel'
} as const;

export interface RiskWarningPanelProps {
  title?: string;
  details: RiskWarningDetails;
  cancelRequested?: boolean;
  disabled?: boolean;
  isBusy?: boolean;
  canCancel?: boolean;
  onCancel: () => void;
  className?: string;
}

const DEFAULT_TITLE = '금융사기 위험 경고';
const GENERAL_STATUS_MESSAGE =
  '안전을 위해 현재 절차를 계속 진행하지 않습니다.';
const BUSY_STATUS_MESSAGE = '안전한 취소 요청을 처리하고 있습니다.';
const CANCEL_REQUESTED_STATUS_MESSAGE =
  '취소 요청을 전달했습니다. 처리 결과를 확인할 때까지 위험 경고를 유지합니다.';
const CANCEL_UNAVAILABLE_STATUS_MESSAGE =
  '현재 이 패널에서는 취소 요청을 사용할 수 없습니다. 금융 절차를 계속 진행하지 마세요.';

function elementIdentity(value: string) {
  return { id: value, 'data-testid': value };
}

export function RiskWarningPanel({
  title,
  details,
  cancelRequested = false,
  disabled = false,
  isBusy = false,
  canCancel = false,
  onCancel,
  className
}: RiskWarningPanelProps) {
  const presentation = createRiskWarningPresentation(details);
  const cancelAvailability = {
    cancelRequested,
    disabled,
    isBusy,
    canCancel
  };
  const cancelEnabled = canRequestRiskCancellation(cancelAvailability);
  const displayedTitle = title?.trim() || DEFAULT_TITLE;
  const statusMessage = isBusy
    ? BUSY_STATUS_MESSAGE
    : cancelRequested
      ? CANCEL_REQUESTED_STATUS_MESSAGE
      : !canCancel || disabled
        ? CANCEL_UNAVAILABLE_STATUS_MESSAGE
        : GENERAL_STATUS_MESSAGE;
  const badgeLabel = isBusy
    ? '취소 요청 처리 중'
    : cancelRequested
      ? '취소 요청 전달됨'
      : cancelEnabled
        ? '위험 경고 유지 중'
        : '취소 요청 사용 불가';

  const handleCancel = () => {
    if (canRequestRiskCancellation(cancelAvailability)) {
      onCancel();
    }
  };

  return (
    <Panel
      {...elementIdentity(RISK_WARNING_PANEL_SELECTORS.panel)}
      aria-labelledby={RISK_WARNING_PANEL_SELECTORS.heading}
      aria-describedby={RISK_WARNING_PANEL_SELECTORS.status}
      aria-busy={isBusy}
      className={[
        'w-full border-danger forced-colors:border-[CanvasText]',
        className
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h2
          {...elementIdentity(RISK_WARNING_PANEL_SELECTORS.heading)}
          className="text-2xl font-bold leading-snug text-red-900"
        >
          {displayedTitle}
        </h2>
        <StatusBadge variant="danger">{badgeLabel}</StatusBadge>
      </div>

      <NoticeBox
        {...elementIdentity(RISK_WARNING_PANEL_SELECTORS.notice)}
        variant="danger"
        title="금융사기 위험 가능성"
        announce="assertive"
        aria-atomic="true"
        className="mt-5"
      >
        <Text as="p" variant="guide" className="text-current">
          {presentation.message}
        </Text>
      </NoticeBox>

      <div className="mt-6">
        <Text as="h3" variant="guide">
          지금 안전을 위해 확인할 사항
        </Text>
        <ul
          {...elementIdentity(RISK_WARNING_PANEL_SELECTORS.guidance)}
          className="mt-3 list-disc space-y-3 pl-7 text-base leading-relaxed text-text-primary marker:text-danger"
        >
          {presentation.guidance.map((guidance) => (
            <li key={guidance}>{guidance}</li>
          ))}
        </ul>
      </div>

      <p
        {...elementIdentity(RISK_WARNING_PANEL_SELECTORS.status)}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="mt-6 rounded-xl border-2 border-border bg-slate-50 p-4 text-base font-semibold leading-relaxed text-text-primary"
      >
        {statusMessage}
      </p>

      <div className="mt-6">
        <Button
          {...elementIdentity(RISK_WARNING_PANEL_SELECTORS.cancel)}
          type="button"
          variant="danger"
          size="lg"
          className="w-full whitespace-normal sm:w-auto"
          disabled={!cancelEnabled}
          aria-describedby={RISK_WARNING_PANEL_SELECTORS.status}
          onClick={handleCancel}
        >
          세션 취소 요청
        </Button>
      </div>
    </Panel>
  );
}
