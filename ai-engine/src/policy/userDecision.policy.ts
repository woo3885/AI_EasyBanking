import type {
  AiActionRequest,
  BackendSanitizedDomElement,
} from "../api/aiRequest.types.js";

import type {
  StructuredAIResponse,
} from "../output/aiResponse.types.js";

import {
  sanitizeDecisionLabel,
  sanitizeInternalMessage,
} from "../messages/messageSafety.js";

import type {
  StructuredDecisionItem,
} from "../workflow/userDecision.types.js";

import {
  isProductionDecisionResponseType,
} from "../workflow/userDecision.types.js";

const USER_DECISION_MESSAGE =
  "사용자가 직접 선택해야 하는 항목입니다.";

const MAX_DECISION_OPTION_COUNT = 20;

function targetsProtectedUserDecision(
  response: StructuredAIResponse,
  request: AiActionRequest,
): boolean {
  if (!response.targetElementId) {
    return false;
  }

  const target = request.domSnapshot.elements.find(
    (element) =>
      element.elementId === response.targetElementId,
  );

  return target?.securityPolicy === "USER_DECISION";
}

function targetsResolvedUserDecision(
  response: StructuredAIResponse,
  request: AiActionRequest,
): boolean {
  return Boolean(
    response.targetElementId &&
    request.userDecisionContext
      ?.selectedOptionIds.includes(
        response.targetElementId,
      ),
  );
}

function assertProtectedStateConsistency(
  response: StructuredAIResponse,
): void {
  const secureSignal =
    response.status === "SECURE_INPUT_REQUIRED" ||
    response.action === "PAUSE_FOR_SECURE_INPUT" ||
    response.secureInputType !== null;
  const securePair =
    response.status === "SECURE_INPUT_REQUIRED" &&
    response.action === "PAUSE_FOR_SECURE_INPUT";

  const finalSignal =
    response.status === "FINAL_CONFIRMATION_REQUIRED" ||
    response.action === "REQUEST_FINAL_CONFIRMATION" ||
    response.confirmationId !== null;
  const finalPair =
    response.status === "FINAL_CONFIRMATION_REQUIRED" &&
    response.action === "REQUEST_FINAL_CONFIRMATION";

  if (
    (secureSignal && !securePair) ||
    (finalSignal && !finalPair) ||
    response.status === "RISK_WARNING" ||
    response.riskType !== null
  ) {
    throw new Error(
      "[AI Engine] protected workflow state cannot be bypassed.",
    );
  }
}

function decisionLabelSource(
  element: BackendSanitizedDomElement,
): string {
  const candidate = [
    element.ariaLabel,
    element.text,
    element.placeholder,
    element.role,
    element.tag,
  ].find((value) =>
    typeof value === "string" &&
    value.trim().length > 0,
  );

  return candidate ?? "";
}

function isRequiredTerm(
  element: BackendSanitizedDomElement,
): boolean {
  const source = [
    element.ariaLabel,
    element.text,
    element.placeholder,
  ]
    .filter((value): value is string =>
      typeof value === "string",
    )
    .join(" ")
    .toLowerCase();

  return (
    source.includes("필수") ||
    source.includes("required")
  );
}

function canonicalizeDecisionItems(
  response: StructuredAIResponse,
  request: AiActionRequest,
): readonly StructuredDecisionItem[] | null {
  const { decisionType, options } = response;

  if (decisionType === null && options === null) {
    return null;
  }

  if (
    decisionType === null ||
    !isProductionDecisionResponseType(decisionType) ||
    options === null ||
    options.length === 0 ||
    options.length > MAX_DECISION_OPTION_COUNT
  ) {
    throw new Error(
      "[AI Engine] decision metadata must contain 1 to 20 options.",
    );
  }

  const elementsById = new Map<
    string,
    BackendSanitizedDomElement
  >();

  for (const element of request.domSnapshot.elements) {
    if (elementsById.has(element.elementId)) {
      throw new Error(
        `[AI Engine] duplicate element ID in current snapshot: ${element.elementId}`,
      );
    }

    elementsById.set(
      element.elementId,
      element,
    );
  }
  const resolvedIds = new Set(
    request.userDecisionContext
      ?.selectedOptionIds ?? [],
  );
  const seenIds = new Set<string>();

  return Object.freeze(
    options.map((option) => {
      if (
        option.id.length === 0 ||
        option.id.trim() !== option.id
      ) {
        throw new Error(
          "[AI Engine] decision option ID must be a non-blank exact ID.",
        );
      }

      if (seenIds.has(option.id)) {
        throw new Error(
          `[AI Engine] duplicate decision option ID: ${option.id}`,
        );
      }
      seenIds.add(option.id);

      if (resolvedIds.has(option.id)) {
        throw new Error(
          "[AI Engine] a resolved user selection cannot be requested again.",
        );
      }

      const element = elementsById.get(
        option.id,
      );

      if (!element) {
        throw new Error(
          `[AI Engine] decision option is not in the current snapshot: ${option.id}`,
        );
      }

      if (
        !element.visible ||
        !element.enabled ||
        element.securityPolicy !== "USER_DECISION"
      ) {
        throw new Error(
          `[AI Engine] decision option is not safely selectable: ${option.id}`,
        );
      }

      const canonical = {
        id: option.id,
        label: sanitizeDecisionLabel(
          decisionLabelSource(element),
        ),
      };

      if (decisionType === "TERMS_AGREEMENT") {
        if (typeof element.checked !== "boolean") {
          throw new Error(
            `[AI Engine] decision term checked state is unavailable: ${option.id}`,
          );
        }

        return Object.freeze({
          ...canonical,
          required: isRequiredTerm(element),
          checked: element.checked,
        });
      }

      return Object.freeze({
        ...canonical,
        checked: element.checked,
      });
    }),
  );
}

function createSafeWaitResponse(
  response: StructuredAIResponse,
  request: AiActionRequest,
): StructuredAIResponse {
  const options = canonicalizeDecisionItems(
    response,
    request,
  );

  if (options === null) {
    throw new Error(
      "[AI Engine] WAIT_FOR_USER requires validated decision metadata.",
    );
  }

  return {
    ...response,
    status: "USER_DECISION_REQUIRED",
    action: "WAIT_FOR_USER",
    targetElementId: null,
    inputValue: null,
    message: USER_DECISION_MESSAGE,
    requiresUserAction: true,
    decisionType: response.decisionType,
    secureInputType: null,
    riskType: null,
    options,
    confirmationId: null,
    summary: null,
  };
}

/**
 * Applies C's D24 safety boundary after model parsing.
 *
 * Model-provided decision metadata is a candidate only. C binds every option
 * to the current sanitized snapshot and Backend performs the authoritative
 * validation before publishing a decision. Previously verified selections
 * enter Production only through the request-scoped decision context.
 * UserDecisionContextStore remains an internal Agent Loop utility.
 */
export function enforceUserDecisionPolicy(
  response: StructuredAIResponse,
  request: AiActionRequest,
): StructuredAIResponse {
  assertProtectedStateConsistency(response);

  if (targetsResolvedUserDecision(response, request)) {
    throw new Error(
      "[AI Engine] a resolved user selection cannot be executed again.",
    );
  }

  if (
    response.action === "WAIT_FOR_USER" ||
    response.status === "USER_DECISION_REQUIRED" ||
    targetsProtectedUserDecision(response, request)
  ) {
    return createSafeWaitResponse(
      response,
      request,
    );
  }

  return {
    ...response,
    message: sanitizeInternalMessage(response.message),
  };
}
