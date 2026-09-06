import { useState, type ChangeEvent } from 'react';

import type { AgreementTerm } from '@/shared/model/terms-agreement';
import { Panel } from './Panel';
import { TermsAgreementPanel } from './TermsAgreementPanel';
import { Text } from './Text';
import { WorkflowStatusPanel } from './WorkflowStatusPanel';

export const TERMS_AGREEMENT_PANEL_PREVIEW_SELECTORS = {
  preview: 'preview-terms-agreement',
  select: 'select-preview-terms-agreement-state',
  status: 'status-preview-terms-agreement-action'
} as const;

export type TermsAgreementPreviewState =
  | 'DEFAULT'
  | 'ONE_REQUIRED_SELECTED'
  | 'ALL_REQUIRED_SELECTED'
  | 'OPTIONAL_SELECTED'
  | 'EMPTY'
  | 'INVALID'
  | 'DISABLED_OPTIONAL'
  | 'DISABLED_REQUIRED'
  | 'BUSY'
  | 'PANEL_DISABLED';

interface PreviewDefinition {
  label: string;
  terms: readonly AgreementTerm[];
  selectedTermIds: readonly string[];
  isBusy?: boolean;
  disabled?: boolean;
}

const mockTerms: readonly AgreementTerm[] = [
  {
    id: 'service-agreement',
    label: '서비스 이용약관',
    required: true,
    description: '화면 동작을 확인하기 위한 필수 Mock 약관입니다.'
  },
  {
    id: 'personal-information',
    label: '개인정보 수집·이용',
    required: true,
    description: '실제 개인정보를 포함하지 않는 필수 Mock 약관입니다.'
  },
  {
    id: 'marketing-information',
    label: '마케팅 정보 수신',
    required: false,
    description: '선택 동작을 확인하기 위한 선택 Mock 약관입니다.'
  }
];

const requiredIds = ['service-agreement', 'personal-information'] as const;

const previewDefinitions: Record<
  TermsAgreementPreviewState,
  PreviewDefinition
> = {
  DEFAULT: {
    label: '기본 미선택',
    terms: mockTerms,
    selectedTermIds: []
  },
  ONE_REQUIRED_SELECTED: {
    label: '필수 한 개 선택',
    terms: mockTerms,
    selectedTermIds: [requiredIds[0]]
  },
  ALL_REQUIRED_SELECTED: {
    label: '필수 모두 선택',
    terms: mockTerms,
    selectedTermIds: requiredIds
  },
  OPTIONAL_SELECTED: {
    label: '선택 약관 포함',
    terms: mockTerms,
    selectedTermIds: [...requiredIds, 'marketing-information']
  },
  EMPTY: {
    label: '빈 목록',
    terms: [],
    selectedTermIds: []
  },
  INVALID: {
    label: '유효하지 않은 목록',
    terms: [{ id: 'INVALID_ID', label: '노출 금지 원본', required: true }],
    selectedTermIds: []
  },
  DISABLED_OPTIONAL: {
    label: '선택 약관 비활성화',
    terms: [
      mockTerms[0],
      mockTerms[1],
      { ...mockTerms[2], disabled: true }
    ],
    selectedTermIds: [...requiredIds, 'marketing-information']
  },
  DISABLED_REQUIRED: {
    label: '필수 약관 비활성화',
    terms: [
      { ...mockTerms[0], disabled: true },
      mockTerms[1],
      mockTerms[2]
    ],
    selectedTermIds: requiredIds
  },
  BUSY: {
    label: '처리 중',
    terms: mockTerms,
    selectedTermIds: requiredIds,
    isBusy: true
  },
  PANEL_DISABLED: {
    label: '패널 비활성화',
    terms: mockTerms,
    selectedTermIds: requiredIds,
    disabled: true
  }
};

function elementIdentity(value: string) {
  return { id: value, 'data-testid': value };
}

export function TermsAgreementPanelPreview() {
  const [previewState, setPreviewState] =
    useState<TermsAgreementPreviewState>('DEFAULT');
  const [selectedTermIds, setSelectedTermIds] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [lastAction, setLastAction] = useState('요청이 없습니다.');
  const definition = previewDefinitions[previewState];

  const handlePreviewStateChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextState = event.currentTarget.value as TermsAgreementPreviewState;
    setPreviewState(nextState);
    setSelectedTermIds(new Set(previewDefinitions[nextState].selectedTermIds));
    setLastAction('요청이 없습니다.');
  };

  const handleToggle = (termId: string, selected: boolean) => {
    setSelectedTermIds((previous) => {
      const next = new Set(previous);
      if (selected) {
        next.add(termId);
      } else {
        next.delete(termId);
      }
      return next;
    });
    setLastAction(`선택 요청: ${termId} ${selected ? '선택' : '해제'}`);
  };

  const handleConfirm = (confirmedTermIds: readonly string[]) => {
    setLastAction(
      `확인 요청: ${confirmedTermIds.join(', ') || '선택 약관 없음'}`
    );
  };

  return (
    <section
      {...elementIdentity(TERMS_AGREEMENT_PANEL_PREVIEW_SELECTORS.preview)}
      aria-labelledby="heading-preview-terms-agreement"
      className="mx-auto w-full max-w-5xl space-y-6 p-6"
    >
      <Text id="heading-preview-terms-agreement" variant="title">
        약관 동의 패널 Preview
      </Text>
      <Text variant="body">
        모든 내용은 UI 검증용 Mock이며 실제 법률 약관이 아닙니다.
      </Text>

      <Panel title="Preview 상태 선택">
        <label
          htmlFor={TERMS_AGREEMENT_PANEL_PREVIEW_SELECTORS.select}
          className="block text-base font-bold text-text-primary"
        >
          확인할 약관 패널 상태
        </label>
        <select
          {...elementIdentity(TERMS_AGREEMENT_PANEL_PREVIEW_SELECTORS.select)}
          value={previewState}
          onChange={handlePreviewStateChange}
          className="mt-3 min-h-12 w-full rounded-xl border-2 border-border bg-surface px-4 text-base text-text-primary focus-visible:ring-4 focus-visible:ring-brand-100"
        >
          {(Object.entries(previewDefinitions) as Array<
            [TermsAgreementPreviewState, PreviewDefinition]
          >).map(([value, preview]) => (
            <option key={value} value={value}>
              {preview.label}
            </option>
          ))}
        </select>
      </Panel>

      <div className="space-y-6">
        <WorkflowStatusPanel
          status="USER_DECISION_REQUIRED"
          message="사용자가 약관을 직접 확인하고 선택해야 합니다."
        />
        <TermsAgreementPanel
          terms={definition.terms}
          selectedTermIds={selectedTermIds}
          disabled={definition.disabled}
          isBusy={definition.isBusy}
          onToggle={handleToggle}
          onConfirm={handleConfirm}
        />
      </div>

      <output
        {...elementIdentity(TERMS_AGREEMENT_PANEL_PREVIEW_SELECTORS.status)}
        aria-live="polite"
        className="block text-base leading-relaxed text-text-secondary"
      >
        마지막 Preview 동작: {lastAction} 실제 서버로 전송되지 않았습니다.
      </output>
    </section>
  );
}
