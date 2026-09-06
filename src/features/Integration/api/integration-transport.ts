import type { ViewerFrame } from '@/features/F2_StreamViewer/model/viewer-frame';
import type { TargetHighlightTarget } from '@/features/F3_SmartOverlay/ui/F3_SmartOverlay';
import type {
  IntegrationScenarioId,
  IntegrationSingleDecisionRequest,
  IntegrationTermsRequest
} from '@/features/Integration/model/integration-state';
import type { WorkflowStatus } from '@/types/frontend-state';

interface RunScopedMockEvent {
  runId: number;
}

export type IntegrationTransportEvent =
  | (RunScopedMockEvent & {
      type: 'MOCK_SESSION_STARTED';
      scenarioId: IntegrationScenarioId;
      mockSessionId: string;
    })
  | (RunScopedMockEvent & {
      type: 'MOCK_WORKFLOW_STATUS_RECEIVED';
      workflowStatus: WorkflowStatus;
      guideMessage: string;
    })
  | (RunScopedMockEvent & {
      type: 'MOCK_FRAME_RECEIVED';
      frame: ViewerFrame;
    })
  | (RunScopedMockEvent & {
      type: 'MOCK_TARGET_RECEIVED';
      target: TargetHighlightTarget | null;
      message: string;
    })
  | (RunScopedMockEvent & {
      type: 'MOCK_SINGLE_DECISION_REQUEST_RECEIVED';
      request: IntegrationSingleDecisionRequest;
    })
  | (RunScopedMockEvent & {
      type: 'MOCK_TERMS_REQUEST_RECEIVED';
      request: IntegrationTermsRequest;
    })
  | (RunScopedMockEvent & {
      type: 'MOCK_SINGLE_DECISION_CONFIRM_ACKNOWLEDGED';
      message: string;
    })
  | (RunScopedMockEvent & {
      type: 'MOCK_TERMS_CONFIRM_ACKNOWLEDGED';
      message: string;
    })
  | (RunScopedMockEvent & {
      type: 'MOCK_RECIPIENT_PHASE_ENTERED';
    })
  | (RunScopedMockEvent & {
      type: 'MOCK_BASELINE_REACHED';
      guideMessage: string;
    })
  | (RunScopedMockEvent & {
      type: 'MOCK_SAFE_ERROR';
      safeMessage: string;
    });

export type IntegrationTransportListener = (
  event: IntegrationTransportEvent
) => void;

/**
 * D16 로컬 Preview가 향후 transport 경계를 검증하기 위한 내부 interface다.
 * Backend REST, WebSocket 또는 사용자 Action payload의 확정 계약이 아니다.
 */
export interface IntegrationTransport {
  subscribe(listener: IntegrationTransportListener): () => void;
  startScenario(scenarioId: IntegrationScenarioId): void;
  submitSingleDecision(optionId: string): void;
  submitTermsAgreement(selectedTermIds: readonly string[]): void;
  stop(): void;
}
