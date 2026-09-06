import {
  analyzeFinalConfirmationSummary,
  canApproveFinalConfirmation,
  createFinalConfirmationSummaryItemElementId,
  type FinalConfirmationSummary
} from '@/shared/model/final-confirmation';
import { Button } from './Button';
import { Panel } from './Panel';
import { Text } from './Text';

export const FINAL_CONFIRMATION_PANEL_SELECTORS = {
  panel: 'panel-final-confirmation',
  heading: 'heading-final-confirmation',
  summary: 'summary-final-confirmation',
  checkbox: 'checkbox-final-confirmation',
  status: 'status-final-confirmation',
  approve: 'btn-final-approve',
  edit: 'btn-final-edit',
  cancel: 'btn-final-cancel'
} as const;

export interface FinalConfirmationPanelProps {
  title?: string;
  message?: string;
  summary: FinalConfirmationSummary;
  confirmed: boolean;
  approvalRequested?: boolean;
  disabled?: boolean;
  isBusy?: boolean;
  canEdit?: boolean;
  canCancel?: boolean;
  onConfirmedChange: (confirmed: boolean) => void;
  onApprove: () => void;
  onEdit: () => void;
  onCancel: () => void;
  className?: string;
}

const DEFAULT_TITLE = '최종 거래 확인';
const DEFAULT_MESSAGE =
  '표시된 내용을 확인하고, 실제 실행에 동의하는 경우에만 직접 확인 항목을 선택해 주세요.';
const INITIAL_STATUS_MESSAGE =
  '최종 확인 항목을 직접 선택해야 승인 요청을 진행할 수 있습니다.';
const CONFIRMED_STATUS_MESSAGE =
  '내용 확인을 선택했습니다. 승인 버튼을 눌러야 요청이 전달됩니다.';
const APPROVAL_REQUESTED_STATUS_MESSAGE =
  '최종 승인 요청을 전달했습니다. 처리 결과를 확인할 때까지 기다려 주세요.';
const BUSY_STATUS_MESSAGE = '최종 승인 요청을 처리하고 있습니다.';
const DISABLED_STATUS_MESSAGE =
  '현재는 최종 확인 요청을 진행할 수 없습니다.';
const EMPTY_STATUS_MESSAGE =
  '거래 요약을 준비하고 있습니다. 승인 요청을 진행할 수 없습니다.';
const INVALID_STATUS_MESSAGE =
  '거래 요약을 안전하게 표시할 수 없습니다. 승인 요청을 진행할 수 없습니다.';

function elementIdentity(value: string) {
  return { id: value, 'data-testid': value };
}

function normalizedText(value: string | undefined, fallback: string): string {
  const normalizedValue = value?.trim();
  return normalizedValue || fallback;
}

export function FinalConfirmationPanel({
  title,
  message,
  summary,
  confirmed,
  approvalRequested = false,
  disabled = false,
  isBusy = false,
  canEdit = false,
  canCancel = false,
  onConfirmedChange,
  onApprove,
  onEdit,
  onCancel,
  className
}: FinalConfirmationPanelProps) {
  const analysis = analyzeFinalConfirmationSummary(summary);
  const readySummary =
    analysis.state === 'READY' ? analysis.summary : null;
  const summaryReady = readySummary !== null;
  const pending = isBusy || approvalRequested;
  const controlsDisabled = disabled || pending;
  const checkboxDisabled = controlsDisabled || !summaryReady;
  const approveEnabled = canApproveFinalConfirmation(
    summary,
    confirmed,
    disabled,
    isBusy,
    approvalRequested
  );
  const editEnabled = canEdit && !controlsDisabled;
  const cancelEnabled = canCancel && !controlsDisabled;
  const displayedTitle = normalizedText(title, DEFAULT_TITLE);
  const displayedMessage = normalizedText(message, DEFAULT_MESSAGE);

  const statusMessage = isBusy
    ? BUSY_STATUS_MESSAGE
    : approvalRequested
      ? APPROVAL_REQUESTED_STATUS_MESSAGE
      : disabled
        ? DISABLED_STATUS_MESSAGE
        : analysis.state === 'INVALID'
          ? INVALID_STATUS_MESSAGE
          : analysis.state === 'EMPTY'
            ? EMPTY_STATUS_MESSAGE
            : confirmed
              ? CONFIRMED_STATUS_MESSAGE
              : INITIAL_STATUS_MESSAGE;

  const handleApprove = () => {
    if (
      canApproveFinalConfirmation(
        summary,
        confirmed,
        disabled,
        isBusy,
        approvalRequested
      )
    ) {
      onApprove();
    }
  };

  return (
    <Panel
      {...elementIdentity(FINAL_CONFIRMATION_PANEL_SELECTORS.panel)}
      aria-labelledby={FINAL_CONFIRMATION_PANEL_SELECTORS.heading}
      aria-describedby={FINAL_CONFIRMATION_PANEL_SELECTORS.status}
      aria-busy={pending}
      className={['w-full', className].filter(Boolean).join(' ')}
    >
      <h2
        {...elementIdentity(FINAL_CONFIRMATION_PANEL_SELECTORS.heading)}
        className="text-2xl font-bold leading-snug text-text-primary"
      >
        {displayedTitle}
      </h2>
      <Text variant="guide" className="mt-3 text-text-secondary">
        {displayedMessage}
      </Text>

      <dl
        {...elementIdentity(FINAL_CONFIRMATION_PANEL_SELECTORS.summary)}
        className="mt-6 grid overflow-hidden rounded-xl border-2 border-border bg-surface"
      >
        {readySummary !== null ? (
          <>
            <div className="grid gap-1 border-b-2 border-border p-4 sm:grid-cols-[minmax(10rem,1fr)_minmax(0,2fr)] sm:gap-5">
              <dt className="text-base font-bold leading-relaxed text-text-secondary">
                거래 유형
              </dt>
              <dd className="break-words text-lg font-bold leading-relaxed text-text-primary">
                {readySummary.transactionType}
              </dd>
            </div>
            {readySummary.items.map((item, index) => {
              const itemElementId =
                createFinalConfirmationSummaryItemElementId(item.id);

              if (itemElementId === null) {
                return null;
              }

              return (
                <div
                  key={item.id}
                  {...elementIdentity(itemElementId)}
                  className={[
                    'grid gap-1 p-4 sm:grid-cols-[minmax(10rem,1fr)_minmax(0,2fr)] sm:gap-5',
                    index < readySummary.items.length - 1
                      ? 'border-b-2 border-border'
                      : ''
                  ].join(' ')}
                >
                  <dt className="break-words text-base font-bold leading-relaxed text-text-secondary">
                    {item.label}
                  </dt>
                  <dd className="break-words text-lg leading-relaxed text-text-primary">
                    {item.value}
                  </dd>
                </div>
              );
            })}
          </>
        ) : (
          <div className="p-4">
            <dt className="sr-only">거래 요약 상태</dt>
            <dd className="text-base leading-relaxed text-text-secondary">
              안전하게 표시할 수 있는 거래 요약이 없습니다.
            </dd>
          </div>
        )}
      </dl>

      <label
        htmlFor={FINAL_CONFIRMATION_PANEL_SELECTORS.checkbox}
        className={[
          'mt-6 flex min-h-14 items-start gap-4 rounded-xl border-2 p-4',
          'focus-within:ring-4 focus-within:ring-brand-100 focus-within:ring-offset-2',
          'forced-colors:border-[CanvasText]',
          checkboxDisabled
            ? 'cursor-not-allowed border-border bg-slate-100 opacity-70'
            : 'cursor-pointer border-primary bg-brand-50 hover:bg-brand-100'
        ].join(' ')}
      >
        <input
          {...elementIdentity(FINAL_CONFIRMATION_PANEL_SELECTORS.checkbox)}
          type="checkbox"
          checked={summaryReady && confirmed}
          disabled={checkboxDisabled}
          aria-describedby={FINAL_CONFIRMATION_PANEL_SELECTORS.status}
          onChange={(event) => {
            if (!checkboxDisabled) {
              onConfirmedChange(event.currentTarget.checked);
            }
          }}
          className="mt-1 size-5 shrink-0 accent-primary focus-visible:ring-4 focus-visible:ring-brand-100"
        />
        <span className="text-lg font-bold leading-relaxed text-text-primary">
          표시된 거래 내용을 확인했으며 최종 승인 요청에 동의합니다.
        </span>
      </label>

      <p
        {...elementIdentity(FINAL_CONFIRMATION_PANEL_SELECTORS.status)}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="mt-5 rounded-xl border-2 border-border bg-slate-50 p-4 text-base font-semibold leading-relaxed text-text-primary"
      >
        {statusMessage}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Button
          {...elementIdentity(FINAL_CONFIRMATION_PANEL_SELECTORS.edit)}
          type="button"
          variant="secondary"
          size="lg"
          className="w-full whitespace-normal"
          disabled={!editEnabled}
          onClick={() => {
            if (editEnabled) {
              onEdit();
            }
          }}
        >
          내용 수정
        </Button>
        <Button
          {...elementIdentity(FINAL_CONFIRMATION_PANEL_SELECTORS.cancel)}
          type="button"
          variant="danger"
          size="lg"
          className="w-full whitespace-normal"
          disabled={!cancelEnabled}
          onClick={() => {
            if (cancelEnabled) {
              onCancel();
            }
          }}
        >
          최종 확인 취소
        </Button>
        <Button
          {...elementIdentity(FINAL_CONFIRMATION_PANEL_SELECTORS.approve)}
          type="button"
          size="lg"
          className="w-full whitespace-normal"
          disabled={!approveEnabled}
          aria-describedby={FINAL_CONFIRMATION_PANEL_SELECTORS.status}
          onClick={handleApprove}
        >
          최종 승인 요청
        </Button>
      </div>
    </Panel>
  );
}
