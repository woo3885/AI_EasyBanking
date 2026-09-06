// D4 프론트 Dashboard에서만 사용하는 로컬 선택 계약이다.
// Backend 및 AI Engine 타입 변환은 D5 이후 통합 계층에서 처리한다.
export type DashboardSiteId = 'demo-bank';

export type DashboardTaskType =
  | 'OPEN_DEPOSIT'
  | 'TRANSFER_MONEY';

export interface DashboardTaskOption {
  id: DashboardTaskType;
  name: string;
  description: string;
  userRequest: string;
}

export interface DashboardSiteOption {
  id: DashboardSiteId;
  name: string;
  description: string;
  environmentLabel: string;
  supportedTaskTypes: DashboardTaskType[];
}

export const DASHBOARD_SITES: DashboardSiteOption[] = [
  {
    id: 'demo-bank',
    name: '금융길잡이 데모뱅크',
    description: '금융 자동화 기능을 안전하게 확인하는 시연용 사이트',
    environmentLabel: '데모 환경',
    supportedTaskTypes: ['OPEN_DEPOSIT', 'TRANSFER_MONEY']
  }
];

export const DASHBOARD_TASKS: DashboardTaskOption[] = [
  {
    id: 'OPEN_DEPOSIT',
    name: '예금 가입',
    description: '예금 상품을 확인하고 가입 절차를 진행합니다.',
    userRequest: '100만 원으로 정기예금 가입 절차를 시작해 주세요.'
  },
  {
    id: 'TRANSFER_MONEY',
    name: '계좌이체',
    description: '출금 계좌와 수취인, 금액을 확인하며 이체 절차를 진행합니다.',
    userRequest: '계좌이체 절차를 시작해 주세요.'
  }
];
