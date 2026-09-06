import type {
  AiActionRequest,
  BackendSanitizedDomElement,
} from "../api/aiRequest.types.js";

import type {
  StructuredAIResponse,
} from "../output/aiResponse.types.js";

export type BackendSecureInputType =
  | "ACCOUNT_PASSWORD"
  | "OTP"
  | "CERTIFICATE_PASSWORD";

interface SecureInputBoundary {
  secureInputType: BackendSecureInputType | null;
  message: string;
}

const SECURE_MESSAGES = Object.freeze({
  ACCOUNT_PASSWORD:
    "비밀번호는 금융 화면에 직접 입력해 주세요.",
  OTP:
    "인증번호는 금융 화면에 직접 입력해 주세요.",
  CERTIFICATE_PASSWORD:
    "인증서 비밀번호는 금융 화면에 직접 입력해 주세요.",
  UNKNOWN:
    "보안 정보는 금융 화면에 직접 입력해 주세요.",
});

function normalizedElementText(
  element: BackendSanitizedDomElement,
): string {
  return [
    element.text,
    element.ariaLabel,
    element.placeholder,
    element.inputType,
  ]
    .filter((value): value is string =>
      typeof value === "string",
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function classifySecureInputType(
  element: BackendSanitizedDomElement,
): BackendSecureInputType | null {
  const source = normalizedElementText(element);

  if (
    source.includes("인증서") ||
    source.includes("certificate")
  ) {
    return "CERTIFICATE_PASSWORD";
  }

  if (
    source.includes("otp") ||
    source.includes("one-time") ||
    source.includes("인증번호") ||
    source.includes("인증 번호")
  ) {
    return "OTP";
  }

  if (
    source.includes("비밀번호") ||
    source.includes("password")
  ) {
    return "ACCOUNT_PASSWORD";
  }

  return null;
}

function findSecureInputBoundary(
  request: AiActionRequest,
): SecureInputBoundary | null {
  const secureElements = request.domSnapshot.elements.filter(
    (element) =>
      element.visible &&
      element.securityPolicy === "SECURE_INPUT",
  );

  if (secureElements.length === 0) {
    return null;
  }

  const detectedTypes = new Set(
    secureElements
      .map(classifySecureInputType)
      .filter(
        (value): value is BackendSecureInputType =>
          value !== null,
      ),
  );
  const secureInputType =
    detectedTypes.size === 1
      ? [...detectedTypes][0] ?? null
      : null;

  return {
    secureInputType,
    message:
      secureInputType === null
        ? SECURE_MESSAGES.UNKNOWN
        : SECURE_MESSAGES[secureInputType],
  };
}

function hasModelSecureSignal(
  response: StructuredAIResponse,
): boolean {
  return (
    response.status === "SECURE_INPUT_REQUIRED" ||
    response.action === "PAUSE_FOR_SECURE_INPUT" ||
    response.secureInputType !== null
  );
}

function createSecurePauseResponse(
  requestId: string,
  boundary: SecureInputBoundary,
): StructuredAIResponse {
  return {
    requestId,
    status: "SECURE_INPUT_REQUIRED",
    action: "PAUSE_FOR_SECURE_INPUT",
    targetElementId: null,
    inputValue: null,
    message: boundary.message,
    confidence: 1,
    requiresUserAction: true,
    decisionType: null,
    secureInputType: boundary.secureInputType,
    riskType: null,
    options: null,
    confirmationId: null,
    summary: null,
  };
}

/**
 * Returns a canonical pause before a prompt or model call can observe a
 * secure screen. Backend owns the secure channel; C only emits a blocked
 * control response derived from the sanitized security policy.
 */
export function createSecureInputPauseForRequest(
  request: AiActionRequest,
): StructuredAIResponse | null {
  const boundary = findSecureInputBoundary(request);

  return boundary
    ? createSecurePauseResponse(
        request.requestId,
        boundary,
      )
    : null;
}

/**
 * Rejects a model-invented secure transition when no secure element exists,
 * and canonicalizes every candidate when a secure element does exist.
 */
export function enforceSecureInputPolicy(
  response: StructuredAIResponse,
  request: AiActionRequest,
): StructuredAIResponse {
  const boundary = findSecureInputBoundary(request);

  if (boundary) {
    return createSecurePauseResponse(
      response.requestId,
      boundary,
    );
  }

  if (hasModelSecureSignal(response)) {
    throw new Error(
      "[AI Engine] secure transition requires a current sanitized SECURE_INPUT element.",
    );
  }

  return response;
}
