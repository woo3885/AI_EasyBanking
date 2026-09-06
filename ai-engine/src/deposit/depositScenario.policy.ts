import type {
  AiActionRequest,
  BackendSanitizedDomElement,
} from "../api/aiRequest.types.js";

import type {
  StructuredAIResponse,
} from "../output/aiResponse.types.js";

import {
  SAFE_DECISION_LABEL,
  sanitizeDecisionLabel,
  sanitizeInternalMessage,
} from "../messages/messageSafety.js";

import {
  createSecureInputPauseForRequest,
} from "../secureInput/secureInput.policy.js";

export type DepositScenarioStage =
  | "PRODUCT_LIST"
  | "PRODUCT_DETAIL"
  | "AMOUNT_ENTRY"
  | "TERMS"
  | "SECURE_INPUT"
  | "UNKNOWN";

export interface SelectedDepositProductContext {
  productId: string;
  productLabel: string;
  periodMonths: number;
  sourceSnapshotId: string;
}

export const DEPOSIT_GUIDANCE = Object.freeze({
  productSelection:
    "가입할 예금 상품을 직접 선택해 주세요.",
  productDetail:
    "가입 기간과 금리를 확인해 주세요.",
  amount:
    "가입 금액을 확인해 주세요.",
  amountConfirm:
    "입력한 가입 금액을 확인해 주세요.",
  termsNavigation:
    "약관 내용을 확인해 주세요.",
  amountMissing:
    "가입 금액을 확인하려면 추가 정보가 필요합니다.",
  productVerification:
    "선택한 상품의 상세 조건을 다시 확인해 주세요.",
  periodMismatch:
    "선택한 상품의 가입 기간을 다시 확인해 주세요.",
  finalBoundary:
    "현재 단계에서는 최종 확인을 진행하지 않습니다.",
  terms:
    "필수 약관과 선택 약관을 직접 선택해 주세요.",
  termsResume:
    "약관 선택 내용을 확인해 주세요.",
  secureNavigation:
    "비밀번호 입력 화면으로 이동합니다.",
  secureInput:
    "비밀번호는 금융 화면에 직접 입력해 주세요.",
} as const);

const DEPOSIT_PRODUCT_ID_PATTERN =
  /^deposit-[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const DEPOSIT_PRODUCT_PERIOD_PATTERN =
  /^([1-9][0-9]{0,2})\s*개월$/u;
const REQUEST_PERIOD_PATTERN =
  /(?<![0-9])([0-9]+)\s*(개월|달|년)/gu;
const MAX_DEPOSIT_PERIOD_MONTHS = 999;

export const DEPOSIT_DEMO_BUTTON_LABELS = Object.freeze({
  productNext: "선택한 상품 상세 보기",
  amountStart: "가입 금액 입력하기",
  amountConfirm: "입력 금액 확인",
  termsStart: "약관 확인으로 이동",
  termsConfirm: "약관 선택 확인",
  passwordStart: "비밀번호 입력으로 이동",
} as const);

const PRODUCT_KEYWORDS = [
  "정기예금",
  "예금 상품",
  "예금상품",
  "가입 상품",
] as const;

const DETAIL_KEYWORDS = [
  "가입 기간",
  "기간",
  "금리",
  "이율",
  "상품 조건",
] as const;

const AMOUNT_KEYWORDS = [
  "가입 금액",
  "가입금액",
  "예치 금액",
  "예치금액",
] as const;

const TERM_KEYWORDS = [
  "약관",
  "동의",
  "필수",
  "선택",
  "개인정보",
] as const;

const NAVIGATION_KEYWORDS = [
  "가입하기",
  "가입 진행",
  "신청 진행",
  "다음",
  "계속",
  "확인",
] as const;

function normalize(value: string | null | undefined): string {
  return value
    ?.toLowerCase()
    .replace(/\s+/g, " ")
    .trim() ?? "";
}

function elementText(
  element: BackendSanitizedDomElement,
): string {
  return [
    element.ariaLabel,
    element.text,
    element.placeholder,
    element.role,
    element.tag,
  ]
    .map(normalize)
    .filter(Boolean)
    .join(" ");
}

function preferredDecisionLabel(
  element: BackendSanitizedDomElement,
): string {
  return [
    element.ariaLabel,
    element.text,
    element.placeholder,
  ].find((value) =>
    typeof value === "string" &&
    value.trim().length > 0,
  )?.trim() ?? "";
}

function includesAny(
  value: string,
  keywords: readonly string[],
): boolean {
  return keywords.some((keyword) =>
    value.includes(normalize(keyword)),
  );
}

function canonicalDetailPath(
  url: string,
): string | null {
  try {
    return new URL(url).pathname.replace(/\/+$/u, "");
  } catch {
    return null;
  }
}

/**
 * B가 상품 상세 화면에서만 제공하는 sanitized semantic context를 읽는다.
 * URL은 detail 화면 identity 확인에만 쓰고 기간 source로 사용하지 않는다.
 */
export function readSelectedDepositProductContext(
  request: AiActionRequest,
): SelectedDepositProductContext | null {
  const page = request.domSnapshot.page;
  const productId = page.productId;
  const productLabel = page.productName;
  const productPeriod = page.productPeriod;

  if (
    typeof productId !== "string" ||
    !DEPOSIT_PRODUCT_ID_PATTERN.test(productId) ||
    typeof productLabel !== "string" ||
    productLabel.trim() !== productLabel ||
    productLabel.length === 0 ||
    typeof productPeriod !== "string"
  ) {
    return null;
  }

  const periodMatch = productPeriod.match(
    DEPOSIT_PRODUCT_PERIOD_PATTERN,
  );
  const periodMonths = Number(periodMatch?.[1]);
  if (
    !periodMatch ||
    !Number.isSafeInteger(periodMonths) ||
    periodMonths <= 0 ||
    periodMonths > MAX_DEPOSIT_PERIOD_MONTHS
  ) {
    return null;
  }

  const pathname = canonicalDetailPath(page.url);
  if (
    pathname !==
    `/deposit/products/${encodeURIComponent(productId)}`
  ) {
    return null;
  }

  return Object.freeze({
    productId,
    productLabel,
    periodMonths,
    sourceSnapshotId: request.domSnapshot.snapshotId,
  });
}

type RequestedDepositPeriod =
  | { kind: "UNSPECIFIED" }
  | { kind: "VALID"; months: number }
  | { kind: "INVALID" };

function durationInMonths(
  value: number,
  unit: string,
): number | null {
  if (!Number.isSafeInteger(value) || value <= 0) {
    return null;
  }

  const months = unit === "MONTH"
    ? value
    : unit === "YEAR"
      ? value * 12
      : null;

  return months !== null &&
    Number.isSafeInteger(months) &&
    months <= MAX_DEPOSIT_PERIOD_MONTHS
    ? months
    : null;
}

function requestedDepositPeriod(
  request: AiActionRequest,
): RequestedDepositPeriod {
  const rawPeriods = Array.from(
    request.userGoal.rawMessage.matchAll(
      REQUEST_PERIOD_PATTERN,
    ),
    (match) => {
      const value = Number(match[1]);
      const unit = match[2] === "년"
        ? "YEAR"
        : "MONTH";
      return durationInMonths(value, unit);
    },
  );

  if (rawPeriods.some((period) => period === null)) {
    return { kind: "INVALID" };
  }

  const distinctRawPeriods = new Set(rawPeriods);
  if (distinctRawPeriods.size > 1) {
    return { kind: "INVALID" };
  }

  const duration = request.userGoal.duration;
  if (!duration) {
    return rawPeriods.length === 0
      ? { kind: "UNSPECIFIED" }
      : { kind: "INVALID" };
  }

  const months = durationInMonths(
    duration.value,
    duration.unit,
  );
  if (
    months === null ||
    (
      distinctRawPeriods.size === 1 &&
      !distinctRawPeriods.has(months)
    )
  ) {
    return { kind: "INVALID" };
  }

  return { kind: "VALID", months };
}

function isVisible(
  element: BackendSanitizedDomElement,
): boolean {
  return element.visible;
}

function isVisibleEnabled(
  element: BackendSanitizedDomElement,
): boolean {
  return element.visible && element.enabled;
}

function isChoiceControl(
  element: BackendSanitizedDomElement,
): boolean {
  const inputType = normalize(element.inputType);
  const role = normalize(element.role);
  return (
    inputType === "checkbox" ||
    inputType === "radio" ||
    role === "checkbox" ||
    role === "radio"
  );
}

function isNormalClickable(
  element: BackendSanitizedDomElement,
): boolean {
  const tag = normalize(element.tag);
  const role = normalize(element.role);
  return (
    isVisibleEnabled(element) &&
    element.securityPolicy === "NORMAL" &&
    (
      tag === "button" ||
      tag === "a" ||
      role === "button" ||
      role === "link"
    )
  );
}

function isVisibleNormalButton(
  element: BackendSanitizedDomElement,
): boolean {
  const tag = normalize(element.tag);
  const role = normalize(element.role);
  return (
    element.visible &&
    element.securityPolicy === "NORMAL" &&
    (
      tag === "button" ||
      role === "button"
    )
  );
}

function matchesExactLabel(
  element: BackendSanitizedDomElement,
  label: string,
): boolean {
  const expected = normalize(label);
  return (
    normalize(element.text) === expected ||
    normalize(element.ariaLabel) === expected
  );
}

function findDemoButton(
  request: AiActionRequest,
  label: string,
  enabledOnly: boolean,
): BackendSanitizedDomElement | null {
  return request.domSnapshot.elements.find(
    (element) =>
      isVisibleNormalButton(element) &&
      (!enabledOnly || element.enabled) &&
      matchesExactLabel(element, label),
  ) ?? null;
}

function isAmountInput(
  element: BackendSanitizedDomElement,
): boolean {
  const tag = normalize(element.tag);
  const role = normalize(element.role);
  const inputType = normalize(element.inputType);
  const text = elementText(element);
  return (
    isVisibleEnabled(element) &&
    element.securityPolicy === "NORMAL" &&
    (
      tag === "input" ||
      tag === "textarea" ||
      role === "textbox"
    ) &&
    !["password", "hidden"].includes(inputType) &&
    includesAny(text, AMOUNT_KEYWORDS)
  );
}

function productChoices(
  request: AiActionRequest,
): BackendSanitizedDomElement[] {
  return request.domSnapshot.elements.filter(
    (element) => {
      const inputType = normalize(element.inputType);
      const role = normalize(element.role);
      return (
      isVisibleEnabled(element) &&
      element.securityPolicy === "USER_DECISION" &&
      inputType !== "checkbox" &&
      role !== "checkbox" &&
      includesAny(elementText(element), PRODUCT_KEYWORDS)
      );
    },
  );
}

function validatedProductChoices(
  request: AiActionRequest,
): BackendSanitizedDomElement[] {
  const choices = productChoices(request);
  const labels = new Set<string>();

  for (const choice of choices) {
    const label = sanitizeDecisionLabel(
      preferredDecisionLabel(choice),
    );
    const normalizedLabel = normalize(label);
    if (
      label === SAFE_DECISION_LABEL ||
      normalizedLabel.length === 0 ||
      labels.has(normalizedLabel)
    ) {
      throw new Error(
        "[AI Engine] deposit product labels must be non-blank and unique in the current snapshot.",
      );
    }
    labels.add(normalizedLabel);
  }

  return choices;
}

function termChoices(
  request: AiActionRequest,
): BackendSanitizedDomElement[] {
  return request.domSnapshot.elements.filter(
    (element) =>
      isVisibleEnabled(element) &&
      element.securityPolicy === "USER_DECISION" &&
      isChoiceControl(element) &&
      includesAny(elementText(element), TERM_KEYWORDS),
  );
}

function navigationTargets(
  request: AiActionRequest,
): BackendSanitizedDomElement[] {
  return request.domSnapshot.elements.filter(
    (element) =>
      isNormalClickable(element) &&
      includesAny(elementText(element), NAVIGATION_KEYWORDS),
  );
}

function hasSecureInput(
  request: AiActionRequest,
): boolean {
  return request.domSnapshot.elements.some((element) => {
    if (!isVisible(element)) {
      return false;
    }
    const inputType = normalize(element.inputType);
    const tag = normalize(element.tag);
    const role = normalize(element.role);
    const text = elementText(element);
    const isInputLike =
      tag === "input" ||
      tag === "textarea" ||
      role === "textbox";
    return (
      element.securityPolicy === "SECURE_INPUT" ||
      (
        isInputLike &&
        (
          inputType === "password" ||
          includesAny(text, [
            "비밀번호",
            "pin",
            "otp",
            "인증번호",
          ])
        )
      )
    );
  });
}

function isDepositRequest(
  request: AiActionRequest,
): boolean {
  return (
    request.userGoal.intent === "DEPOSIT" ||
    includesAny(normalize(request.userGoal.rawMessage), [
      "정기예금",
      "예금 가입",
    ])
  );
}

export function classifyDepositScenarioStage(
  request: AiActionRequest,
): DepositScenarioStage {
  if (!isDepositRequest(request)) {
    return "UNKNOWN";
  }

  if (hasSecureInput(request)) {
    return "SECURE_INPUT";
  }

  if (termChoices(request).length > 0) {
    return "TERMS";
  }

  if (
    request.domSnapshot.elements.some(isAmountInput) ||
    findDemoButton(
      request,
      DEPOSIT_DEMO_BUTTON_LABELS.amountConfirm,
      false,
    ) !== null ||
    findDemoButton(
      request,
      DEPOSIT_DEMO_BUTTON_LABELS.termsStart,
      false,
    ) !== null
  ) {
    return "AMOUNT_ENTRY";
  }

  if (
    productChoices(request).length > 0 ||
    findDemoButton(
      request,
      DEPOSIT_DEMO_BUTTON_LABELS.productNext,
      false,
    ) !== null
  ) {
    return "PRODUCT_LIST";
  }

  if (
    findDemoButton(
      request,
      DEPOSIT_DEMO_BUTTON_LABELS.amountStart,
      false,
    ) !== null
  ) {
    return "PRODUCT_DETAIL";
  }

  const visibleText = request.domSnapshot.elements
    .filter(isVisible)
    .map(elementText)
    .join(" ");
  const hasDetailSemantics =
    includesAny(visibleText, DETAIL_KEYWORDS);
  const hasProductResume =
    request.userDecisionContext?.decisionType ===
    "PRODUCT_SELECTION";
  const urlHint = normalize(
    request.domSnapshot.page.url,
  ).includes("/deposit/");

  if (
    navigationTargets(request).length > 0 &&
    (
      hasDetailSemantics ||
      (hasProductResume && urlHint)
    )
  ) {
    return "PRODUCT_DETAIL";
  }

  return "UNKNOWN";
}

function clearDecisionMetadata(
  response: StructuredAIResponse,
): StructuredAIResponse {
  return {
    ...response,
    decisionType: null,
    options: null,
    confirmationId: null,
    summary: null,
  };
}

function createNoneResponse(
  response: StructuredAIResponse,
  message: string,
): StructuredAIResponse {
  return {
    ...clearDecisionMetadata(response),
    status: "AI_EXECUTING",
    action: "NONE",
    targetElementId: null,
    inputValue: null,
    message,
    confidence: 1,
    requiresUserAction: true,
    secureInputType: null,
    riskType: null,
  };
}

function hasRiskOrSecureModelSignal(
  response: StructuredAIResponse,
): boolean {
  return (
    response.status === "RISK_WARNING" ||
    response.riskType !== null ||
    response.status === "SECURE_INPUT_REQUIRED" ||
    response.action === "PAUSE_FOR_SECURE_INPUT" ||
    response.secureInputType !== null
  );
}

function hasFinalConfirmationModelSignal(
  response: StructuredAIResponse,
): boolean {
  return (
    response.status === "FINAL_CONFIRMATION_REQUIRED" ||
    response.action === "REQUEST_FINAL_CONFIRMATION" ||
    response.confirmationId !== null
  );
}

function createDecisionResponse(
  response: StructuredAIResponse,
  decisionType: "PRODUCT_SELECTION" | "TERMS_AGREEMENT",
  choices: readonly BackendSanitizedDomElement[],
  message: string,
): StructuredAIResponse {
  return {
    ...response,
    status: "USER_DECISION_REQUIRED",
    action: "WAIT_FOR_USER",
    targetElementId: null,
    inputValue: null,
    message,
    confidence: 1,
    requiresUserAction: true,
    decisionType,
    secureInputType: null,
    riskType: null,
    options: choices.map((choice) => ({
      id: choice.elementId,
      label: preferredDecisionLabel(choice),
      ...(decisionType === "TERMS_AGREEMENT"
        ? { required: false }
        : {}),
    })),
    confirmationId: null,
    summary: null,
  };
}

function createNavigationResponse(
  response: StructuredAIResponse,
  target: BackendSanitizedDomElement,
  message: string,
): StructuredAIResponse {
  return {
    ...clearDecisionMetadata(response),
    status: "AI_EXECUTING",
    action: "CLICK",
    targetElementId: target.elementId,
    inputValue: null,
    message,
    confidence: 1,
    requiresUserAction: false,
    secureInputType: null,
    riskType: null,
  };
}

function enforceProductList(
  response: StructuredAIResponse,
  request: AiActionRequest,
): StructuredAIResponse {
  if (
    request.userDecisionContext?.decisionType ===
    "PRODUCT_SELECTION"
  ) {
    const target = findDemoButton(
      request,
      DEPOSIT_DEMO_BUTTON_LABELS.productNext,
      true,
    );
    return target
      ? createNavigationResponse(
          response,
          target,
          DEPOSIT_GUIDANCE.productDetail,
        )
      : createNoneResponse(
          response,
          DEPOSIT_GUIDANCE.productDetail,
        );
  }

  return createDecisionResponse(
    response,
    "PRODUCT_SELECTION",
    validatedProductChoices(request),
    DEPOSIT_GUIDANCE.productSelection,
  );
}

function enforceTerms(
  response: StructuredAIResponse,
  request: AiActionRequest,
): StructuredAIResponse {
  const passwordTarget = findDemoButton(
    request,
    DEPOSIT_DEMO_BUTTON_LABELS.passwordStart,
    true,
  );
  if (passwordTarget) {
    return createNavigationResponse(
      response,
      passwordTarget,
      DEPOSIT_GUIDANCE.secureNavigation,
    );
  }

  if (
    request.userDecisionContext?.decisionType ===
    "TERMS_AGREEMENT"
  ) {
    const confirmTarget = findDemoButton(
      request,
      DEPOSIT_DEMO_BUTTON_LABELS.termsConfirm,
      true,
    );
    return confirmTarget
      ? createNavigationResponse(
          response,
          confirmTarget,
          DEPOSIT_GUIDANCE.termsResume,
        )
      : createNoneResponse(
          response,
          DEPOSIT_GUIDANCE.termsResume,
        );
  }

  return createDecisionResponse(
    response,
    "TERMS_AGREEMENT",
    termChoices(request),
    DEPOSIT_GUIDANCE.terms,
  );
}

function enforceAmountEntry(
  response: StructuredAIResponse,
  request: AiActionRequest,
): StructuredAIResponse {
  const termsTarget = findDemoButton(
    request,
    DEPOSIT_DEMO_BUTTON_LABELS.termsStart,
    true,
  );
  if (termsTarget) {
    return createNavigationResponse(
      response,
      termsTarget,
      DEPOSIT_GUIDANCE.termsNavigation,
    );
  }

  const confirmTarget = findDemoButton(
    request,
    DEPOSIT_DEMO_BUTTON_LABELS.amountConfirm,
    true,
  );
  if (confirmTarget) {
    return createNavigationResponse(
      response,
      confirmTarget,
      DEPOSIT_GUIDANCE.amountConfirm,
    );
  }

  const amount = request.userGoal.amount;
  if (
    amount === undefined ||
    !Number.isSafeInteger(amount) ||
    amount <= 0
  ) {
    return createNoneResponse(
      response,
      DEPOSIT_GUIDANCE.amountMissing,
    );
  }

  const amountInputs = request.domSnapshot.elements
    .filter(isAmountInput);
  const modelInput = amountInputs.find(
    (input) =>
      response.action === "TYPE" &&
      response.targetElementId === input.elementId,
  );
  const input = modelInput ??
    (amountInputs.length === 1
      ? amountInputs[0] ?? null
      : null);

  if (!input) {
    return createNoneResponse(
      response,
      DEPOSIT_GUIDANCE.amountMissing,
    );
  }

  return {
    ...clearDecisionMetadata(response),
    status: "AI_EXECUTING",
    action: "TYPE",
    targetElementId: input.elementId,
    inputValue: String(amount),
    message: DEPOSIT_GUIDANCE.amount,
    confidence: 1,
    requiresUserAction: false,
    secureInputType: null,
    riskType: null,
  };
}

function enforceProductDetail(
  response: StructuredAIResponse,
  request: AiActionRequest,
): StructuredAIResponse {
  const product = readSelectedDepositProductContext(
    request,
  );
  const requestedPeriod = requestedDepositPeriod(
    request,
  );

  if (
    !product ||
    requestedPeriod.kind === "INVALID"
  ) {
    return createNoneResponse(
      response,
      DEPOSIT_GUIDANCE.productVerification,
    );
  }

  if (
    requestedPeriod.kind === "VALID" &&
    requestedPeriod.months !== product.periodMonths
  ) {
    return createNoneResponse(
      response,
      DEPOSIT_GUIDANCE.periodMismatch,
    );
  }

  const target = findDemoButton(
    request,
    DEPOSIT_DEMO_BUTTON_LABELS.amountStart,
    true,
  );
  return target
    ? createNavigationResponse(
        response,
        target,
        DEPOSIT_GUIDANCE.productDetail,
      )
    : createNoneResponse(
        response,
        DEPOSIT_GUIDANCE.productDetail,
      );
}

function enforceSecureInput(
  response: StructuredAIResponse,
  request: AiActionRequest,
): StructuredAIResponse {
  return createSecureInputPauseForRequest(request) ?? {
    ...clearDecisionMetadata(response),
    status: "SECURE_INPUT_REQUIRED",
    action: "PAUSE_FOR_SECURE_INPUT",
    targetElementId: null,
    inputValue: null,
    message: DEPOSIT_GUIDANCE.secureInput,
    confidence: 1,
    requiresUserAction: true,
    secureInputType: null,
    riskType: null,
  };
}

export function enforceDepositScenarioPolicy(
  response: StructuredAIResponse,
  request: AiActionRequest,
): StructuredAIResponse {
  const stage = classifyDepositScenarioStage(
    request,
  );

  if (stage === "SECURE_INPUT") {
    return enforceSecureInput(response, request);
  }

  if (hasRiskOrSecureModelSignal(response)) {
    return response;
  }

  /*
   * D25 ends at SECURE_INPUT_REQUIRED. A model-authored D27 signal must not
   * cross the deposit Production boundary, including a semantically unknown
   * deposit screen. Non-deposit UNKNOWN requests retain the existing global
   * final-confirmation behavior.
   */
  if (
    isDepositRequest(request) &&
    hasFinalConfirmationModelSignal(response)
  ) {
    return createNoneResponse(
      response,
      DEPOSIT_GUIDANCE.finalBoundary,
    );
  }

  switch (stage) {
    case "PRODUCT_LIST":
      return enforceProductList(response, request);
    case "PRODUCT_DETAIL":
      return enforceProductDetail(response, request);
    case "AMOUNT_ENTRY":
      return enforceAmountEntry(response, request);
    case "TERMS":
      return enforceTerms(response, request);
    case "UNKNOWN":
      return {
        ...response,
        message: sanitizeInternalMessage(
          response.message,
        ),
      };
  }
}

/**
 * D24 canonicalizes decision items and deliberately replaces model-authored
 * wait text. D25 decision text is not model-authored, so restore only the
 * static guidance produced for a semantically classified deposit stage after
 * D24 validation has completed.
 */
export function finalizeDepositScenarioGuidance(
  response: StructuredAIResponse,
  depositChecked: StructuredAIResponse,
  stage: DepositScenarioStage,
): StructuredAIResponse {
  if (
    response.action === "WAIT_FOR_USER" &&
    (
      stage === "PRODUCT_LIST" ||
      stage === "TERMS"
    )
  ) {
    return {
      ...response,
      message: depositChecked.message,
    };
  }

  return response;
}
