import assert from "node:assert/strict";
import test from "node:test";

import { ScriptedConversationModel } from "../conversation/scriptedConversation.model.js";
import { createConversationPrompt } from "../conversation/conversationPrompt.builder.js";
import { validateConversationInteractionDecision } from "../conversation/conversationInteraction.policy.js";
import { validateAgentDecision } from "../conversation/conversationAgent.validator.js";
import type { ConversationAgentRequest } from "../conversation/conversationAgent.types.js";
import {
  C_D2_DEPOSIT_FIXTURES,
  conversationElement,
  conversationRequest,
  conversationSnapshot,
} from "./fixtures/cD2Deposit.fixtures.js";

const model = new ScriptedConversationModel();

function depositEntry(elements = [] as ReturnType<typeof conversationElement>[]) {
  const request = conversationRequest(conversationSnapshot("nav-deposit-entry", elements));
  request.goal = { ...request.goal, stage: "DEPOSIT_ENTRY" };
  return request;
}

function transferEntry() {
  const request = conversationRequest(conversationSnapshot("nav-transfer-entry", []));
  request.goal = {
    ...request.goal,
    intent: "TRANSFER",
    normalizedRequest: "내 계좌로 이체해줘",
    amount: null,
    duration: null,
    stage: "TRANSFER_ENTRY",
  };
  return request;
}

const safeButton = conversationElement("el-safe-menu", "예금 메뉴");

const fixtures: ReadonlyArray<{
  title: string;
  input: () => ConversationAgentRequest;
  mode: string;
  route?: string;
}> = [
  { title: "C-NAV-01 deposit entry proposes semantic navigation", input: () => depositEntry(), mode: "NAVIGATION_REQUIRED", route: "DEPOSIT_PRODUCTS" },
  { title: "C-NAV-02 transfer entry proposes its minimal semantic fixture", input: transferEntry, mode: "NAVIGATION_REQUIRED", route: "TRANSFER_ACCOUNTS" },
  { title: "C-NAV-03 navigation remains deterministic on retry", input: () => depositEntry(), mode: "NAVIGATION_REQUIRED", route: "DEPOSIT_PRODUCTS" },
  { title: "C-NAV-04 navigation outranks a generic safe action at explicit entry", input: () => depositEntry([safeButton]), mode: "NAVIGATION_REQUIRED", route: "DEPOSIT_PRODUCTS" },
  { title: "C-NAV-05 stale snapshot stops before navigation", input: () => {
    const value = depositEntry();
    value.snapshot = { ...value.snapshot!, sourceSnapshotId: "newer-source" };
    return value;
  }, mode: "STOP" },
  { title: "C-NAV-06 secure input outranks navigation", input: () => depositEntry([conversationElement("el-secret", "보안 입력", { tag: "input", role: "textbox", inputType: "password", securityPolicy: "SECURE_INPUT" })]), mode: "SECURE_INPUT_REQUIRED" },
  { title: "C-NAV-07 risk warning outranks navigation", input: () => {
    const value = depositEntry();
    value.goal = { ...value.goal, safety: { ...value.goal.safety, riskState: "WARNING" } };
    return value;
  }, mode: "RISK_WARNING" },
  { title: "C-NAV-08 final confirmation outranks navigation", input: () => {
    const value = structuredClone(C_D2_DEPOSIT_FIXTURES.find((item) => item.id === "10")!.request);
    value.goal = { ...value.goal, stage: "DEPOSIT_ENTRY" };
    return value;
  }, mode: "FINAL_CONFIRMATION_REQUIRED" },
  { title: "C-NAV-09 destination product list becomes GUIDE_USER", input: () => {
    const value = structuredClone(C_D2_DEPOSIT_FIXTURES.find((item) => item.id === "04")!.request);
    value.goal = { ...value.goal, stage: "DEPOSIT_ENTRY" };
    return value;
  }, mode: "GUIDE_USER" },
  { title: "C-NAV-10 ordinary safe DOM policy remains AUTO_EXECUTE", input: () => structuredClone(C_D2_DEPOSIT_FIXTURES.find((item) => item.id === "03")!.request), mode: "AUTO_EXECUTE" },
  { title: "C-NAV-11 ordinary unsupported DOM remains STOP", input: () => conversationRequest(conversationSnapshot("ordinary-empty", [])), mode: "STOP" },
  { title: "C-NAV-12 non-navigation GUIDE result has null navigationCandidate", input: () => structuredClone(C_D2_DEPOSIT_FIXTURES.find((item) => item.id === "04")!.request), mode: "GUIDE_USER" },
];

for (const fixture of fixtures) {
  test(fixture.title, async () => {
    const input = fixture.input();
    const first = await model.decide(input);
    const second = await model.decide(structuredClone(input));
    assert.equal(first.mode, fixture.mode);
    assert.equal(validateConversationInteractionDecision(input, first).valid, true);
    assert.deepEqual(first, second);
    if (fixture.route) {
      assert.equal(first.sourceSnapshotId, input.snapshot!.sourceSnapshotId);
      assert.equal(first.actionCandidate, null);
      assert.equal(first.navigationCandidate?.semanticRoute, fixture.route);
      assert.equal(first.navigationCandidate?.navigationMode, "SPA_PUSH");
      assert.match(first.navigationCandidate!.decisionId, /^navdec_[a-f0-9]{64}$/u);
      assert.deepEqual(Object.keys(first.navigationCandidate!).sort(), ["decisionId", "navigationMode", "semanticRoute"]);
    } else {
      assert.equal(first.navigationCandidate, null);
    }
  });
}

test("C-NAV-13 navigationCandidate rejects a raw URL field", async () => {
  const input = depositEntry();
  const decision = await model.decide(input);
  assert.equal(validateAgentDecision({
    ...decision,
    navigationCandidate: { ...decision.navigationCandidate!, url: "https://untrusted.test" },
  }).valid, false);
});

test("C-NAV-14 navigationCandidate rejects raw selector and XPath fields", async () => {
  const input = depositEntry();
  const decision = await model.decide(input);
  for (const extra of [{ selector: "#menu" }, { XPath: "//button" }]) {
    assert.equal(validateAgentDecision({
      ...decision,
      navigationCandidate: { ...decision.navigationCandidate!, ...extra },
    }).valid, false);
  }
});

test("C-NAV-15 blocked DOM stops before semantic navigation", async () => {
  const input = depositEntry([
    conversationElement("el-blocked", "차단된 작업", { securityPolicy: "BLOCKED" }),
  ]);
  const decision = await model.decide(input);
  assert.equal(decision.mode, "STOP");
  assert.equal(decision.reasonCode, "BLOCKED_TARGET");
  assert.equal(decision.navigationCandidate, null);
});

test("C-NAV-16 prompt names semantic authority and latest-snapshot restrictions", () => {
  const prompt = createConversationPrompt(depositEntry());
  for (const rule of [
    "NAVIGATION_REQUIRED",
    "DEPOSIT_PRODUCTS",
    "TRANSFER_ACCOUNTS",
    "actionCandidate to null",
    "Never infer a semantic route",
    "Backend owns route mapping",
    "use only the latest destination snapshot",
  ]) {
    assert.match(prompt, new RegExp(rule, "u"));
  }
  assert.equal(prompt.includes("/deposit/products"), false);
  assert.equal(prompt.includes("/transfer/accounts"), false);
});
