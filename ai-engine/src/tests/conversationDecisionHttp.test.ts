import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { createServer } from "../api/server.js";

function request(content = "100만원으로 예금 가입해줘") {
  return {
    sessionId: "session-1", requestId: "request-1", requestMessageId: "message-1",
    conversationSequence: 1,
    goal: {
      goalId: "goal-1", revision: 0, status: "ACTIVE", intent: "UNKNOWN",
      normalizedRequest: content, amount: null, duration: null, missingFields: [],
      pendingQuestion: null, stage: "INFORMATION_COLLECTION",
      safety: { secureInputActive: false, riskState: "NONE", confirmationState: "NONE" },
      lastAppliedMessageId: null,
    },
    userMessage: { content, answerToQuestionId: null }, snapshot: null,
  };
}

async function withServer(run: (url: string) => Promise<void>) {
  const server = createServer().listen(0);
  await once(server, "listening");
  try {
    const port = (server.address() as AddressInfo).port;
    await run(`http://127.0.0.1:${port}/api/ai/conversation/decision`);
  } finally { server.close(); await once(server, "close"); }
}

test("conversation endpoint returns a validated scripted ASK_USER over real HTTP", async () => {
  await withServer(async (url) => {
    const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request()) });
    assert.equal(response.status, 200);
    const body = await response.json() as Record<string, unknown>;
    assert.equal(body.mode, "ASK_USER");
    assert.equal(body.message, "가입 기간은 얼마로 할까요?");
    assert.equal(body.actionCandidate, null);
  });
});

test("conversation endpoint rejects strict and sensitive requests without echo", async () => {
  await withServer(async (url) => {
    const invalid = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...request(), selector: "#raw" }) });
    assert.equal(invalid.status, 400);
    const secret = "OTP 123456";
    const sensitive = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request(secret)) });
    assert.equal(sensitive.status, 400);
    assert.equal((await sensitive.text()).includes("123456"), false);
  });
});
