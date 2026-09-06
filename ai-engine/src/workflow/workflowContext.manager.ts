import type {
  CompletionCondition,
  CreateWorkflowContextInput,
  StartWorkflowStepInput,
  WorkflowContext,
  WorkflowStep,
  WorkflowStatus,
} from "./workflowContext.types.js";

function getCurrentTime(): string {
  return new Date().toISOString();
}

/**
 * 새로운 WorkflowContext를 생성합니다.
 */
export function createWorkflowContext(
  input: CreateWorkflowContextInput,
): WorkflowContext {
  const now = getCurrentTime();

  const completionConditions: CompletionCondition[] =
    input.completionConditionDescriptions.map(
      (description, index) => ({
        conditionId: `condition-${index + 1}`,
        description,
        completed: false,
      }),
    );

  return {
    workflowId: input.workflowId,
    sessionId: input.sessionId,

    originalGoal: input.originalGoal,
    currentGoal: input.currentGoal,

    previousStep: null,
    currentStep: null,

    completionConditions,
    stepHistory: [],

    status: "IDLE",

    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 새로운 작업 단계를 시작합니다.
 */
export function startWorkflowStep(
  context: WorkflowContext,
  input: StartWorkflowStepInput,
): WorkflowContext {
  const now = getCurrentTime();

  const currentStep: WorkflowStep = {
    stepId: input.stepId,
    description: input.description,
    status: "IN_PROGRESS",

    ...(input.action
      ? { action: input.action }
      : {}),

    ...(input.targetElementId
      ? {
          targetElementId:
            input.targetElementId,
        }
      : {}),
  };

  return {
    ...context,
    currentStep,
    status: "IN_PROGRESS",
    updatedAt: now,
  };
}

/**
 * 현재 진행 중인 단계를 완료합니다.
 */
export function completeCurrentStep(
  context: WorkflowContext,
  nextGoal: string,
): WorkflowContext {
  if (!context.currentStep) {
    return context;
  }

  const now = getCurrentTime();

  const completedStep: WorkflowStep = {
    ...context.currentStep,
    status: "COMPLETED",
    completedAt: now,
  };

  return {
    ...context,

    previousStep: completedStep,
    currentStep: null,
    currentGoal: nextGoal,

    stepHistory: [
      ...context.stepHistory,
      completedStep,
    ],

    updatedAt: now,
  };
}

/**
 * 완료 조건 한 개를 완료 상태로 변경합니다.
 */
export function completeWorkflowCondition(
  context: WorkflowContext,
  conditionId: string,
): WorkflowContext {
  const now = getCurrentTime();

  const completionConditions =
    context.completionConditions.map(
      (condition) =>
        condition.conditionId === conditionId
          ? {
              ...condition,
              completed: true,
            }
          : condition,
    );

  const allCompleted =
    completionConditions.length > 0 &&
    completionConditions.every(
      (condition) => condition.completed,
    );

  return {
    ...context,
    completionConditions,
    status: allCompleted
      ? "COMPLETED"
      : context.status,
    updatedAt: now,
  };
}

/**
 * 사용자 입력을 기다리는 상태로 변경합니다.
 */
export function waitForUser(
  context: WorkflowContext,
  currentGoal: string,
): WorkflowContext {
  return {
    ...context,
    currentGoal,
    status: "WAITING_FOR_USER",
    updatedAt: getCurrentTime(),
  };
}

/**
 * 워크플로 상태를 직접 변경합니다.
 */
export function updateWorkflowStatus(
  context: WorkflowContext,
  status: WorkflowStatus,
): WorkflowContext {
  return {
    ...context,
    status,
    updatedAt: getCurrentTime(),
  };
}

/**
 * 프롬프트에 넣기 쉬운 짧은 Context 문자열을 만듭니다.
 */
export function serializeWorkflowContext(
  context: WorkflowContext,
): string {
  const previousStep =
    context.previousStep?.description ??
    "아직 완료한 단계가 없습니다.";

  const currentStep =
    context.currentStep?.description ??
    "현재 실행 중인 단계가 없습니다.";

  const conditions =
    context.completionConditions
      .map(
        (condition) =>
          `- [${condition.completed ? "완료" : "대기"}] ${
            condition.description
          }`,
      )
      .join("\n");

  return [
    `워크플로 ID: ${context.workflowId}`,
    `상태: ${context.status}`,
    `전체 목표: ${context.originalGoal}`,
    `현재 목표: ${context.currentGoal}`,
    `이전 단계: ${previousStep}`,
    `현재 단계: ${currentStep}`,
    "완료 조건:",
    conditions || "- 등록된 완료 조건이 없습니다.",
  ].join("\n");
}