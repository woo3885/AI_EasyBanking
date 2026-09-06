import { useState, type ChangeEvent } from 'react';

import type { FinalConfirmationSummary } from '@/shared/model/final-confirmation';
import { FinalConfirmationPanel } from './FinalConfirmationPanel';
import { Panel } from './Panel';
import { Text } from './Text';
import { WorkflowStatusPanel } from './WorkflowStatusPanel';

export const FINAL_CONFIRMATION_PANEL_PREVIEW_SELECTORS = {
  preview: 'preview-final-confirmation',
  select: 'select-preview-final-confirmation-state'
} as const;

export type FinalConfirmationPreviewState =
  | 'TRANSFER_UNCONFIRMED'
  | 'TRANSFER_CONFIRMED'
  | 'DEPOSIT_UNCONFIRMED'
  | 'APPROVAL_REQUESTED'
  | 'BUSY'
  | 'DISABLED'
  | 'INVALID_SUMMARY'
  | 'EDIT_REQUESTED'
  | 'CANCEL_REQUESTED';

interface PreviewDefinition {
  label: string;
  summary: FinalConfirmationSummary;
  confirmed: boolean;
  approvalRequested?: boolean;
  isBusy?: boolean;
  disabled?: boolean;
  canEdit?: boolean;
  canCancel?: boolean;
  initialAction?: string;
}

const transferSummary: FinalConfirmationSummary = {
  transactionType: '계좌이체 데모',
  items: [
    { id: 'source-account', label: '출금 계좌', value: '생활비 계좌' },
    { id: 'recipient', label: '수취인', value: '데모 수취인' },
    { id: 'amount', label: '금액', value: '100,000원' }
  ]
};

const depositSummary: FinalConfirmationSummary = {
  transactionType: '정기예금 가입 데모',
  items: [
    { id: 'product-name', label: '상품명', value: '12개월 정기예금 Mock' },
    { id: 'period', label: '가입 기간', value: '12개월' },
    { id: 'amount', label: '가입 금액', value: '500,000원' },
    { id: 'required-terms', label: '필수 약관', value: '사용자 확인 완료' }
  ]
};

const invalidSummary: FinalConfirmationSummary = {
  transactionType: '데모 거래',
  items: [
    { id: 'INVALID_ID', label: '표시 금지 항목', value: '표시 금지 원본' }
  ]
};

const previewDefinitions: Record<
  FinalConfirmationPreviewState,
  PreviewDefinition
> = {
  TRANSFER_UNCONFIRMED: {
    label: '이체 요약 · 확인 전',
    summary: transferSummary,
    confirmed: false,
    canEdit: true,
    canCancel: true
  },
  TRANSFER_CONFIRMED: {
    label: '이체 요약 · 확인 선택',
    summary: transferSummary,
    confirmed: true,
    canEdit: true,
    canCancel: true
  },
  DEPOSIT_UNCONFIRMED: {
    label: '예금 요약 · 확인 전',
    summary: depositSummary,
    confirmed: false,
    canEdit: true,
    canCancel: true
  },
  APPROVAL_REQUESTED: {
    label: '승인 요청 전달',
    summary: transferSummary,
    confirmed: true,
    approvalRequested: true,
    canEdit: true,
    canCancel: true,
    initialAction: '최종 승인 요청을 전달한 Preview 상태입니다.'
  },
  BUSY: {
    label: '처리 중',
    summary: transferSummary,
    confirmed: true,
    isBusy: true,
    canEdit: true,
    canCancel: true
  },
  DISABLED: {
    label: '패널 비활성',
    summary: transferSummary,
    confirmed: true,
    disabled: true,
    canEdit: true,
    canCancel: true
  },
  INVALID_SUMMARY: {
    label: '유효하지 않은 요약',
    summary: invalidSummary,
    confirmed: false,
    canEdit: true,
    canCancel: true
  },
  EDIT_REQUESTED: {
    label: '수정 요청',
    summary: transferSummary,
    confirmed: false,
    canEdit: true,
    canCancel: true,
    initialAction: '내용 수정 요청을 확인하는 Preview 상태입니다.'
  },
  CANCEL_REQUESTED: {
    label: '취소 요청',
    summary: transferSummary,
    confirmed: false,
    canEdit: true,
    canCancel: true,
    initialAction: '최종 확인 취소 요청을 확인하는 Preview 상태입니다.'
  }
};

function elementIdentity(value: string) {
  return { id: value, 'data-testid': value };
}

export function FinalConfirmationPanelPreview() {
  const [previewState, setPreviewState] =
    useState<FinalConfirmationPreviewState>('TRANSFER_UNCONFIRMED');
  const [confirmed, setConfirmed] = useState(false);
  const [lastAction, setLastAction] = useState('요청이 없습니다.');
  const definition = previewDefinitions[previewState];

  const handlePreviewStateChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextState = event.currentTarget
      .value as FinalConfirmationPreviewState;
    const nextDefinition = previewDefinitions[nextState];
    setPreviewState(nextState);
    setConfirmed(nextDefinition.confirmed);
    setLastAction(nextDefinition.initialAction ?? '요청이 없습니다.');
  };

  const handleConfirmedChange = (nextConfirmed: boolean) => {
    setConfirmed(nextConfirmed);
    setLastAction(
      nextConfirmed
        ? '사용자가 최종 확인 항목을 선택했습니다.'
        : '사용자가 최종 확인 항목을 해제했습니다.'
    );
  };

  const handleApprove = () => {
    setPreviewState('APPROVAL_REQUESTED');
    setConfirmed(true);
    setLastAction(
      '최종 승인 요청을 전달했습니다. 실제 금융 거래는 실행하지 않았습니다.'
    );
  };

  const handleEdit = () => {
    setPreviewState('EDIT_REQUESTED');
    setConfirmed(false);
    setLastAction('내용 수정 요청을 전달했습니다. 화면 이동은 하지 않았습니다.');
  };

  const handleCancel = () => {
    setPreviewState('CANCEL_REQUESTED');
    setConfirmed(false);
    setLastAction(
      '최종 확인 취소 요청을 전달했습니다. 세션 상태는 변경하지 않았습니다.'
    );
  };

  return (
    <section
      {...elementIdentity(FINAL_CONFIRMATION_PANEL_PREVIEW_SELECTORS.preview)}
      aria-labelledby="heading-preview-final-confirmation"
      className="mx-auto w-full max-w-5xl space-y-6 p-6"
    >
      <Text id="heading-preview-final-confirmation" variant="title">
        최종 거래 승인 패널 Preview
      </Text>
      <Text variant="body">
        모든 내용은 UI 검증용 Mock이며 실제 금융 거래나 승인을 실행하지 않습니다.
      </Text>

      <Panel title="Preview 상태 선택">
        <label
          htmlFor={FINAL_CONFIRMATION_PANEL_PREVIEW_SELECTORS.select}
          className="block text-base font-bold text-text-primary"
        >
          확인할 최종 승인 패널 상태
        </label>
        <select
          {...elementIdentity(FINAL_CONFIRMATION_PANEL_PREVIEW_SELECTORS.select)}
          value={previewState}
          onChange={handlePreviewStateChange}
          className="mt-3 min-h-12 w-full rounded-xl border-2 border-border bg-surface px-4 text-base text-text-primary focus-visible:ring-4 focus-visible:ring-brand-100"
        >
          {(Object.entries(previewDefinitions) as Array<
            [FinalConfirmationPreviewState, PreviewDefinition]
          >).map(([value, preview]) => (
            <option key={value} value={value}>
              {preview.label}
            </option>
          ))}
        </select>
      </Panel>

      <div className="space-y-6">
        <WorkflowStatusPanel
          status="FINAL_CONFIRMATION_REQUIRED"
          message="표시된 내용을 확인하고 직접 승인 여부를 선택해 주세요."
        />
        <FinalConfirmationPanel
          summary={definition.summary}
          confirmed={confirmed}
          approvalRequested={definition.approvalRequested}
          disabled={definition.disabled}
          isBusy={definition.isBusy}
          canEdit={definition.canEdit}
          canCancel={definition.canCancel}
          onConfirmedChange={handleConfirmedChange}
          onApprove={handleApprove}
          onEdit={handleEdit}
          onCancel={handleCancel}
        />
      </div>

      <output aria-live="polite" className="block text-base text-text-secondary">
        마지막 Preview 동작: {lastAction} 실제 서버로 전송되지 않았습니다.
      </output>
    </section>
  );
}
