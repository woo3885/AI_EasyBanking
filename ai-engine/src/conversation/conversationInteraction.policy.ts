import type {
  AiActionRequest,
  BackendSanitizedDomElement,
} from "../api/aiRequest.types.js";
import {
  createDepositFinalBoundaryResponse,
  DEPOSIT_FINAL_MESSAGES,
} from "../deposit/depositFinalConfirmation.policy.js";
import {
  classifyDepositScenarioStage,
  DEPOSIT_GUIDANCE,
  enforceDepositScenarioPolicy,
} from "../deposit/depositScenario.policy.js";
import { detectFinalAction } from "../finalAction/finalAction.detector.js";
import {
  SAFE_DECISION_LABEL,
  SAFE_INTERNAL_MESSAGE,
  sanitizeDecisionLabel,
  sanitizeInternalMessage,
} from "../messages/messageSafety.js";
import type { StructuredAIResponse } from "../output/aiResponse.types.js";
import { evaluateActionPolicy } from "../policy/actionPolicy.js";
import { detectRisk } from "../risk/riskDetector.js";
import { createRiskWarningResult } from "../risk/riskWarning.mapper.js";
import { createSecureInputPauseForRequest } from "../secureInput/secureInput.policy.js";
import type {
  AgentDecision,
  ConversationActionCandidate,
  ConversationActionType,
  ConversationAgentRequest,
} from "./conversationAgent.types.js";
import { validateAgentDecision } from "./conversationAgent.validator.js";

const SNAPSHOT_MODES = new Set<AgentDecision["mode"]>([
  "AUTO_EXECUTE",
  "GUIDE_USER",
  "SECURE_INPUT_REQUIRED",
  "RISK_WARNING",
  "FINAL_CONFIRMATION_REQUIRED",
  "COMPLETE",
]);

const TERMINAL_REASON_CODES = new Set([
  "USER_CANCELLED",
  "SECURE_VALUE_REJECTED",
  "GOAL_VALUE_CONFLICT",
  "UNSUPPORTED_DAY1_INPUT",
  "UNSUPPORTED_DOM",
  "UNSUPPORTED_INTERACTION",
  "STALE_SNAPSHOT",
  "BLOCKED_TARGET",
]);

const NORMALIZED_WHITESPACE = /\s+/gu;
const TERM_WORDS = ["약관", "동의", "필수", "선택"] as const;
const PRODUCT_WORDS = ["예금", "상품", "정기예금"] as const;
const TARGET_INSTRUCTION = /(?:이전|시스템).{0,12}지시.{0,12}무시|(?:자동|즉시).{0,12}(?:클릭|눌러|선택|입력)/iu;
const TARGET_TECHNICAL_TEXT = /(?:#[A-Za-z_][\w-]*|\/\/[A-Za-z*]|\bel-[a-z0-9_-]+\b|innerHTML|outerHTML|selector|xpath|\[[^\]]+\]\([^)]+\))/iu;
const GUIDE_ROLES = new Set(["button", "link", "radio", "checkbox", "option"]);
const CLICK_ROLES = new Set(["button", "link"]);

export interface InteractionValidationResult {
  valid: boolean;
  errors: string[];
}

function textOf(element: BackendSanitizedDomElement): string {
  return [element.ariaLabel, element.text, element.placeholder]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .replace(NORMALIZED_WHITESPACE, " ")
    .trim();
}

function baseDecision(input: ConversationAgentRequest): AgentDecision {
  return {
    requestId: input.requestId,
    requestMessageId: input.requestMessageId,
    goalId: input.goal.goalId,
    baseGoalRevision: input.goal.revision,
    mode: "STOP",
    message: "현재 화면에서 안전한 다음 단계를 확인할 수 없습니다.",
    confidence: 1,
    reasonCode: "UNSUPPORTED_DOM",
    nextCondition: null,
    sourceSnapshotId: null,
    goalPatch: null,
    question: null,
    actionCandidate: null,
  };
}

function withSnapshotMode(
  input: ConversationAgentRequest,
  mode: AgentDecision["mode"],
  message: string,
  reasonCode: string,
  action: {
    actionType: ConversationActionType;
    target: BackendSanitizedDomElement;
  } | null = null,
): AgentDecision {
  const base = baseDecision(input);
  const safeMessage = sanitizeInternalMessage(message);
  const actionCandidate = action === null
    ? null
    : createActionCandidate(input, action.actionType, action.target, safeMessage);
  if (action !== null && actionCandidate === null) {
    return { ...base, reasonCode: "BLOCKED_TARGET" };
  }
  return {
    ...base,
    mode,
    message: safeMessage,
    reasonCode,
    sourceSnapshotId: input.snapshot?.sourceSnapshotId ?? null,
    actionCandidate,
  };
}

function safeTargetLabel(element: BackendSanitizedDomElement): string | null {
  for (const value of [element.ariaLabel, element.text, element.placeholder]) {
    if (
      !value?.trim() ||
      TARGET_INSTRUCTION.test(value) ||
      TARGET_TECHNICAL_TEXT.test(value)
    ) continue;
    const sanitized = sanitizeInternalMessage(value);
    if (
      sanitized === SAFE_INTERNAL_MESSAGE ||
      sanitized.includes("[보호됨]")
    ) continue;
    const label = sanitizeDecisionLabel(value);
    if (label !== SAFE_DECISION_LABEL) return label;
  }
  return null;
}

function uniqueSnapshotElement(
  input: ConversationAgentRequest,
  elementId: string | null | undefined,
): BackendSanitizedDomElement | null {
  if (!elementId || !input.snapshot) return null;
  const matches = input.snapshot.sanitizedDomSnapshot.elements.filter(
    (element) => element.elementId === elementId,
  );
  return matches.length === 1 ? matches[0] ?? null : null;
}

function createActionCandidate(
  input: ConversationAgentRequest,
  actionType: ConversationActionType,
  target: BackendSanitizedDomElement,
  guide: string,
): ConversationActionCandidate | null {
  const current = uniqueSnapshotElement(input, target.elementId);
  if (
    !current ||
    !current.visible ||
    !current.enabled ||
    !current.role?.trim() ||
    TARGET_TECHNICAL_TEXT.test(guide)
  ) return null;
  const role = current.role.toLowerCase();
  const roleAllowed = actionType === "WAIT_FOR_USER"
    ? GUIDE_ROLES.has(role)
    : actionType === "CLICK"
      ? CLICK_ROLES.has(role)
      : role === "textbox";
  if (!roleAllowed) return null;
  const label = safeTargetLabel(current);
  if (!label || sanitizeInternalMessage(guide) !== guide) return null;
  return {
    actionType,
    targetElementId: current.elementId,
    role,
    accessibleLabel: label,
    guide,
  };
}

function toAiActionRequest(input: ConversationAgentRequest): AiActionRequest | null {
  if (!input.snapshot) return null;
  const amountValue = input.goal.amount?.value;
  const amount = amountValue && /^\d+$/u.test(amountValue)
    ? Number(amountValue)
    : undefined;
  return {
    requestId: input.requestId,
    userGoal: {
      rawMessage: input.goal.normalizedRequest,
      intent: input.goal.intent,
      ...(amount !== undefined && Number.isSafeInteger(amount) && amount > 0
        ? { amount }
        : {}),
      ...(input.goal.duration
        ? { duration: input.goal.duration }
        : {}),
      conditions: [],
    },
    domSnapshot: input.snapshot.sanitizedDomSnapshot,
  };
}

function neutralResponse(requestId: string): StructuredAIResponse {
  return {
    requestId,
    status: "AI_EXECUTING",
    action: "NONE",
    targetElementId: null,
    inputValue: null,
    message: SAFE_INTERNAL_MESSAGE,
    confidence: 1,
    requiresUserAction: false,
    decisionType: null,
    secureInputType: null,
    riskType: null,
    options: null,
    confirmationId: null,
    summary: null,
  };
}

function riskMessage(input: ConversationAgentRequest): string | null {
  const snapshotText = input.snapshot?.sanitizedDomSnapshot.elements
    .filter((element) => element.visible)
    .map(textOf)
    .join(" ") ?? "";
  for (const [text, sourceType] of [
    [input.userMessage.content, "USER_MESSAGE"],
    [snapshotText, "PAGE_TEXT"],
  ] as const) {
    const result = createRiskWarningResult(detectRisk({ text, sourceType }));
    if (result) return result.message;
  }
  return input.goal.safety.riskState === "NONE"
    ? null
    : "금융사기 위험이 있을 수 있어요. 거래를 멈추고 확인해 주세요.";
}

function hasVisiblePolicy(
  input: ConversationAgentRequest,
  policy: BackendSanitizedDomElement["securityPolicy"],
): boolean {
  return input.snapshot?.sanitizedDomSnapshot.elements.some(
    (element) => element.visible && element.securityPolicy === policy,
  ) ?? false;
}

function guideMessage(elements: readonly BackendSanitizedDomElement[]): string {
  const labels = elements.map(textOf).join(" ");
  if (TERM_WORDS.some((word) => labels.includes(word))) {
    return "약관을 확인한 뒤 직접 선택해 주세요.";
  }
  if (PRODUCT_WORDS.some((word) => labels.includes(word))) {
    return DEPOSIT_GUIDANCE.productSelection;
  }
  return "필요한 항목을 직접 선택해 주세요.";
}

function safeNormalAction(
  input: ConversationAgentRequest,
): { actionType: "CLICK" | "TYPE"; target: BackendSanitizedDomElement } | null {
  const elements = input.snapshot?.sanitizedDomSnapshot.elements ?? [];
  const safe: Array<{
    actionType: "CLICK" | "TYPE";
    target: BackendSanitizedDomElement;
  }> = [];
  for (const element of elements) {
    if (!element.visible || !element.enabled || element.securityPolicy !== "NORMAL") {
      continue;
    }
    const label = textOf(element);
    const tag = element.tag.toLowerCase();
    const role = element.role?.toLowerCase();
    if (tag === "input" || tag === "textarea" || role === "textbox") {
      const amount = input.goal.amount?.value;
      const amountField = /(?:가입|예치)?\s*금액/u.test(label);
      if (amount && amountField && element.inputType !== "password") {
        safe.push({ actionType: "TYPE", target: element });
      }
      continue;
    }
    if (!["button", "a"].includes(tag) && !["button", "link"].includes(role ?? "")) {
      continue;
    }
    if (evaluateActionPolicy("CLICK", label).canExecute) {
      safe.push({ actionType: "CLICK", target: element });
    }
  }
  return safe.length === 1 ? safe[0] ?? null : null;
}

function containsUnverifiedFinalAction(input: ConversationAgentRequest): boolean {
  return input.snapshot?.sanitizedDomSnapshot.elements.some((element) =>
    element.visible && detectFinalAction({
      elementId: element.elementId,
      text: textOf(element),
      elementType: element.tag,
    }).detected,
  ) ?? false;
}

/**
 * Deterministic C-04 policy. C may return only the current snapshot's internal
 * elementId; Backend revalidates it and remains authoritative for public
 * target identity, execution and every latch.
 */
export function decideConversationInteraction(
  input: ConversationAgentRequest,
): AgentDecision {
  const base = baseDecision(input);
  const snapshot = input.snapshot;
  if (!snapshot) return base;
  if (snapshot.sourceSnapshotId !== snapshot.sanitizedDomSnapshot.snapshotId) {
    return {
      ...base,
      message: "화면이 변경되어 다음 단계를 다시 확인해야 합니다.",
      reasonCode: "STALE_SNAPSHOT",
    };
  }

  const actionRequest = toAiActionRequest(input);
  if (!actionRequest) return base;

  const secure = createSecureInputPauseForRequest(actionRequest);
  if (secure || input.goal.safety.secureInputActive) {
    return withSnapshotMode(
      input,
      "SECURE_INPUT_REQUIRED",
      secure?.message ?? DEPOSIT_GUIDANCE.secureInput,
      "SECURE_INPUT_BOUNDARY",
    );
  }

  const warning = riskMessage(input);
  if (warning) {
    return withSnapshotMode(input, "RISK_WARNING", warning, "RISK_BOUNDARY");
  }

  const finalBoundary = createDepositFinalBoundaryResponse(actionRequest);
  if (
    finalBoundary?.action === "NONE" &&
    finalBoundary.message === DEPOSIT_FINAL_MESSAGES.completed &&
    !finalBoundary.requiresUserAction
  ) {
    return withSnapshotMode(
      input,
      "COMPLETE",
      finalBoundary.message,
      "VERIFIED_COMPLETION",
    );
  }
  if (
    finalBoundary?.action === "REQUEST_FINAL_CONFIRMATION" &&
    ["APPROVED", "REJECTED"].includes(input.goal.safety.confirmationState)
  ) {
    return {
      ...base,
      message: "최종 확인 상태가 변경되어 새 화면을 기다립니다.",
      reasonCode: "BLOCKED_TARGET",
    };
  }
  if (finalBoundary?.action === "REQUEST_FINAL_CONFIRMATION") {
    return withSnapshotMode(
      input,
      "FINAL_CONFIRMATION_REQUIRED",
      finalBoundary.message,
      "FINAL_CONFIRMATION_BOUNDARY",
    );
  }
  if (input.goal.safety.confirmationState === "REQUIRED") {
    return withSnapshotMode(
      input,
      "FINAL_CONFIRMATION_REQUIRED",
      DEPOSIT_FINAL_MESSAGES.required,
      "BACKEND_CONFIRMATION_REQUIRED",
    );
  }

  const stage = classifyDepositScenarioStage(actionRequest);
  if (stage !== "UNKNOWN") {
    let protectedResponse: StructuredAIResponse;
    try {
      protectedResponse = enforceDepositScenarioPolicy(
        neutralResponse(input.requestId),
        actionRequest,
      );
    } catch {
      return { ...base, reasonCode: "BLOCKED_TARGET" };
    }
    if (protectedResponse.action === "WAIT_FOR_USER") {
      const target = uniqueSnapshotElement(
        input,
        protectedResponse.options?.[0]?.id,
      );
      if (!target) return { ...base, reasonCode: "BLOCKED_TARGET" };
      return withSnapshotMode(
        input,
        "GUIDE_USER",
        protectedResponse.message,
        `D25_${stage}`,
        { actionType: "WAIT_FOR_USER", target },
      );
    }
    if (["CLICK", "TYPE"].includes(protectedResponse.action)) {
      const target = uniqueSnapshotElement(input, protectedResponse.targetElementId);
      if (!target) return { ...base, reasonCode: "BLOCKED_TARGET" };
      return withSnapshotMode(
        input,
        "AUTO_EXECUTE",
        protectedResponse.message,
        `D25_${stage}`,
        {
          actionType: protectedResponse.action as "CLICK" | "TYPE",
          target,
        },
      );
    }
    if (protectedResponse.action === "PAUSE_FOR_SECURE_INPUT") {
      return withSnapshotMode(
        input,
        "SECURE_INPUT_REQUIRED",
        protectedResponse.message,
        "SECURE_INPUT_BOUNDARY",
      );
    }
    return {
      ...base,
      message: protectedResponse.message,
      reasonCode: "UNSUPPORTED_INTERACTION",
    };
  }

  if (hasVisiblePolicy(input, "BLOCKED") || containsUnverifiedFinalAction(input)) {
    return { ...base, reasonCode: "BLOCKED_TARGET" };
  }

  const userChoices = snapshot.sanitizedDomSnapshot.elements.filter(
    (element) => element.visible && element.enabled && element.securityPolicy === "USER_DECISION",
  );
  if (userChoices.length > 0) {
    const target = userChoices[0];
    if (!target) return { ...base, reasonCode: "BLOCKED_TARGET" };
    return withSnapshotMode(
      input,
      "GUIDE_USER",
      guideMessage(userChoices),
      "USER_DECISION_BOUNDARY",
      { actionType: "WAIT_FOR_USER", target },
    );
  }

  const action = safeNormalAction(input);
  if (action) {
    return withSnapshotMode(
      input,
      "AUTO_EXECUTE",
      action.actionType === "TYPE" ? DEPOSIT_GUIDANCE.amount : "다음 화면으로 이동합니다.",
      "SAFE_CURRENT_SNAPSHOT_ACTION",
      action,
    );
  }

  return base;
}

/** Validates wire semantics against the current authoritative request. */
export function validateConversationInteractionDecision(
  input: ConversationAgentRequest,
  value: unknown,
): InteractionValidationResult {
  const schema = validateAgentDecision(value);
  if (!schema.valid) return schema;
  const decision = value as AgentDecision;
  const errors: string[] = [];

  if (decision.requestId !== input.requestId) errors.push("/requestId must echo the request");
  if (decision.requestMessageId !== input.requestMessageId) {
    errors.push("/requestMessageId must echo the request");
  }
  if (decision.goalId !== input.goal.goalId) errors.push("/goalId must echo Backend authority");
  if (decision.baseGoalRevision !== input.goal.revision) {
    errors.push("/baseGoalRevision must equal the authoritative goal revision");
  }

  if (SNAPSHOT_MODES.has(decision.mode)) {
    const snapshotId = input.snapshot?.sourceSnapshotId ?? null;
    if (!snapshotId || decision.sourceSnapshotId !== snapshotId) {
      errors.push(`/sourceSnapshotId is required and must match for ${decision.mode}`);
    }
    if (snapshotId !== input.snapshot?.sanitizedDomSnapshot.snapshotId) {
      errors.push("/snapshot identities must match before reusing a candidate");
    }
  }

  if (
    decision.message !== null &&
    sanitizeInternalMessage(decision.message) !== decision.message
  ) {
    errors.push("/message must satisfy the existing safe-message policy");
  }

  if (decision.mode === "GUIDE_USER" || decision.mode === "AUTO_EXECUTE") {
    const candidate = decision.actionCandidate;
    const matches = input.snapshot?.sanitizedDomSnapshot.elements.filter(
      (element) => element.elementId === candidate?.targetElementId,
    ) ?? [];
    if (matches.length !== 1) {
      errors.push("/actionCandidate/targetElementId must identify exactly one current snapshot element");
    } else if (candidate) {
      const target = matches[0]!;
      if (!target.visible || !target.enabled) {
        errors.push("/actionCandidate target must be visible and enabled");
      }
      const requiredPolicy = decision.mode === "GUIDE_USER"
        ? "USER_DECISION"
        : "NORMAL";
      if (target.securityPolicy !== requiredPolicy) {
        errors.push(`/actionCandidate target must have ${requiredPolicy} security policy`);
      }
      if (!target.role || candidate.role !== target.role.toLowerCase()) {
        errors.push("/actionCandidate/role must match the sanitized target role");
      }
      const expectedLabel = safeTargetLabel(target);
      if (!expectedLabel || candidate.accessibleLabel !== expectedLabel) {
        errors.push("/actionCandidate/accessibleLabel must match the safe sanitized target label");
      }
      if (
        decision.message === null ||
        candidate.guide !== decision.message ||
        sanitizeInternalMessage(candidate.guide) !== candidate.guide
      ) {
        errors.push("/actionCandidate/guide must equal the safe decision message");
      }
      if (decision.mode === "GUIDE_USER" && candidate.actionType !== "WAIT_FOR_USER") {
        errors.push("/actionCandidate/actionType must be WAIT_FOR_USER for GUIDE_USER");
      }
      if (
        decision.mode === "AUTO_EXECUTE" &&
        !["CLICK", "TYPE"].includes(candidate.actionType)
      ) {
        errors.push("/actionCandidate/actionType must be CLICK or TYPE for AUTO_EXECUTE");
      }
    }
  }

  if (decision.mode === "ASK_USER") {
    const fieldKey = decision.question?.fieldKey;
    const missingInCurrentGoal = fieldKey
      ? input.goal.missingFields.includes(fieldKey)
      : false;
    const missingInProposedPatch = fieldKey
      ? decision.goalPatch?.missingFields?.includes(fieldKey) ?? false
      : false;
    if (!fieldKey || (!missingInCurrentGoal && !missingInProposedPatch)) {
      errors.push("/question must request a currently missing goal field");
    }
    if (!decision.goalPatch || Object.keys(decision.goalPatch).length <= 1) {
      errors.push("/goalPatch must carry the ASK_USER proposal");
    }
  }

  if (
    decision.mode === "GOAL_PATCH_PROPOSED" &&
    decision.sourceSnapshotId !== null
  ) {
    errors.push("/sourceSnapshotId must be null for GOAL_PATCH_PROPOSED");
  }

  if (decision.mode === "STOP" && !TERMINAL_REASON_CODES.has(decision.reasonCode)) {
    errors.push("/reasonCode must have terminal or fail-closed STOP meaning");
  }

  if (SNAPSHOT_MODES.has(decision.mode)) {
    const expected = decideConversationInteraction(input);
    if (expected.mode !== decision.mode) {
      errors.push(`/mode conflicts with current protection policy; expected ${expected.mode}`);
    }
    if (
      JSON.stringify(expected.actionCandidate) !==
      JSON.stringify(decision.actionCandidate)
    ) {
      errors.push("/actionCandidate must match the current snapshot policy");
    }
  }

  return { valid: errors.length === 0, errors };
}
