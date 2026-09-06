import type {
  AiActionRequest,
  BackendSanitizedDomSnapshot,
} from "../api/aiRequest.types.js";

import type {
  StructuredAIResponse,
} from "../output/aiResponse.types.js";

/**
 * Agent Loop 동안 유지되는 사용자 목표입니다.
 *
 * 첫 요청에서 추출된 UserGoal은 유지하고,
 * Action 실행 후 DOM Snapshot만 새 것으로 교체합니다.
 */
export type AgentLoopUserGoal =
  AiActionRequest["userGoal"];

/**
 * Agent Loop의 각 실행 단계를 기록합니다.
 */
export interface AgentLoopStep {
  stepNumber: number;

  snapshotId: string;

  response: StructuredAIResponse;
}

/**
 * Agent Loop 전체 실행 결과 상태입니다.
 */
export type AgentLoopResultStatus =
  | "COMPLETED"
  | "WAITING_FOR_USER"
  | "WAITING_FOR_SECURE_INPUT"
  | "WAITING_FOR_FINAL_CONFIRMATION"
  | "STOPPED"
  | "ERROR"
  | "MAX_STEPS_REACHED";

/**
 * Agent Loop 최종 실행 결과입니다.
 */
export interface AgentLoopResult {
  status: AgentLoopResultStatus;

  steps: AgentLoopStep[];

  finalSnapshot:
    BackendSanitizedDomSnapshot;

  finalResponse:
    StructuredAIResponse | null;
}

/**
 * Agent Loop 실행에 필요한 외부 기능입니다.
 *
 * C는 다음 Action을 판단하고,
 * 실제 Browser Action 실행 및 새 DOM 획득은
 * 외부(B Backend) 기능에 맡길 수 있도록 분리합니다.
 */
export interface AgentLoopDependencies {
  /**
   * 현재 UserGoal + DOM을 기반으로
   * 다음 Structured Action을 결정합니다.
   */
  decide: (
    request: AiActionRequest,
  ) => Promise<StructuredAIResponse>;

  /**
   * 판단된 Action을 실행합니다.
   *
   * 실제 B Backend 연동 전에는
   * 테스트에서 Mock 함수로 대체할 수 있습니다.
   */
  execute: (
    response: StructuredAIResponse,
  ) => Promise<void>;

  /**
   * Action 실행 이후의 최신
   * Sanitized DOM Snapshot을 가져옵니다.
   */
  getNextSnapshot: () =>
    Promise<BackendSanitizedDomSnapshot>;

  /**
   * 각 AI 판단 요청의 requestId를 생성합니다.
   */
  createRequestId: (
    stepNumber: number,
  ) => string;
}