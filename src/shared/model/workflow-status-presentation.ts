import type { WorkflowStatus } from '@/types/frontend-state';

export type WorkflowStatusTone =
  | 'neutral'
  | 'progress'
  | 'success'
  | 'warning'
  | 'danger';

export interface WorkflowStatusPresentation {
  title: string;
  description: string;
  tone: WorkflowStatusTone;
  isBusy: boolean;
  isError: boolean;
  isTerminal: boolean;
  showIndicator: boolean;
}

const WORKFLOW_STATUSES = new Set<string>([
  'SESSION_CREATED',
  'PAGE_LOADING',
  'AI_EXECUTING',
  'USER_DECISION_REQUIRED',
  'SECURE_INPUT_REQUIRED',
  'FINAL_CONFIRMATION_REQUIRED',
  'ADDITIONAL_INFORMATION_REQUIRED',
  'RISK_WARNING',
  'COMPLETED',
  'CANCELLED',
  'ERROR',
  'TERMINATED'
] satisfies WorkflowStatus[]);

function createPresentation(
  presentation: WorkflowStatusPresentation
): WorkflowStatusPresentation {
  return { ...presentation };
}

function assertNever(value: never): never {
  throw new Error(`Unhandled WorkflowStatus: ${String(value)}`);
}

export function isWorkflowStatus(value: unknown): value is WorkflowStatus {
  return typeof value === 'string' && WORKFLOW_STATUSES.has(value);
}

export function isWorkflowLoadingStatus(status: unknown): boolean {
  return status === 'PAGE_LOADING';
}

export function isWorkflowExecutingStatus(status: unknown): boolean {
  return status === 'AI_EXECUTING';
}

export function isWorkflowErrorStatus(status: unknown): boolean {
  return status === 'ERROR';
}

function getKnownWorkflowStatusPresentation(
  status: WorkflowStatus
): WorkflowStatusPresentation {
  switch (status) {
    case 'SESSION_CREATED':
      return createPresentation({
        title: '세션 준비 완료',
        description: '금융 업무 안내를 시작할 준비가 되었습니다.',
        tone: 'neutral',
        isBusy: false,
        isError: false,
        isTerminal: false,
        showIndicator: false
      });
    case 'PAGE_LOADING':
      return createPresentation({
        title: '금융 페이지를 불러오는 중',
        description: '페이지가 준비될 때까지 현재 화면에서 기다려 주세요.',
        tone: 'progress',
        isBusy: true,
        isError: false,
        isTerminal: false,
        showIndicator: true
      });
    case 'AI_EXECUTING':
      return createPresentation({
        title: 'AI 안내 작업 진행 중',
        description: 'AI가 화면을 확인하고 다음 안내를 준비하고 있습니다.',
        tone: 'progress',
        isBusy: true,
        isError: false,
        isTerminal: false,
        showIndicator: true
      });
    case 'USER_DECISION_REQUIRED':
      return createPresentation({
        title: '사용자 선택 필요',
        description: '화면의 선택 항목을 확인하고 직접 선택해 주세요.',
        tone: 'warning',
        isBusy: false,
        isError: false,
        isTerminal: false,
        showIndicator: false
      });
    case 'SECURE_INPUT_REQUIRED':
      return createPresentation({
        title: '보호 입력 필요',
        description: '보호된 정보는 현재 금융 화면에서 직접 입력해 주세요.',
        tone: 'warning',
        isBusy: false,
        isError: false,
        isTerminal: false,
        showIndicator: false
      });
    case 'FINAL_CONFIRMATION_REQUIRED':
      return createPresentation({
        title: '최종 확인 필요',
        description: '실행 전 내용을 확인하고 직접 승인 여부를 선택해 주세요.',
        tone: 'warning',
        isBusy: false,
        isError: false,
        isTerminal: false,
        showIndicator: false
      });
    case 'ADDITIONAL_INFORMATION_REQUIRED':
      return createPresentation({
        title: '추가 정보 필요',
        description: '계속 진행하려면 화면의 질문에 답해 주세요.',
        tone: 'warning',
        isBusy: false,
        isError: false,
        isTerminal: false,
        showIndicator: false
      });
    case 'RISK_WARNING':
      return createPresentation({
        title: '위험 징후 확인 필요',
        description: '안전을 위해 진행을 멈췄습니다. 현재 안내를 확인해 주세요.',
        tone: 'danger',
        isBusy: false,
        isError: false,
        isTerminal: false,
        showIndicator: false
      });
    case 'COMPLETED':
      return createPresentation({
        title: '업무 안내 완료',
        description: '요청한 금융 업무의 안내 흐름이 완료되었습니다.',
        tone: 'success',
        isBusy: false,
        isError: false,
        isTerminal: true,
        showIndicator: false
      });
    case 'CANCELLED':
      return createPresentation({
        title: '업무 취소',
        description: '사용자의 요청으로 금융 업무 안내를 취소했습니다.',
        tone: 'neutral',
        isBusy: false,
        isError: false,
        isTerminal: true,
        showIndicator: false
      });
    case 'ERROR':
      return createPresentation({
        title: '업무 처리 오류',
        description: '요청을 처리하지 못했습니다. 현재 화면의 안내를 확인해 주세요.',
        tone: 'danger',
        isBusy: false,
        isError: true,
        isTerminal: true,
        showIndicator: false
      });
    case 'TERMINATED':
      return createPresentation({
        title: '세션 종료',
        description: '금융 업무 안내 세션이 종료되었습니다.',
        tone: 'neutral',
        isBusy: false,
        isError: false,
        isTerminal: true,
        showIndicator: false
      });
    default:
      return assertNever(status);
  }
}

export function getWorkflowStatusPresentation(
  status: unknown
): WorkflowStatusPresentation {
  if (!isWorkflowStatus(status)) {
    return createPresentation({
      title: '상태를 확인하고 있음',
      description: '잠시 후 다시 확인하고 현재 화면을 안전하게 유지해 주세요.',
      tone: 'neutral',
      isBusy: false,
      isError: false,
      isTerminal: false,
      showIndicator: false
    });
  }

  return getKnownWorkflowStatusPresentation(status);
}
