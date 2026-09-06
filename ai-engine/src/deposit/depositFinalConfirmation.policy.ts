import type {
  AiActionRequest,
  BackendSanitizedDomElement,
} from "../api/aiRequest.types.js";

import type {
  StructuredAIResponse,
} from "../output/aiResponse.types.js";

export const DEPOSIT_CONFIRMATION_TYPE =
  "DEPOSIT_SUBSCRIPTION" as const;

export const DEPOSIT_FINAL_MESSAGES = Object.freeze({
  required:
    "예금 가입 전 최종 확인이 필요합니다.",
  waiting:
    "최종 승인 전에 확인 항목을 직접 선택해 주세요.",
  blocked:
    "최종 확인 대상을 안전하게 확인할 수 없습니다.",
  premature:
    "현재 화면에서는 최종 확인을 진행하지 않습니다.",
  completed:
    "데모 가입 절차가 완료되었습니다.",
});

const SUPPORTED_PRODUCT_IDS = new Set([
  "deposit-12m",
  "deposit-preferred",
]);

type DepositFinalPage =
  | "FINAL_CONFIRMATION"
  | "COMPLETION"
  | "OTHER";

interface FinalTargetDetection {
  page: DepositFinalPage;
  target: BackendSanitizedDomElement | null;
  safe: boolean;
  waitingForUserCheckbox: boolean;
}

function normalize(
  value: string | null | undefined,
): string {
  return value
    ?.replace(/\s+/gu, " ")
    .trim()
    .toLowerCase() ?? "";
}

function canonicalPath(
  value: string,
): string | null {
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      !url.hostname ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return null;
    }

    return url.pathname.replace(/\/+$/u, "");
  } catch {
    return null;
  }
}

function classifyFinalPage(
  request: AiActionRequest,
): DepositFinalPage {
  const path = canonicalPath(
    request.domSnapshot.page.url,
  );

  if (!path) {
    return "OTHER";
  }

  for (const productId of SUPPORTED_PRODUCT_IDS) {
    if (path === `/deposit/confirmation/${productId}`) {
      return "FINAL_CONFIRMATION";
    }
    if (path === `/deposit/completed/${productId}`) {
      return "COMPLETION";
    }
  }

  return "OTHER";
}

function isApproveSemantic(
  element: BackendSanitizedDomElement,
): boolean {
  const tag = normalize(element.tag);
  const role = normalize(element.role);
  const labels = [
    normalize(element.text),
    normalize(element.ariaLabel),
  ];

  return (
    (tag === "button" || role === "button") &&
    labels.some((label) =>
      label === "demo 예금 최종 승인" ||
      label === "예금 최종 승인"
    )
  );
}

function hasVisiblePriorityBoundary(
  request: AiActionRequest,
): boolean {
  return request.domSnapshot.elements.some(
    (element) =>
      element.visible &&
      (
        element.securityPolicy === "SECURE_INPUT" ||
        element.securityPolicy === "BLOCKED"
      ),
  );
}

function detectFinalTarget(
  request: AiActionRequest,
): FinalTargetDetection {
  const page = classifyFinalPage(request);

  if (page !== "FINAL_CONFIRMATION") {
    return {
      page,
      target: null,
      safe: false,
      waitingForUserCheckbox: false,
    };
  }

  const policyTargets =
    request.domSnapshot.elements.filter(
      (element) =>
        element.securityPolicy ===
        "FINAL_CONFIRMATION",
    );

  if (policyTargets.length !== 1) {
    return {
      page,
      target: null,
      safe: false,
      waitingForUserCheckbox: false,
    };
  }

  const target = policyTargets[0] ?? null;
  if (!target || !isApproveSemantic(target)) {
    return {
      page,
      target: null,
      safe: false,
      waitingForUserCheckbox: false,
    };
  }

  if (!target.visible || !target.enabled) {
    return {
      page,
      target: null,
      safe: false,
      waitingForUserCheckbox:
        target.visible && !target.enabled,
    };
  }

  return {
    page,
    target,
    safe: true,
    waitingForUserCheckbox: false,
  };
}

function createNoneResponse(
  requestId: string,
  message: string,
  requiresUserAction: boolean,
): StructuredAIResponse {
  return {
    requestId,
    status: "AI_EXECUTING",
    action: "NONE",
    targetElementId: null,
    inputValue: null,
    message,
    confidence: 1,
    requiresUserAction,
    decisionType: null,
    secureInputType: null,
    riskType: null,
    options: null,
    confirmationId: null,
    summary: null,
    confirmationType: null,
    confirmationTargetElementId: null,
  };
}

function createFinalResponse(
  requestId: string,
  targetElementId: string,
): StructuredAIResponse {
  return {
    requestId,
    status: "FINAL_CONFIRMATION_REQUIRED",
    action: "REQUEST_FINAL_CONFIRMATION",
    targetElementId: null,
    inputValue: null,
    message: DEPOSIT_FINAL_MESSAGES.required,
    confidence: 1,
    requiresUserAction: true,
    decisionType: null,
    secureInputType: null,
    riskType: null,
    options: null,
    confirmationId: null,
    summary: null,
    confirmationType: DEPOSIT_CONFIRMATION_TYPE,
    confirmationTargetElementId: targetElementId,
  };
}

function hasProtectedModelSignal(
  response: StructuredAIResponse,
): boolean {
  return (
    response.status === "SECURE_INPUT_REQUIRED" ||
    response.action === "PAUSE_FOR_SECURE_INPUT" ||
    response.secureInputType !== null ||
    response.status === "RISK_WARNING" ||
    response.riskType !== null
  );
}

function hasFinalModelSignal(
  response: StructuredAIResponse,
): boolean {
  return (
    response.status === "FINAL_CONFIRMATION_REQUIRED" ||
    response.action === "REQUEST_FINAL_CONFIRMATION" ||
    response.confirmationId !== null ||
    response.summary !== null ||
    response.confirmationType != null ||
    response.confirmationTargetElementId != null
  );
}

function modelFinalMetadataConflicts(
  response: StructuredAIResponse,
  targetElementId: string,
): boolean {
  return (
    response.confirmationId !== null ||
    response.summary !== null ||
    (
      response.confirmationType != null &&
      response.confirmationType !==
        DEPOSIT_CONFIRMATION_TYPE
    ) ||
    (
      response.confirmationTargetElementId != null &&
      response.confirmationTargetElementId !==
        targetElementId
    )
  );
}

/**
 * Handles D27 final/completion pages before prompt construction. C derives
 * only the current sanitized target; Backend owns summary, confirmation ID,
 * frame binding, approval/rejection and the exactly-once click.
 */
export function createDepositFinalBoundaryResponse(
  request: AiActionRequest,
): StructuredAIResponse | null {
  const detection = detectFinalTarget(request);

  if (detection.page === "COMPLETION") {
    return createNoneResponse(
      request.requestId,
      DEPOSIT_FINAL_MESSAGES.completed,
      false,
    );
  }

  if (detection.page !== "FINAL_CONFIRMATION") {
    return null;
  }

  if (hasVisiblePriorityBoundary(request)) {
    return null;
  }

  if (detection.safe && detection.target) {
    return createFinalResponse(
      request.requestId,
      detection.target.elementId,
    );
  }

  return createNoneResponse(
    request.requestId,
    detection.waitingForUserCheckbox
      ? DEPOSIT_FINAL_MESSAGES.waiting
      : DEPOSIT_FINAL_MESSAGES.blocked,
    true,
  );
}

/**
 * Runtime defense after model parsing. Model-authored final metadata never
 * establishes authority: it is either replaced from the current snapshot or
 * blocked when the current page/target does not satisfy the D27 contract.
 */
export function enforceDepositFinalConfirmationPolicy(
  response: StructuredAIResponse,
  request: AiActionRequest,
): StructuredAIResponse {
  if (hasProtectedModelSignal(response)) {
    return response;
  }

  const detection = detectFinalTarget(request);

  if (detection.page === "COMPLETION") {
    return createNoneResponse(
      response.requestId,
      DEPOSIT_FINAL_MESSAGES.completed,
      false,
    );
  }

  if (detection.page === "FINAL_CONFIRMATION") {
    if (
      hasVisiblePriorityBoundary(request) ||
      !detection.safe ||
      !detection.target ||
      modelFinalMetadataConflicts(
        response,
        detection.target.elementId,
      )
    ) {
      return createNoneResponse(
        response.requestId,
        detection.waitingForUserCheckbox
          ? DEPOSIT_FINAL_MESSAGES.waiting
          : DEPOSIT_FINAL_MESSAGES.blocked,
        true,
      );
    }

    return createFinalResponse(
      response.requestId,
      detection.target.elementId,
    );
  }

  if (hasFinalModelSignal(response)) {
    return createNoneResponse(
      response.requestId,
      DEPOSIT_FINAL_MESSAGES.premature,
      true,
    );
  }

  return response;
}
