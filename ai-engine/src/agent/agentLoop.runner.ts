import type {
  AiActionRequest,
  BackendSanitizedDomSnapshot,
} from "../api/aiRequest.types.js";

import type {
  StructuredAIResponse,
} from "../output/aiResponse.types.js";

import type {
  UserDecisionContext,
} from "../workflow/userDecisionContext.store.js";

import {
  UserDecisionContextStore,
} from "../workflow/userDecisionContext.store.js";

import type {
  AgentLoopDependencies,
  AgentLoopResult,
  AgentLoopStep,
  AgentLoopUserGoal,
} from "./agentLoop.types.js";

const DEFAULT_MAX_STEPS = 10;

function isUserDecisionRequired(
  response: StructuredAIResponse,
): boolean {
  return (
    response.status ===
      "USER_DECISION_REQUIRED" &&
    response.action ===
      "WAIT_FOR_USER"
  );
}

function isSecureInputRequired(
  response: StructuredAIResponse,
): boolean {
  return (
    response.status ===
      "SECURE_INPUT_REQUIRED" &&
    response.action ===
      "PAUSE_FOR_SECURE_INPUT" &&
    response.targetElementId === null &&
    response.inputValue === null &&
    response.requiresUserAction &&
    response.decisionType === null &&
    response.options === null &&
    response.confirmationId === null &&
    response.summary === null &&
    response.riskType === null
  );
}

function hasVisibleSecureInput(
  snapshot: BackendSanitizedDomSnapshot,
): boolean {
  return snapshot.elements.some(
    (element) =>
      element.visible &&
      element.securityPolicy === "SECURE_INPUT",
  );
}

function isFinalConfirmationRequired(
  response: StructuredAIResponse,
): boolean {
  return (
    response.status ===
      "FINAL_CONFIRMATION_REQUIRED" &&
    response.action ===
      "REQUEST_FINAL_CONFIRMATION" &&
    response.targetElementId === null &&
    response.inputValue === null &&
    response.requiresUserAction &&
    response.decisionType === null &&
    response.options === null &&
    response.secureInputType === null &&
    response.riskType === null &&
    response.confirmationId === null &&
    response.summary === null &&
    response.confirmationType ===
      "DEPOSIT_SUBSCRIPTION" &&
    typeof response.confirmationTargetElementId ===
      "string" &&
    response.confirmationTargetElementId.length > 0
  );
}

function isCompleted(
  response: StructuredAIResponse,
): boolean {
  /*
   * COMPLETED remains an internal result only. The current Backend wire
   * contract has no normal-completion Action, so STOP must not be used as a
   * substitute: Backend maps STOP to TERMINATED.
   */
  return response.status ===
    "COMPLETED" &&
    response.action !==
      "STOP";
}

function hasProtectedStateConflict(
  response: StructuredAIResponse,
): boolean {
  const userSignal =
    response.status === "USER_DECISION_REQUIRED" ||
    response.action === "WAIT_FOR_USER";
  const secureSignal =
    response.status === "SECURE_INPUT_REQUIRED" ||
    response.action === "PAUSE_FOR_SECURE_INPUT";
  const finalSignal =
    response.status === "FINAL_CONFIRMATION_REQUIRED" ||
    response.action === "REQUEST_FINAL_CONFIRMATION";

  return (
    (userSignal && !isUserDecisionRequired(response)) ||
    (secureSignal && !isSecureInputRequired(response)) ||
    (finalSignal && !isFinalConfirmationRequired(response)) ||
    response.status === "RISK_WARNING"
  );
}

function isStopped(
  response: StructuredAIResponse,
): boolean {
  return (
    response.action ===
      "STOP" ||
    response.status ===
      "TERMINATED"
  );
}

function isError(
  response: StructuredAIResponse,
): boolean {
  return (
    response.status ===
    "ERROR"
  );
}

function createRequest(
  requestId: string,
  userGoal: AgentLoopUserGoal,
  domSnapshot: BackendSanitizedDomSnapshot,
  userDecisionContext?: UserDecisionContext,
): AiActionRequest {
  return {
    requestId,
    userGoal,
    domSnapshot,
    ...(userDecisionContext
      ? { userDecisionContext }
      : {}),
  };
}

async function runAgentLoopInternal(
  userGoal: AgentLoopUserGoal,
  initialSnapshot: BackendSanitizedDomSnapshot,
  dependencies: AgentLoopDependencies,
  maxSteps = DEFAULT_MAX_STEPS,
  userDecisionContext?: UserDecisionContext,
): Promise<AgentLoopResult> {
  let currentSnapshot =
    initialSnapshot;

  const steps:
    AgentLoopStep[] = [];

  for (
    let stepNumber = 1;
    stepNumber <= maxSteps;
    stepNumber++
  ) {
    const requestId =
      dependencies.createRequestId(
        stepNumber,
      );

    const request =
      createRequest(
        requestId,
        userGoal,
        currentSnapshot,
        userDecisionContext,
      );

    const response =
      await dependencies.decide(
        request,
      );

    steps.push({
      stepNumber,
      snapshotId:
        currentSnapshot.snapshotId,
      response,
    });

    if (hasProtectedStateConflict(response)) {
      return {
        status: "ERROR",
        steps,
        finalSnapshot: currentSnapshot,
        finalResponse: response,
      };
    }

    /*
     * 사용자 선택이 필요한 경우에는
     * Browser Action을 실행하지 않고
     * Agent Loop를 일시정지합니다.
     */
    if (
      isUserDecisionRequired(
        response,
      )
    ) {
      return {
        status:
          "WAITING_FOR_USER",

        steps,

        finalSnapshot:
          currentSnapshot,

        finalResponse:
          response,
      };
    }

    /*
     * 비밀번호, OTP 등 보안 입력이 필요한 경우
     * AI 자동 실행을 중단합니다.
     */
    if (
      isSecureInputRequired(
        response,
      )
    ) {
      return {
        status:
          "WAITING_FOR_SECURE_INPUT",

        steps,

        finalSnapshot:
          currentSnapshot,

        finalResponse:
          response,
      };
    }

    /*
     * 최종 가입/송금 등 사용자의 최종 승인이
     * 필요한 경우 실행하지 않고 대기합니다.
     */
    if (
      isFinalConfirmationRequired(
        response,
      )
    ) {
      return {
        status:
          "WAITING_FOR_FINAL_CONFIRMATION",

        steps,

        finalSnapshot:
          currentSnapshot,

        finalResponse:
          response,
      };
    }

    if (
      isStopped(
        response,
      )
    ) {
      return {
        status:
          "STOPPED",

        steps,

        finalSnapshot:
          currentSnapshot,

        finalResponse:
          response,
      };
    }

    if (
      isCompleted(
        response,
      )
    ) {
      return {
        status:
          "COMPLETED",

        steps,

        finalSnapshot:
          currentSnapshot,

        finalResponse:
          response,
      };
    }

    if (
      isError(
        response,
      )
    ) {
      return {
        status:
          "ERROR",

        steps,

        finalSnapshot:
          currentSnapshot,

        finalResponse:
          response,
      };
    }

    /*
     * NONE은 실제 실행할 Browser Action이 없으므로
     * 무한 반복을 막기 위해 종료합니다.
     */
    if (
      response.action ===
      "NONE"
    ) {
      return {
        status:
          "STOPPED",

        steps,

        finalSnapshot:
          currentSnapshot,

        finalResponse:
          response,
      };
    }

    /*
     * 실제 Browser Action은 Backend가 실행합니다.
     */
    await dependencies.execute(
      response,
    );

    /*
     * Action 실행 이후에는 반드시
     * 새로운 Sanitized DOM Snapshot으로 교체합니다.
     */
    const nextSnapshot =
      await dependencies
        .getNextSnapshot();

    if (
      nextSnapshot.snapshotId ===
      currentSnapshot.snapshotId
    ) {
      return {
        status: "ERROR",
        steps,
        finalSnapshot: nextSnapshot,
        finalResponse: response,
      };
    }

    currentSnapshot = nextSnapshot;
  }

  return {
    status:
      "MAX_STEPS_REACHED",

    steps,

    finalSnapshot:
      currentSnapshot,

    finalResponse:
      steps.at(-1)?.response ??
      null,
  };
}

export async function runAgentLoop(
  userGoal: AgentLoopUserGoal,
  initialSnapshot: BackendSanitizedDomSnapshot,
  dependencies: AgentLoopDependencies,
  maxSteps = DEFAULT_MAX_STEPS,
): Promise<AgentLoopResult> {
  return runAgentLoopInternal(
    userGoal,
    initialSnapshot,
    dependencies,
    maxSteps,
  );
}

export async function resumeAgentLoopAfterUserDecision(
  userGoal: AgentLoopUserGoal,
  pausedResult: AgentLoopResult,
  verifiedContext: UserDecisionContext,
  resumedSnapshot: BackendSanitizedDomSnapshot,
  contextStore: UserDecisionContextStore,
  dependencies: AgentLoopDependencies,
  maxSteps = DEFAULT_MAX_STEPS,
): Promise<AgentLoopResult> {
  const response = pausedResult.finalResponse;

  if (
    pausedResult.status !== "WAITING_FOR_USER" ||
    !response ||
    !isUserDecisionRequired(response) ||
    !response.requiresUserAction ||
    response.secureInputType !== null ||
    response.riskType !== null ||
    response.confirmationId !== null
  ) {
    throw new Error(
      "[AI Engine] only a clean USER_DECISION pause can be resumed with a decision context.",
    );
  }

  const context = contextStore.consumeVerified(
    verifiedContext,
    pausedResult.finalSnapshot.snapshotId,
    resumedSnapshot.snapshotId,
  );

  return runAgentLoopInternal(
    userGoal,
    resumedSnapshot,
    dependencies,
    maxSteps,
    context,
  );
}

export async function resumeAgentLoopAfterSecureInput(
  userGoal: AgentLoopUserGoal,
  pausedResult: AgentLoopResult,
  resumedSnapshot: BackendSanitizedDomSnapshot,
  dependencies: AgentLoopDependencies,
  maxSteps = DEFAULT_MAX_STEPS,
): Promise<AgentLoopResult> {
  const response = pausedResult.finalResponse;

  if (
    pausedResult.status !== "WAITING_FOR_SECURE_INPUT" ||
    !response ||
    !isSecureInputRequired(response) ||
    !response.requiresUserAction ||
    response.riskType !== null ||
    response.confirmationId !== null ||
    response.decisionType !== null ||
    resumedSnapshot.snapshotId ===
      pausedResult.finalSnapshot.snapshotId ||
    hasVisibleSecureInput(resumedSnapshot)
  ) {
    throw new Error(
      "[AI Engine] only a clean SECURE_INPUT pause can resume through the secure-input path.",
    );
  }

  return runAgentLoopInternal(
    userGoal,
    resumedSnapshot,
    dependencies,
    maxSteps,
  );
}
