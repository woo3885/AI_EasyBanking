import type { ViewerFrame } from '@/features/F2_StreamViewer/model/viewer-frame';
import type { TargetHighlightTarget } from '@/features/F3_SmartOverlay/ui/F3_SmartOverlay';
import type { AgreementTerm } from '@/shared/model/terms-agreement';
import type { UserDecisionOption } from '@/shared/model/user-decision';
import type { WorkflowStatus } from '@/types/frontend-state';

export type IntegrationConnectionState =
  | 'DISCONNECTED'
  | 'MOCK_CONNECTED';

export type IntegrationScenarioId =
  | 'TRANSFER_ACCOUNT_SELECTION'
  | 'DEPOSIT_TERMS_AGREEMENT';

export type IntegrationPhase =
  | 'IDLE'
  | 'ACCOUNT_SELECTION'
  | 'RECIPIENT_SELECTION'
  | 'TERMS_AGREEMENT'
  | 'BASELINE_REACHED'
  | 'ERROR';

export interface IntegrationSingleDecisionRequest {
  kind: 'ACCOUNT' | 'RECIPIENT';
  title: string;
  message: string;
  options: readonly UserDecisionOption[];
}

export interface IntegrationTermsRequest {
  title: string;
  message: string;
  terms: readonly AgreementTerm[];
}

export interface IntegrationState {
  connectionState: IntegrationConnectionState;
  scenarioId: IntegrationScenarioId | null;
  runId: number;
  mockSessionId: string | null;
  phase: IntegrationPhase;
  workflowStatus: WorkflowStatus;
  guideMessage: string;
  frame?: ViewerFrame;
  target: TargetHighlightTarget | null;
  targetMessage: string;
  decisionRequest: IntegrationSingleDecisionRequest | null;
  termsRequest: IntegrationTermsRequest | null;
  selectedOptionId: string | null;
  selectedTermIds: ReadonlySet<string>;
  isPaused: boolean;
  lastActionMessage: string;
  safeErrorMessage: string | null;
}

export const INITIAL_INTEGRATION_GUIDE_MESSAGE =
  '개발용 시나리오를 선택하고 Mock 시작 버튼을 눌러 주세요.';
export const INITIAL_INTEGRATION_ACTION_MESSAGE =
  '아직 요청한 Mock 동작이 없습니다.';

export function createInitialIntegrationState(runId = 0): IntegrationState {
  return {
    connectionState: 'DISCONNECTED',
    scenarioId: null,
    runId,
    mockSessionId: null,
    phase: 'IDLE',
    workflowStatus: 'SESSION_CREATED',
    guideMessage: INITIAL_INTEGRATION_GUIDE_MESSAGE,
    frame: undefined,
    target: null,
    targetMessage: '',
    decisionRequest: null,
    termsRequest: null,
    selectedOptionId: null,
    selectedTermIds: new Set<string>(),
    isPaused: false,
    lastActionMessage: INITIAL_INTEGRATION_ACTION_MESSAGE,
    safeErrorMessage: null
  };
}

export const initialIntegrationState = createInitialIntegrationState();
