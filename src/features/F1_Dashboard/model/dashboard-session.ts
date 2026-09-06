import type {
  DashboardSiteId,
  DashboardTaskType
} from './dashboard-options';

export interface DashboardStartSelection {
  siteId: DashboardSiteId;
  taskType: DashboardTaskType;
}

// D5 adapter contract. It keeps the shared frontend and Backend contracts
// unchanged while the real session API contract is being finalized.
export interface DashboardSessionStartRequest
  extends DashboardStartSelection {
  initialPath: '/deposit/products' | '/transfer/accounts';
  initialUrl: string;
  userRequest: string;
}

export interface DashboardSessionStartResult {
  sessionId: string;
  webSocketUrl?: string;
  createdAt: string;
}
