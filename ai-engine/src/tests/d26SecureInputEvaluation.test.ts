import assert from "node:assert/strict";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import test from "node:test";

import express from "express";

import {
  createAiActionRouter,
} from "../api/aiAction.route.js";
import {
  adaptBackendRequestToAiActionRequest,
} from "../api/aiDecisionRequest.adapter.js";
import {
  adaptStructuredResponseToBackend,
} from "../api/aiDecisionResponse.adapter.js";
import type {
  AiActionRequest,
  BackendSanitizedDomElement,
  BackendSanitizedDomSnapshot,
} from "../api/aiRequest.types.js";
import {
  resumeAgentLoopAfterSecureInput,
  runAgentLoop,
} from "../agent/agentLoop.runner.js";
import {
  adaptBackendDomToModelInput,
} from "../api/domRequest.adapter.js";
import type {
  StructuredAIResponse,
} from "../output/aiResponse.types.js";
import {
  createNextActionPrompt,
} from "../prompts/nextActionPrompt.js";
import {
  createSecureInputPauseForRequest,
  enforceSecureInputPolicy,
} from "../secureInput/secureInput.policy.js";
import {
  generateStructuredAction,
} from "../services/structuredAction.service.js";

const SYNTHETIC_SECURE_PLACEHOLDER =
  "SYNTHETIC_SECURE_VALUE_DO_NOT_FORWARD";

const RESPONSE_FIELDS = [
  "actionType",
  "elementId",
  "value",
  "scrollX",
  "scrollY",
  "waitMillis",
  "status",
  "message",
  "requiresUserAction",
  "executionBlocked",
  "decisionType",
  "sourceSnapshotId",
  "options",
  "terms",
  "confirmationType",
  "confirmationTargetElementId",
];

function element(
  elementId: string,
  label: string,
  overrides: Partial<BackendSanitizedDomElement> = {},
): BackendSanitizedDomElement {
  return {
    elementId,
    tag: "input",
    role: "textbox",
    text: null,
    ariaLabel: label,
    placeholder: label,
    inputType: "password",
    visible: true,
    enabled: true,
    checked: null,
    boundingBox: null,
    securityPolicy: "SECURE_INPUT",
    ...overrides,
  };
}

function snapshot(
  snapshotId: string,
  elements: BackendSanitizedDomElement[],
  path = "/secure",
): BackendSanitizedDomSnapshot {
  return {
    schemaVersion: "1.0",
    snapshotId,
    page: {
      url: `https://demo.test${path}`,
      title: "보안 입력",
      productId: null,
      productName: null,
      productPeriod: null,
    },
    elements,
  };
}

function secureElement(
  type:
    | "ACCOUNT_PASSWORD"
    | "OTP"
    | "CERTIFICATE_PASSWORD",
): BackendSanitizedDomElement {
  if (type === "OTP") {
    return element("el-secure-otp", "OTP 인증번호", {
      inputType: "text",
    });
  }

  if (type === "CERTIFICATE_PASSWORD") {
    return element(
      "el-secure-certificate",
      "공동인증서 비밀번호",
    );
  }

  return element(
    "el-secure-account-password",
    "계좌 비밀번호",
  );
}

function normalButton(
  elementId = "el-safe-next",
): BackendSanitizedDomElement {
  return element(elementId, "다음 단계", {
    tag: "button",
    role: "button",
    inputType: null,
    securityPolicy: "NORMAL",
  });
}

function request(
  domSnapshot: BackendSanitizedDomSnapshot,
): AiActionRequest {
  return {
    requestId: `req-${domSnapshot.snapshotId}`,
    userGoal: {
      rawMessage: "금융 절차를 안전하게 진행해 주세요.",
      intent: "TRANSFER",
      conditions: [],
    },
    domSnapshot,
  };
}

function response(
  overrides: Partial<StructuredAIResponse> = {},
): StructuredAIResponse {
  return {
    requestId: "untrusted-model-request",
    status: "AI_EXECUTING",
    action: "NONE",
    targetElementId: null,
    inputValue: null,
    message: "다음 단계를 확인합니다.",
    confidence: 1,
    requiresUserAction: false,
    decisionType: null,
    secureInputType: null,
    riskType: null,
    options: null,
    confirmationId: null,
    summary: null,
    ...overrides,
  };
}

function secureRequest(
  type:
    | "ACCOUNT_PASSWORD"
    | "OTP"
    | "CERTIFICATE_PASSWORD",
): AiActionRequest {
  return request(
    snapshot(`snap-${type.toLowerCase()}`, [
      secureElement(type),
    ]),
  );
}

function requirePause(
  value: StructuredAIResponse | null,
  expectedType:
    | "ACCOUNT_PASSWORD"
    | "OTP"
    | "CERTIFICATE_PASSWORD",
): StructuredAIResponse {
  assert.ok(value);
  assert.equal(value.status, "SECURE_INPUT_REQUIRED");
  assert.equal(value.action, "PAUSE_FOR_SECURE_INPUT");
  assert.equal(value.targetElementId, null);
  assert.equal(value.inputValue, null);
  assert.equal(value.requiresUserAction, true);
  assert.equal(value.secureInputType, expectedType);
  assert.equal(value.decisionType, null);
  assert.equal(value.riskType, null);
  assert.equal(value.options, null);
  assert.equal(value.confirmationId, null);
  assert.equal(value.summary, null);
  return value;
}

async function modelCandidate(
  input: AiActionRequest,
  candidate: StructuredAIResponse,
): Promise<StructuredAIResponse> {
  return generateStructuredAction(
    input,
    async () => ({
      model: "offline-d26",
      source: "GEMINI",
      text: JSON.stringify(candidate),
    }),
  );
}

function backendBody(
  domSnapshot: BackendSanitizedDomSnapshot,
): Record<string, unknown> {
  return {
    userRequest: "금융 절차를 안전하게 진행해 주세요.",
    snapshot: domSnapshot,
  };
}

async function withProductionRoute(
  generator: Parameters<typeof createAiActionRouter>[0],
  run: (endpoint: string) => Promise<void>,
): Promise<void> {
  const app = express();
  app.use(express.json());
  app.use("/api/ai", createAiActionRouter(generator));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const address = server.address() as AddressInfo;
    await run(
      `http://127.0.0.1:${address.port}/api/ai/action`,
    );
  } finally {
    server.close();
    await once(server, "close");
  }
}

async function postJson(
  endpoint: string,
  body: unknown,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const result = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return {
    status: result.status,
    body: await result.json() as Record<string, unknown>,
  };
}

test("D26-01 ACCOUNT_PASSWORD field returns a canonical secure pause", () => {
  requirePause(
    createSecureInputPauseForRequest(
      secureRequest("ACCOUNT_PASSWORD"),
    ),
    "ACCOUNT_PASSWORD",
  );
});

test("D26-02 ACCOUNT_PASSWORD blocks a model-authored TYPE", () => {
  const input = secureRequest("ACCOUNT_PASSWORD");
  const checked = enforceSecureInputPolicy(
    response({
      action: "TYPE",
      targetElementId: "el-secure-account-password",
      inputValue: SYNTHETIC_SECURE_PLACEHOLDER,
    }),
    input,
  );
  requirePause(checked, "ACCOUNT_PASSWORD");
});

test("D26-03 ACCOUNT_PASSWORD discards every model-authored value", () => {
  const checked = enforceSecureInputPolicy(
    response({ inputValue: SYNTHETIC_SECURE_PLACEHOLDER }),
    secureRequest("ACCOUNT_PASSWORD"),
  );
  assert.equal(checked.inputValue, null);
  assert.doesNotMatch(
    JSON.stringify(checked),
    new RegExp(SYNTHETIC_SECURE_PLACEHOLDER),
  );
});

test("D26-04 ACCOUNT_PASSWORD guidance contains no execution target", () => {
  const pause = requirePause(
    createSecureInputPauseForRequest(
      secureRequest("ACCOUNT_PASSWORD"),
    ),
    "ACCOUNT_PASSWORD",
  );
  assert.equal(
    pause.message,
    "비밀번호는 금융 화면에 직접 입력해 주세요.",
  );
  assert.doesNotMatch(pause.message, /elementId|selector|성공|완료/i);
});

test("D26-05 ACCOUNT_PASSWORD wire matches the Backend 16-field DTO", () => {
  const input = secureRequest("ACCOUNT_PASSWORD");
  const pause = requirePause(
    createSecureInputPauseForRequest(input),
    "ACCOUNT_PASSWORD",
  );
  const wire = adaptStructuredResponseToBackend(
    pause,
    input.domSnapshot.snapshotId,
  );
  assert.deepEqual(Object.keys(wire), RESPONSE_FIELDS);
  assert.deepEqual(wire, {
    actionType: "PAUSE_FOR_SECURE_INPUT",
    elementId: null,
    value: null,
    scrollX: null,
    scrollY: null,
    waitMillis: null,
    status: "SECURE_INPUT_REQUIRED",
    message: "비밀번호는 금융 화면에 직접 입력해 주세요.",
    requiresUserAction: true,
    executionBlocked: true,
    decisionType: null,
    sourceSnapshotId: null,
    options: [],
    terms: [],
    confirmationType: null,
    confirmationTargetElementId: null,
  });
});

test("D26-06 OTP field returns a canonical secure pause", () => {
  requirePause(
    createSecureInputPauseForRequest(secureRequest("OTP")),
    "OTP",
  );
});

test("D26-07 OTP blocks a model-authored TYPE", () => {
  const checked = enforceSecureInputPolicy(
    response({
      action: "TYPE",
      targetElementId: "el-secure-otp",
      inputValue: SYNTHETIC_SECURE_PLACEHOLDER,
    }),
    secureRequest("OTP"),
  );
  requirePause(checked, "OTP");
});

test("D26-08 OTP never generates or preserves numeric input", () => {
  const pause = requirePause(
    createSecureInputPauseForRequest(secureRequest("OTP")),
    "OTP",
  );
  assert.equal(pause.inputValue, null);
  assert.doesNotMatch(JSON.stringify(pause), /[0-9]{4,8}/);
});

test("D26-09 OTP bypasses the model before prompt generation", async () => {
  let modelCalls = 0;
  const result = await generateStructuredAction(
    secureRequest("OTP"),
    async () => {
      modelCalls++;
      throw new Error("model must not be called");
    },
  );
  requirePause(result, "OTP");
  assert.equal(modelCalls, 0);
});

test("D26-10 OTP guidance is safe and does not claim verification", () => {
  const pause = requirePause(
    createSecureInputPauseForRequest(secureRequest("OTP")),
    "OTP",
  );
  assert.equal(
    pause.message,
    "인증번호는 금융 화면에 직접 입력해 주세요.",
  );
  assert.doesNotMatch(pause.message, /인증 성공|검증 성공|완료/);
});

test("D26-11 CERTIFICATE_PASSWORD field returns a canonical secure pause", () => {
  requirePause(
    createSecureInputPauseForRequest(
      secureRequest("CERTIFICATE_PASSWORD"),
    ),
    "CERTIFICATE_PASSWORD",
  );
});

test("D26-12 CERTIFICATE_PASSWORD blocks a model-authored TYPE", () => {
  const checked = enforceSecureInputPolicy(
    response({
      action: "TYPE",
      targetElementId: "el-secure-certificate",
      inputValue: SYNTHETIC_SECURE_PLACEHOLDER,
    }),
    secureRequest("CERTIFICATE_PASSWORD"),
  );
  requirePause(checked, "CERTIFICATE_PASSWORD");
});

test("D26-13 CERTIFICATE_PASSWORD never supplies a default value", () => {
  const pause = requirePause(
    createSecureInputPauseForRequest(
      secureRequest("CERTIFICATE_PASSWORD"),
    ),
    "CERTIFICATE_PASSWORD",
  );
  assert.equal(pause.inputValue, null);
  assert.equal(pause.targetElementId, null);
});

test("D26-14 prompt names only Backend secure types and requests no raw value", () => {
  const input = secureRequest("CERTIFICATE_PASSWORD");
  const prompt = createNextActionPrompt(
    input.requestId,
    input.userGoal,
    adaptBackendDomToModelInput(input.domSnapshot),
  );
  assert.match(
    prompt,
    /ACCOUNT_PASSWORD.*,.*OTP.*,.*CERTIFICATE_PASSWORD/,
  );
  assert.doesNotMatch(
    prompt,
    new RegExp(SYNTHETIC_SECURE_PLACEHOLDER),
  );
  assert.match(prompt, /값을 생성하거나 입력하지 마십시오/);
});

test("D26-15 CERTIFICATE_PASSWORD guidance is sanitized and static", () => {
  const pause = requirePause(
    createSecureInputPauseForRequest(
      secureRequest("CERTIFICATE_PASSWORD"),
    ),
    "CERTIFICATE_PASSWORD",
  );
  assert.equal(
    pause.message,
    "인증서 비밀번호는 금융 화면에 직접 입력해 주세요.",
  );
});

test("D26-16 secure completion cannot be inferred before Backend resume", async () => {
  let executions = 0;
  const paused = await runAgentLoop(
    request(secureRequest("OTP").domSnapshot).userGoal,
    secureRequest("OTP").domSnapshot,
    {
      decide: async (input) =>
        createSecureInputPauseForRequest(input)!,
      execute: async () => { executions++; },
      getNextSnapshot: async () =>
        snapshot("snap-unreachable", []),
      createRequestId: (step) => `req-pause-${step}`,
    },
  );
  assert.equal(paused.status, "WAITING_FOR_SECURE_INPUT");
  assert.equal(executions, 0);
});

test("D26-17 secure screen blocks model CLICK", () => {
  const checked = enforceSecureInputPolicy(
    response({
      action: "CLICK",
      targetElementId: "el-secure-otp",
    }),
    secureRequest("OTP"),
  );
  assert.equal(checked.action, "PAUSE_FOR_SECURE_INPUT");
  assert.equal(checked.targetElementId, null);
});

test("D26-18 secure policy overrides final-confirmation model signals", () => {
  const checked = enforceSecureInputPolicy(
    response({
      status: "FINAL_CONFIRMATION_REQUIRED",
      action: "REQUEST_FINAL_CONFIRMATION",
      requiresUserAction: true,
      confirmationId: "synthetic-confirmation-id",
      summary: { synthetic: true },
    }),
    secureRequest("ACCOUNT_PASSWORD"),
  );
  requirePause(checked, "ACCOUNT_PASSWORD");
});

test("D26-19 secure policy keeps risk candidates non-executable", () => {
  const checked = enforceSecureInputPolicy(
    response({
      status: "RISK_WARNING",
      action: "TYPE",
      targetElementId: "el-secure-otp",
      inputValue: SYNTHETIC_SECURE_PLACEHOLDER,
      requiresUserAction: true,
      riskType: "SYNTHETIC_RISK",
    }),
    secureRequest("OTP"),
  );
  requirePause(checked, "OTP");
});

test("D26-20 secure screen remains paused when Gemini would fail", async () => {
  let modelCalls = 0;
  const result = await generateStructuredAction(
    secureRequest("CERTIFICATE_PASSWORD"),
    async () => {
      modelCalls++;
      return {
        model: "offline-d26",
        source: "FALLBACK",
        text: "",
      };
    },
  );
  requirePause(result, "CERTIFICATE_PASSWORD");
  assert.equal(modelCalls, 0);
});

async function createPausedOtpResult() {
  const secure = secureRequest("OTP");
  return runAgentLoop(
    secure.userGoal,
    secure.domSnapshot,
    {
      decide: async (input) =>
        createSecureInputPauseForRequest(input)!,
      execute: async () => {
        throw new Error("secure action must not execute");
      },
      getNextSnapshot: async () => {
        throw new Error("secure snapshot must not advance in C");
      },
      createRequestId: (step) => `req-secure-${step}`,
    },
  );
}

const completedInternalResponse = response({
  requestId: "req-internal-complete",
  status: "COMPLETED",
  action: "NONE",
  message: "내부 평가가 종료되었습니다.",
});

test("D26-21 secure resume processes only a new safe snapshot", async () => {
  const paused = await createPausedOtpResult();
  const safe = snapshot(
    "snap-safe-resume",
    [],
    "/transfer/review",
  );
  const resumed = await resumeAgentLoopAfterSecureInput(
    request(safe).userGoal,
    paused,
    safe,
    {
      decide: async () => completedInternalResponse,
      execute: async () => {
        throw new Error("internal completion must not execute");
      },
      getNextSnapshot: async () => {
        throw new Error("internal completion must not advance");
      },
      createRequestId: (step) => `req-resume-${step}`,
    },
  );
  assert.equal(resumed.status, "COMPLETED");
  assert.equal(resumed.finalSnapshot.snapshotId, "snap-safe-resume");
});

test("D26-22 resumed C request contains no secure channel context", async () => {
  const paused = await createPausedOtpResult();
  const safe = snapshot("snap-safe-context", []);
  let observedKeys: string[] = [];
  await resumeAgentLoopAfterSecureInput(
    request(safe).userGoal,
    paused,
    safe,
    {
      decide: async (input) => {
        observedKeys = Object.keys(input).sort();
        assert.doesNotMatch(
          JSON.stringify(input),
          /secureRequestId|expectedFrameId|expectedSequence|secureValue/,
        );
        return completedInternalResponse;
      },
      execute: async () => {},
      getNextSnapshot: async () => safe,
      createRequestId: (step) => `req-context-${step}`,
    },
  );
  assert.deepEqual(
    observedKeys,
    ["domSnapshot", "requestId", "userGoal"],
  );
});

test("D26-23 removed secure target cannot be reused on a safe snapshot", async () => {
  const safeRequest = request(
    snapshot("snap-safe-target", [normalButton()]),
  );
  const result = await modelCandidate(
    safeRequest,
    response({
      action: "CLICK",
      targetElementId: "el-secure-otp",
    }),
  );
  assert.equal(result.status, "ERROR");
  assert.equal(result.action, "NONE");
});

test("D26-24 duplicate safe resume is deterministic", async () => {
  const paused = await createPausedOtpResult();
  const safe = snapshot("snap-safe-duplicate", []);
  const resume = () => resumeAgentLoopAfterSecureInput(
    request(safe).userGoal,
    paused,
    safe,
    {
      decide: async () => completedInternalResponse,
      execute: async () => {},
      getNextSnapshot: async () => safe,
      createRequestId: (step) => `req-duplicate-${step}`,
    },
  );
  const first = await resume();
  const second = await resume();
  assert.equal(first.status, second.status);
  assert.equal(
    first.finalSnapshot.snapshotId,
    second.finalSnapshot.snapshotId,
  );
});

test("D26-25 secure resume remains stateless in C", async () => {
  const source = await readFile(
    new URL("../agent/agentLoop.runner.ts", import.meta.url),
    "utf8",
  );
  const functionBody = source.slice(
    source.indexOf("export async function resumeAgentLoopAfterSecureInput"),
  );
  assert.doesNotMatch(
    functionBody,
    /UserDecisionContextStore|SecureInputRegistry|secureRequestId/,
  );
});

test("D26-26 resume rejects the previous secure snapshot ID", async () => {
  const paused = await createPausedOtpResult();
  await assert.rejects(
    resumeAgentLoopAfterSecureInput(
      request(paused.finalSnapshot).userGoal,
      paused,
      paused.finalSnapshot,
      {
        decide: async () => completedInternalResponse,
        execute: async () => {},
        getNextSnapshot: async () => paused.finalSnapshot,
        createRequestId: (step) => `req-stale-${step}`,
      },
    ),
    /clean SECURE_INPUT pause/,
  );
});

test("D26-27 resume rejects a new snapshot that still exposes secure input", async () => {
  const paused = await createPausedOtpResult();
  const stillSecure = snapshot(
    "snap-new-but-still-secure",
    [secureElement("OTP")],
  );
  await assert.rejects(
    resumeAgentLoopAfterSecureInput(
      request(stillSecure).userGoal,
      paused,
      stillSecure,
      {
        decide: async () => completedInternalResponse,
        execute: async () => {},
        getNextSnapshot: async () => stillSecure,
        createRequestId: (step) => `req-still-secure-${step}`,
      },
    ),
    /clean SECURE_INPUT pause/,
  );
});

test("D26-28 C rejects Backend-owned frame metadata on the AI request", () => {
  const body = {
    ...backendBody(snapshot("snap-frame-contract", [])),
    frameId: "frm-stale",
    frameSequence: 1,
  };
  assert.throws(
    () => adaptBackendRequestToAiActionRequest(body),
    /unknown request field: frameId/,
  );
});

test("D26-29 model cannot invent a secure transition on a safe snapshot", async () => {
  const safe = request(snapshot("snap-no-secure", []));
  const result = await modelCandidate(
    safe,
    response({
      status: "SECURE_INPUT_REQUIRED",
      action: "PAUSE_FOR_SECURE_INPUT",
      requiresUserAction: true,
      secureInputType: "OTP",
    }),
  );
  assert.equal(result.status, "ERROR");
  assert.equal(result.action, "NONE");
});

test("D26-30 malformed secure pause payload stops the internal loop", async () => {
  let executions = 0;
  const malformed = response({
    status: "SECURE_INPUT_REQUIRED",
    action: "PAUSE_FOR_SECURE_INPUT",
    targetElementId: null,
    inputValue: SYNTHETIC_SECURE_PLACEHOLDER,
    requiresUserAction: true,
    secureInputType: "OTP",
  });
  const result = await runAgentLoop(
    request(snapshot("snap-malformed", [])).userGoal,
    snapshot("snap-malformed", []),
    {
      decide: async () => malformed,
      execute: async () => { executions++; },
      getNextSnapshot: async () => snapshot("snap-never", []),
      createRequestId: (step) => `req-malformed-${step}`,
    },
  );
  assert.equal(result.status, "ERROR");
  assert.equal(executions, 0);
});

test("D26-31 request validator rejects a raw secure value field", () => {
  const secure = secureRequest("ACCOUNT_PASSWORD").domSnapshot;
  const unsafeElement = {
    ...secure.elements[0],
    value: SYNTHETIC_SECURE_PLACEHOLDER,
  };
  assert.throws(
    () => adaptBackendRequestToAiActionRequest(
      backendBody({ ...secure, elements: [unsafeElement] } as BackendSanitizedDomSnapshot),
    ),
    /unknown snapshot\.elements\[0\] field: value/,
  );
});

for (const [number, type] of [
  [32, "ACCOUNT_PASSWORD"],
  [33, "OTP"],
  [34, "CERTIFICATE_PASSWORD"],
] as const) {
  test(`D26-${number} POST /api/ai/action returns blocked ${type}`, async () => {
    let modelCalls = 0;
    await withProductionRoute(
      (input) => generateStructuredAction(
        input,
        async () => {
          modelCalls++;
          throw new Error("secure route must bypass model");
        },
      ),
      async (endpoint) => {
        const result = await postJson(
          endpoint,
          backendBody(secureRequest(type).domSnapshot),
        );
        assert.equal(result.status, 200);
        assert.deepEqual(
          Object.keys(result.body),
          RESPONSE_FIELDS,
        );
        assert.equal(
          result.body.actionType,
          "PAUSE_FOR_SECURE_INPUT",
        );
        assert.equal(
          result.body.status,
          "SECURE_INPUT_REQUIRED",
        );
        assert.equal(result.body.elementId, null);
        assert.equal(result.body.value, null);
        assert.equal(result.body.requiresUserAction, true);
        assert.equal(result.body.executionBlocked, true);
        assert.equal(result.body.decisionType, null);
        assert.equal(result.body.sourceSnapshotId, null);
        assert.deepEqual(result.body.options, []);
        assert.deepEqual(result.body.terms, []);
      },
    );
    assert.equal(modelCalls, 0);
  });
}

test("D26-35 POST stale secure snapshot cannot produce a next action", async () => {
  await withProductionRoute(
    (input) => generateStructuredAction(
      input,
      async () => {
        throw new Error("stale secure snapshot must bypass model");
      },
    ),
    async (endpoint) => {
      const result = await postJson(
        endpoint,
        backendBody(secureRequest("OTP").domSnapshot),
      );
      assert.equal(result.status, 200);
      assert.equal(
        result.body.actionType,
        "PAUSE_FOR_SECURE_INPUT",
      );
      assert.equal(result.body.executionBlocked, true);
    },
  );
});

test("D26-36 POST valid safe resume uses only the current snapshot target", async () => {
  const safe = snapshot(
    "snap-safe-http",
    [normalButton("el-safe-current")],
    "/transfer/review",
  );
  await withProductionRoute(
    (input) => modelCandidate(
      input,
      response({
        action: "CLICK",
        targetElementId: "el-safe-current",
      }),
    ),
    async (endpoint) => {
      const result = await postJson(
        endpoint,
        backendBody(safe),
      );
      assert.equal(result.status, 200);
      assert.equal(result.body.actionType, "CLICK");
      assert.equal(result.body.elementId, "el-safe-current");
      assert.equal(result.body.value, null);
    },
  );
});

test("D26-37 Production error logging contains no raw model response", async () => {
  const serviceSource = await readFile(
    new URL("../services/structuredAction.service.ts", import.meta.url),
    "utf8",
  );
  const routeSource = await readFile(
    new URL("../api/aiAction.route.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(serviceSource, /console\.(?:log|error)\([^)]*result\.text/s);
  assert.doesNotMatch(routeSource, /console\.(?:log|error)\([^)]*req\.body/s);
  assert.doesNotMatch(
    `${serviceSource}\n${routeSource}`,
    /raw reasoning|prompt dump/i,
  );
});
