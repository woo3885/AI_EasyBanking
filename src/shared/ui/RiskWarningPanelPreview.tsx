import { useState, type ChangeEvent } from 'react';

import { Panel } from './Panel';
import {
  RiskWarningPanel,
  type RiskWarningPanelProps
} from './RiskWarningPanel';
import { Text } from './Text';
import { WorkflowStatusPanel } from './WorkflowStatusPanel';

export const RISK_WARNING_PANEL_PREVIEW_SELECTORS = {
  preview: 'preview-risk-warning',
  select: 'select-preview-risk-warning-state'
} as const;

export type RiskWarningPreviewState =
  | 'GENERAL_WARNING'
  | 'VOICE_PHISHING_MESSAGE'
  | 'SAFE_ACCOUNT_MESSAGE'
  | 'CANCEL_REQUESTED'
  | 'BUSY'
  | 'DISABLED'
  | 'CANCEL_UNAVAILABLE'
  | 'INVALID_MESSAGE'
  | 'CUSTOM_MESSAGE';

interface PreviewDefinition
  extends Pick<
    RiskWarningPanelProps,
    'details' | 'cancelRequested' | 'disabled' | 'isBusy' | 'canCancel'
  > {
  label: string;
}

const previewDefinitions: Record<
  RiskWarningPreviewState,
  PreviewDefinition
> = {
  GENERAL_WARNING: {
    label: '일반 위험 경고',
    details: {
      message: '금융사기 위험 가능성이 있어 요청 내용을 다시 확인해야 합니다.'
    },
    canCancel: true
  },
  VOICE_PHISHING_MESSAGE: {
    label: '보이스피싱 의심 안내',
    details: {
      message: '보이스피싱으로 의심되는 요청일 수 있어 금융 절차를 진행하지 않습니다.'
    },
    canCancel: true
  },
  SAFE_ACCOUNT_MESSAGE: {
    label: '안전계좌 요청 주의',
    details: {
      message: '안전계좌로 자금을 옮기라는 요청은 금융사기 위험 신호일 수 있습니다.'
    },
    canCancel: true
  },
  CANCEL_REQUESTED: {
    label: '취소 요청 전달',
    details: { message: '의심스러운 금융 요청을 확인하고 있습니다.' },
    cancelRequested: true,
    canCancel: true
  },
  BUSY: {
    label: '취소 요청 처리 중',
    details: { message: '의심스러운 금융 요청을 확인하고 있습니다.' },
    isBusy: true,
    canCancel: true
  },
  DISABLED: {
    label: '패널 비활성',
    details: { message: '의심스러운 금융 요청을 확인하고 있습니다.' },
    disabled: true,
    canCancel: true
  },
  CANCEL_UNAVAILABLE: {
    label: '취소 요청 사용 불가',
    details: { message: '의심스러운 금융 요청을 확인하고 있습니다.' },
    canCancel: false
  },
  INVALID_MESSAGE: {
    label: '잘못된 경고 문구 fallback',
    details: { message: '   ' },
    canCancel: true
  },
  CUSTOM_MESSAGE: {
    label: '사용자 정의 안전 문구',
    details: {
      message: '공식 앱이나 웹사이트에서 요청 내용을 직접 확인해 주세요.'
    },
    canCancel: true
  }
};

function elementIdentity(value: string) {
  return { id: value, 'data-testid': value };
}

export function RiskWarningPanelPreview() {
  const [previewState, setPreviewState] =
    useState<RiskWarningPreviewState>('GENERAL_WARNING');
  const [lastCancelRequest, setLastCancelRequest] = useState(
    '취소 요청 callback이 아직 전달되지 않았습니다.'
  );
  const definition = previewDefinitions[previewState];

  const handlePreviewStateChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setPreviewState(event.currentTarget.value as RiskWarningPreviewState);
    setLastCancelRequest('취소 요청 callback이 아직 전달되지 않았습니다.');
  };

  return (
    <section
      {...elementIdentity(RISK_WARNING_PANEL_PREVIEW_SELECTORS.preview)}
      aria-labelledby="heading-preview-risk-warning"
      className="mx-auto w-full max-w-5xl space-y-6 p-6"
    >
      <Text id="heading-preview-risk-warning" variant="title">
        금융사기 위험 경고 패널 Preview
      </Text>
      <Text variant="body">
        모든 내용은 UI 검증용 일반 안내이며 실제 위험 탐지나 금융 기능을 실행하지 않습니다.
      </Text>

      <Panel title="Preview 상태 선택">
        <label
          htmlFor={RISK_WARNING_PANEL_PREVIEW_SELECTORS.select}
          className="block text-base font-bold text-text-primary"
        >
          확인할 위험 경고 패널 상태
        </label>
        <select
          {...elementIdentity(RISK_WARNING_PANEL_PREVIEW_SELECTORS.select)}
          value={previewState}
          onChange={handlePreviewStateChange}
          className="mt-3 min-h-12 w-full rounded-xl border-2 border-border bg-surface px-4 text-base text-text-primary focus-visible:ring-4 focus-visible:ring-brand-100"
        >
          {(Object.entries(previewDefinitions) as Array<
            [RiskWarningPreviewState, PreviewDefinition]
          >).map(([value, preview]) => (
            <option key={value} value={value}>
              {preview.label}
            </option>
          ))}
        </select>
      </Panel>

      <div className="space-y-6">
        <WorkflowStatusPanel
          status="RISK_WARNING"
          message="위험 가능성이 있어 현재 금융 절차를 계속 진행하지 않습니다."
        />
        <RiskWarningPanel
          details={definition.details}
          cancelRequested={definition.cancelRequested}
          disabled={definition.disabled}
          isBusy={definition.isBusy}
          canCancel={definition.canCancel}
          onCancel={() => {
            setLastCancelRequest(
              '사용자가 안전한 세션 취소 요청 callback을 전달했습니다.'
            );
          }}
        />
      </div>

      <output aria-live="polite" className="block text-base text-text-secondary">
        Preview 확인 결과: {lastCancelRequest} 실제 서버 요청은 전송하지 않았습니다.
      </output>
    </section>
  );
}
