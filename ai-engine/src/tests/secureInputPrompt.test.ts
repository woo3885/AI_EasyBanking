import {
  adaptBackendDomToModelInput,
} from "../api/domRequest.adapter.js";

import {
  createNextActionPrompt,
} from "../prompts/nextActionPrompt.js";

import {
  validateStructuredAIResponse,
} from "../output/aiResponse.validator.js";

import type {
  BackendSanitizedDomSnapshot,
} from "../api/aiRequest.types.js";

import type {
  StructuredAIResponse,
} from "../output/aiResponse.types.js";

/*
 * Backend가 전달했다고 가정하는
 * SECURE_INPUT Sanitized DOM
 */
const secureInputSnapshot:
  BackendSanitizedDomSnapshot = {
  schemaVersion: "1.0",

  snapshotId:
    "snap-secure-prompt-001",

  page: {
    url:
      "https://demo-bank.local/transfer/otp",

    title:
      "OTP 인증",
    productId: null,
    productName: null,
    productPeriod: null,
  },

  elements: [
    {
      elementId:
        "el-secure-otp",

      tag:
        "input",

      role:
        "textbox",

      text:
        null,

      ariaLabel:
        "OTP 인증번호",

      placeholder:
        "인증번호 6자리",

      inputType:
        "text",

      visible:
        true,

      enabled:
        true,

      checked:
        null,

      boundingBox: {
        x: 100,
        y: 200,
        width: 300,
        height: 40,
      },

      securityPolicy:
        "SECURE_INPUT",
    },
  ],
};

/*
 * 1. Backend DOM -> AI Model DOM 변환
 */
const modelDom =
  adaptBackendDomToModelInput(
    secureInputSnapshot,
  );

const secureElement =
  modelDom.elements[0];

if (!secureElement) {
  throw new Error(
    "SECURE_INPUT 요소가 모델 DOM에 포함되지 않았습니다.",
  );
}

console.log();
console.log(
  "========================================",
);

console.log(
  "D22 SECURE_INPUT DOM Adapter Test",
);

console.log(
  "========================================",
);

console.log(
  `[elementId] ${secureElement.id}`,
);

console.log(
  `[actionable] ${secureElement.actionable}`,
);

console.log(
  `[actionHint] ${secureElement.actionHint}`,
);

if (
  secureElement.actionable !==
  false
) {
  throw new Error(
    "SECURE_INPUT 요소가 actionable=true로 변환되었습니다.",
  );
}

if (
  secureElement.actionHint !==
  "SECURITY_POLICY:SECURE_INPUT"
) {
  throw new Error(
    "SECURE_INPUT 보안 정책이 actionHint에 보존되지 않았습니다.",
  );
}

console.log();
console.log(
  "SECURE_INPUT DOM Adapter SUCCESS",
);

/*
 * 2. 실제 Prompt 생성
 */
const prompt =
  createNextActionPrompt(
    "req-secure-prompt-001",

    {
      rawMessage:
        "친구에게 10만원을 보내고 싶어요.",

      intent:
        "TRANSFER",

      amount:
        100000,

      recipient:
        "친구",
    },

    modelDom,
  );

console.log();
console.log(
  "========================================",
);

console.log(
  "D22 SECURE_INPUT Prompt Test",
);

console.log(
  "========================================",
);

const containsSecurityPolicy =
  prompt.includes(
    "SECURITY_POLICY:SECURE_INPUT",
  );

const containsPauseAction =
  prompt.includes(
    "PAUSE_FOR_SECURE_INPUT",
  );

const containsSecureStatus =
  prompt.includes(
    "SECURE_INPUT_REQUIRED",
  );

console.log(
  `[SECURE_INPUT 정책 포함] ${containsSecurityPolicy}`,
);

console.log(
  `[PAUSE Action 포함] ${containsPauseAction}`,
);

console.log(
  `[SECURE_INPUT 상태 포함] ${containsSecureStatus}`,
);

if (!containsSecurityPolicy) {
  throw new Error(
    "Prompt에 SECURITY_POLICY:SECURE_INPUT이 포함되지 않았습니다.",
  );
}

if (!containsPauseAction) {
  throw new Error(
    "Prompt에 PAUSE_FOR_SECURE_INPUT 규칙이 포함되지 않았습니다.",
  );
}

if (!containsSecureStatus) {
  throw new Error(
    "Prompt에 SECURE_INPUT_REQUIRED 규칙이 포함되지 않았습니다.",
  );
}

console.log();
console.log(
  "SECURE_INPUT Prompt SUCCESS",
);

/*
 * 3. 정상 SECURE_INPUT 응답 검증
 */
const validSecureResponse:
  StructuredAIResponse = {
  requestId:
    "req-secure-valid",

  status:
    "SECURE_INPUT_REQUIRED",

  action:
    "PAUSE_FOR_SECURE_INPUT",

  targetElementId:
    null,

  inputValue:
    null,

  message:
    "OTP 인증번호를 직접 입력해주세요.",

  confidence:
    1,

  requiresUserAction:
    true,

  decisionType:
    null,

  secureInputType:
    "OTP",

  riskType:
    null,

  options:
    null,

  confirmationId:
    null,

  summary:
    null,
};

const validResult =
  validateStructuredAIResponse(
    validSecureResponse,
  );

console.log();
console.log(
  "========================================",
);

console.log(
  "D22 SECURE_INPUT Validator - Valid",
);

console.log(
  "========================================",
);

console.log(
  `[검증 결과] ${validResult.valid}`,
);

if (!validResult.valid) {
  throw new Error(
    `정상 SECURE_INPUT 응답이 거부되었습니다: ${validResult.errors.join(", ")}`,
  );
}

console.log();
console.log(
  "Valid SECURE_INPUT Response SUCCESS",
);

/*
 * 4. 잘못된 민감값 포함 응답 검증
 *
 * 모델이 실수로 OTP 값을 반환했다고 가정합니다.
 */
const invalidSecureResponse = {
  ...validSecureResponse,

  requestId:
    "req-secure-invalid",

  targetElementId:
    "el-secure-otp",

  inputValue:
    "123456",
};

const invalidResult =
  validateStructuredAIResponse(
    invalidSecureResponse,
  );

console.log();
console.log(
  "========================================",
);

console.log(
  "D22 SECURE_INPUT Validator - Invalid",
);

console.log(
  "========================================",
);

console.log(
  `[검증 결과] ${invalidResult.valid}`,
);

console.log(
  `[오류] ${invalidResult.errors.join(" | ")}`,
);

if (invalidResult.valid) {
  throw new Error(
    "민감 입력값이 포함된 잘못된 SECURE_INPUT 응답이 허용되었습니다.",
  );
}

console.log();
console.log(
  "Invalid SECURE_INPUT Response BLOCKED",
);

console.log();
console.log(
  "D22 SECURE_INPUT Prompt / Validator Test SUCCESS",
);
