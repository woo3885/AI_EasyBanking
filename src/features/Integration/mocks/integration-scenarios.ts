import accountFrameSource from './demo-bank-transfer-accounts.svg';
import recipientFrameSource from './demo-bank-transfer-recipients.svg';

import type { ViewerFrame } from '@/features/F2_StreamViewer/model/viewer-frame';
import type { TargetHighlightTarget } from '@/features/F3_SmartOverlay/ui/F3_SmartOverlay';
import type { AgreementTerm } from '@/shared/model/terms-agreement';
import type { UserDecisionOption } from '@/shared/model/user-decision';

export const MOCK_INTEGRATION_SESSION_ID = 'mock-integration-d16-001';

export const ACCOUNT_DECISION_OPTIONS: readonly UserDecisionOption[] = [
  {
    id: 'living-expense',
    label: '생활비 계좌',
    description: 'D16 로컬 Mock 계좌 항목입니다.'
  },
  {
    id: 'savings',
    label: '저축 계좌',
    description: 'D16 로컬 Mock 계좌 항목입니다.'
  }
];

export const RECIPIENT_DECISION_OPTIONS: readonly UserDecisionOption[] = [
  {
    id: 'hong-gildong',
    label: 'Mock 수취인 홍길동',
    description: '실제 고객정보가 아닌 개발용 표시 항목입니다.'
  },
  {
    id: 'saved-recipient',
    label: 'Mock 저장 수취인',
    description: '실제 고객정보가 아닌 개발용 표시 항목입니다.'
  }
];

export const MOCK_AGREEMENT_TERMS: readonly AgreementTerm[] = [
  {
    id: 'service-agreement',
    label: '서비스 이용약관',
    required: true,
    description: 'D16 조합 검증용 필수 Mock 약관입니다.'
  },
  {
    id: 'personal-information',
    label: '개인정보 수집·이용',
    required: true,
    description: 'D16 조합 검증용 필수 Mock 약관입니다.'
  },
  {
    id: 'marketing-information',
    label: '마케팅 정보 수신',
    required: false,
    description: 'D16 조합 검증용 선택 Mock 약관입니다.'
  }
];

function createFrame(imageSrc: string, timestamp: number): ViewerFrame {
  return {
    metadata: {
      type: 'BROWSER_FRAME',
      sessionId: MOCK_INTEGRATION_SESSION_ID,
      timestamp,
      width: 1280,
      height: 720
    },
    imageSrc
  };
}

export const ACCOUNT_SELECTION_FRAME = createFrame(accountFrameSource, 1);
export const RECIPIENT_SELECTION_FRAME = createFrame(recipientFrameSource, 2);

export const ACCOUNT_SELECTION_TARGET: TargetHighlightTarget = {
  elementId: 'btn-select-account-living-expense',
  x: 348,
  y: 408,
  width: 212,
  height: 64
};

export const RECIPIENT_SELECTION_TARGET: TargetHighlightTarget = {
  elementId: 'btn-select-recipient-hong-gildong',
  x: 348,
  y: 390,
  width: 212,
  height: 64
};
