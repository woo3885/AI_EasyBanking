import { useState, type ChangeEvent } from 'react';

import type { UserDecisionOption } from '@/shared/model/user-decision';
import { Panel } from './Panel';
import { Text } from './Text';
import { UserDecisionPanel } from './UserDecisionPanel';
import { WorkflowStatusPanel } from './WorkflowStatusPanel';

export const USER_DECISION_PANEL_PREVIEW_SELECTORS = {
  preview: 'preview-user-decision',
  select: 'select-preview-user-decision-type'
} as const;

type UserDecisionPreviewType =
  | 'PRODUCT'
  | 'ACCOUNT'
  | 'RECIPIENT'
  | 'EMPTY'
  | 'DISABLED_OPTION'
  | 'BUSY'
  | 'PANEL_DISABLED';

interface PreviewDefinition {
  label: string;
  title: string;
  message: string;
  options: readonly UserDecisionOption[];
  isBusy?: boolean;
  disabled?: boolean;
}

const productOptions: readonly UserDecisionOption[] = [
  {
    id: 'deposit-12m',
    label: 'Mock 12개월 정기예금',
    description: '시연을 위한 Mock 상품입니다.'
  },
  {
    id: 'deposit-preferred',
    label: 'Mock 우대금리 정기예금',
    description: '시연을 위한 또 다른 Mock 상품입니다.'
  }
];

const accountOptions: readonly UserDecisionOption[] = [
  {
    id: 'living-expense',
    label: 'Mock 생활비 계좌',
    description: '실제 계좌정보를 포함하지 않는 시연용 항목입니다.'
  },
  {
    id: 'savings',
    label: 'Mock 저축 계좌',
    description: '실제 계좌정보를 포함하지 않는 시연용 항목입니다.'
  }
];

const recipientOptions: readonly UserDecisionOption[] = [
  {
    id: 'hong-gildong',
    label: 'Mock 수취인 가',
    description: '실제 고객정보가 아닌 시연용 수취인입니다.'
  },
  {
    id: 'demo-saved',
    label: 'Mock 저장 수취인',
    description: '실제 고객정보가 아닌 시연용 수취인입니다.'
  }
];

const previewDefinitions: Record<UserDecisionPreviewType, PreviewDefinition> = {
  PRODUCT: {
    label: '상품',
    title: '가입할 Mock 상품 선택',
    message: '가입할 Mock 상품을 하나 직접 선택해 주세요.',
    options: productOptions
  },
  ACCOUNT: {
    label: '출금 계좌',
    title: '출금할 Mock 계좌 선택',
    message: '사용할 Mock 계좌를 하나 직접 선택해 주세요.',
    options: accountOptions
  },
  RECIPIENT: {
    label: '수취인',
    title: 'Mock 수취인 선택',
    message: '송금할 Mock 수취인을 하나 직접 선택해 주세요.',
    options: recipientOptions
  },
  EMPTY: {
    label: '빈 목록',
    title: '선택 항목 준비 중',
    message: '선택 항목이 준비될 때까지 현재 화면을 유지해 주세요.',
    options: []
  },
  DISABLED_OPTION: {
    label: '비활성 option',
    title: '일부 항목을 선택할 수 없는 상태',
    message: '선택 가능한 Mock 항목을 직접 확인해 주세요.',
    options: [
      productOptions[0],
      { ...productOptions[1], disabled: true }
    ]
  },
  BUSY: {
    label: '처리 중',
    title: '선택 확인 처리 중',
    message: '선택 확인 요청을 처리하고 있습니다.',
    options: productOptions,
    isBusy: true
  },
  PANEL_DISABLED: {
    label: '패널 비활성',
    title: '선택 기능을 사용할 수 없는 상태',
    message: '현재는 선택 기능을 사용할 수 없습니다.',
    options: productOptions,
    disabled: true
  }
};

function elementIdentity(value: string) {
  return { id: value, 'data-testid': value };
}

export function UserDecisionPanelPreview() {
  const [previewType, setPreviewType] =
    useState<UserDecisionPreviewType>('PRODUCT');
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState('요청이 없습니다.');
  const definition = previewDefinitions[previewType];

  const handlePreviewTypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setPreviewType(event.currentTarget.value as UserDecisionPreviewType);
    setSelectedOptionId(null);
    setLastAction('요청이 없습니다.');
  };

  const handleSelect = (optionId: string) => {
    setSelectedOptionId(optionId);
    setLastAction(`선택 요청: ${optionId}`);
  };

  const handleConfirm = (optionId: string) => {
    setLastAction(`확인 요청: ${optionId}`);
  };

  return (
    <section
      {...elementIdentity(USER_DECISION_PANEL_PREVIEW_SELECTORS.preview)}
      aria-labelledby="heading-preview-user-decision"
      className="mx-auto w-full max-w-5xl space-y-6 p-6"
    >
      <Text id="heading-preview-user-decision" variant="title">
        사용자 선택 패널 Preview
      </Text>
      <Text variant="body">
        API 연결 없이 단일 선택과 확인 callback 경계를 점검하는 개발용 Mock입니다.
      </Text>

      <Panel title="Preview 유형 선택">
        <label
          htmlFor={USER_DECISION_PANEL_PREVIEW_SELECTORS.select}
          className="block text-base font-bold text-text-primary"
        >
          확인할 사용자 선택 유형
        </label>
        <select
          {...elementIdentity(USER_DECISION_PANEL_PREVIEW_SELECTORS.select)}
          value={previewType}
          onChange={handlePreviewTypeChange}
          className="mt-3 min-h-12 w-full rounded-xl border-2 border-border bg-surface px-4 text-base text-text-primary focus-visible:ring-4 focus-visible:ring-brand-100"
        >
          {(Object.entries(previewDefinitions) as Array<
            [UserDecisionPreviewType, PreviewDefinition]
          >).map(([value, preview]) => (
            <option key={value} value={value}>
              {preview.label}
            </option>
          ))}
        </select>
      </Panel>

      <WorkflowStatusPanel
        status="USER_DECISION_REQUIRED"
        message="표시된 항목을 확인하고 직접 선택해 주세요."
      />
      <UserDecisionPanel
        title={definition.title}
        message={definition.message}
        options={definition.options}
        selectedOptionId={selectedOptionId}
        disabled={definition.disabled}
        isBusy={definition.isBusy}
        onSelect={handleSelect}
        onConfirm={handleConfirm}
      />

      <output aria-live="polite" className="block text-base text-text-secondary">
        마지막 Preview 동작: {lastAction}
      </output>
    </section>
  );
}
