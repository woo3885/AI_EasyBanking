import {
  DASHBOARD_TASKS,
  type DashboardTaskType
} from './dashboard-options';
import type {
  DashboardSessionStartRequest,
  DashboardStartSelection
} from './dashboard-session';

export const DEFAULT_DEMO_BANK_BASE_URL = 'http://127.0.0.1:5190';

const taskStartPaths: Record<
  DashboardTaskType,
  DashboardSessionStartRequest['initialPath']
> = {
  OPEN_DEPOSIT: '/deposit/products',
  TRANSFER_MONEY: '/transfer/accounts'
};

function normalizeDemoBankBaseUrl(configuredBaseUrl?: string): string {
  const candidate = configuredBaseUrl?.trim() || DEFAULT_DEMO_BANK_BASE_URL;

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(candidate);
  } catch {
    throw new Error(
      'VITE_DEMO_BANK_BASE_URL은 유효한 http 또는 https URL이어야 합니다.'
    );
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error(
      'VITE_DEMO_BANK_BASE_URL은 유효한 http 또는 https URL이어야 합니다.'
    );
  }

  if (
    parsedUrl.username ||
    parsedUrl.password ||
    parsedUrl.search ||
    parsedUrl.hash
  ) {
    throw new Error(
      'VITE_DEMO_BANK_BASE_URL에는 인증정보, 쿼리 또는 해시를 사용할 수 없습니다.'
    );
  }

  const normalizedPath = parsedUrl.pathname.replace(/\/+$/, '');

  return `${parsedUrl.origin}${normalizedPath}`;
}

export function createDashboardSessionRequest(
  selection: DashboardStartSelection
): DashboardSessionStartRequest {
  const baseUrl = normalizeDemoBankBaseUrl(
    import.meta.env.VITE_DEMO_BANK_BASE_URL
  );
  const selectedTask = DASHBOARD_TASKS.find(
    (task) => task.id === selection.taskType
  );

  if (!selectedTask) {
    throw new Error('지원하지 않는 금융 업무입니다.');
  }

  return {
    siteId: selection.siteId,
    taskType: selection.taskType,
    initialPath: taskStartPaths[selection.taskType],
    initialUrl: `${baseUrl}${taskStartPaths[selection.taskType]}`,
    userRequest: selectedTask.userRequest
  };
}
