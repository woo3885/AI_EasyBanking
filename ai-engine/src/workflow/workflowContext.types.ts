export type WorkflowStatus =
  | "IDLE"
  | "IN_PROGRESS"
  | "WAITING_FOR_USER"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type WorkflowStepStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "SKIPPED";

export interface WorkflowStep {
  stepId: string;
  description: string;
  status: WorkflowStepStatus;

  action?: string;
  targetElementId?: string;
  completedAt?: string;
}

export interface CompletionCondition {
  conditionId: string;
  description: string;
  completed: boolean;
}

export interface WorkflowContext {
  workflowId: string;
  sessionId: string;

  /**
   * 사용자가 처음 요청한 전체 목표입니다.
   */
  originalGoal: string;

  /**
   * 현재 화면에서 달성해야 하는 작은 목표입니다.
   */
  currentGoal: string;

  /**
   * 바로 전에 완료한 단계입니다.
   */
  previousStep: WorkflowStep | null;

  /**
   * 현재 수행 중인 단계입니다.
   */
  currentStep: WorkflowStep | null;

  /**
   * 전체 목표의 완료 여부를 판단하는 조건입니다.
   */
  completionConditions: CompletionCondition[];

  /**
   * 지금까지 진행한 단계 기록입니다.
   */
  stepHistory: WorkflowStep[];

  status: WorkflowStatus;

  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkflowContextInput {
  workflowId: string;
  sessionId: string;
  originalGoal: string;
  currentGoal: string;
  completionConditionDescriptions: string[];
}

export interface StartWorkflowStepInput {
  stepId: string;
  description: string;
  action?: string;
  targetElementId?: string;
}