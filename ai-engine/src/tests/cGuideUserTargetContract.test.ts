import assert from "node:assert/strict";
import test from "node:test";

import type { AgentDecision, ConversationAgentRequest } from "../conversation/conversationAgent.types.js";
import {
  decideConversationInteraction,
  validateConversationInteractionDecision,
} from "../conversation/conversationInteraction.policy.js";
import { ScriptedConversationModel } from "../conversation/scriptedConversation.model.js";
import {
  C_D2_DEPOSIT_FIXTURES,
  conversationElement,
} from "./fixtures/cD2Deposit.fixtures.js";

function request(id: string): ConversationAgentRequest {
  const fixture = C_D2_DEPOSIT_FIXTURES.find((candidate) => candidate.id === id);
  if (!fixture) throw new Error(`Missing Day2 fixture ${id}`);
  return structuredClone(fixture.request);
}

async function decision(id: string): Promise<{ input: ConversationAgentRequest; output: AgentDecision }> {
  const input = request(id);
  const output = await new ScriptedConversationModel().decide(input);
  return { input, output };
}

function assertInternalOnly(output: AgentDecision): void {
  const serialized = JSON.stringify(output);
  assert.doesNotMatch(serialized, /(?:targetId|rectangle|viewport|expiresAt|observationId|selector|xpath|innerHTML|outerHTML)/iu);
}

test("C-GUIDE-01 product GUIDE_USER carries the current sanitized target reference", async () => {
  const { input, output } = await decision("04");
  assert.equal(output.mode, "GUIDE_USER");
  assert.equal(output.sourceSnapshotId, input.snapshot?.sourceSnapshotId);
  assert.deepEqual(output.actionCandidate, {
    actionType: "WAIT_FOR_USER",
    targetElementId: "el-product-12m",
    role: "button",
    accessibleLabel: "12개월 정기예금 선택",
    guide: "가입할 예금 상품을 직접 선택해 주세요.",
  });
  assert.equal("sourceSnapshotId" in output.actionCandidate!, false);
  assertInternalOnly(output);
});

test("C-GUIDE-02 terms GUIDE_USER carries a checkbox reference without consent", async () => {
  const { input, output } = await decision("07");
  assert.equal(output.mode, "GUIDE_USER");
  assert.equal(output.sourceSnapshotId, input.snapshot?.sourceSnapshotId);
  assert.deepEqual(output.actionCandidate, {
    actionType: "WAIT_FOR_USER",
    targetElementId: "el-required-term",
    role: "checkbox",
    accessibleLabel: "[필수] 예금 약관 동의",
    guide: "필수 약관과 선택 약관을 직접 선택해 주세요.",
  });
  assertInternalOnly(output);
});

test("C-GUIDE-03 safe AUTO_EXECUTE carries one NORMAL current target", async () => {
  const { input, output } = await decision("03");
  assert.equal(output.mode, "AUTO_EXECUTE");
  assert.equal(output.sourceSnapshotId, input.snapshot?.sourceSnapshotId);
  assert.deepEqual(output.actionCandidate, {
    actionType: "CLICK",
    targetElementId: "el-deposit-menu",
    role: "button",
    accessibleLabel: "예금 메뉴",
    guide: "다음 화면으로 이동합니다.",
  });
  assertInternalOnly(output);
});

test("C-GUIDE-03B product-detail navigation and amount TYPE carry exact targets", async () => {
  const detail = await decision("05");
  assert.deepEqual(detail.output.actionCandidate, {
    actionType: "CLICK",
    targetElementId: "el-amount-start",
    role: "button",
    accessibleLabel: "가입 금액 입력하기",
    guide: "가입 기간과 금리를 확인해 주세요.",
  });
  assert.equal(detail.output.sourceSnapshotId, detail.input.snapshot?.sourceSnapshotId);

  const amount = await decision("06");
  assert.deepEqual(amount.output.actionCandidate, {
    actionType: "TYPE",
    targetElementId: "el-amount",
    role: "textbox",
    accessibleLabel: "가입 금액",
    guide: "가입 금액을 확인해 주세요.",
  });
  assert.equal(amount.output.sourceSnapshotId, amount.input.snapshot?.sourceSnapshotId);
});

test("C-GUIDE-04 missing and nonexistent target references are rejected", async () => {
  const { input, output } = await decision("04");
  assert.equal(validateConversationInteractionDecision(input, {
    ...output,
    actionCandidate: { actionType: "WAIT_FOR_USER" },
  }).valid, false);
  assert.equal(validateConversationInteractionDecision(input, {
    ...output,
    actionCandidate: { ...output.actionCandidate!, targetElementId: "el-not-in-snapshot" },
  }).valid, false);
});

test("C-GUIDE-05 duplicate internal elementId fails closed instead of label selection", () => {
  const input = request("04");
  const first = input.snapshot!.sanitizedDomSnapshot.elements[0]!;
  input.snapshot!.sanitizedDomSnapshot.elements.push({ ...first });
  const output = decideConversationInteraction(input);
  assert.equal(output.mode, "STOP");
  assert.equal(output.reasonCode, "BLOCKED_TARGET");
  assert.equal(output.actionCandidate, null);

  const duplicateLabelInput = request("04");
  duplicateLabelInput.snapshot!.sanitizedDomSnapshot.elements[1] = {
    ...duplicateLabelInput.snapshot!.sanitizedDomSnapshot.elements[1]!,
    text: first.text,
    ariaLabel: first.ariaLabel,
  };
  const duplicateLabelOutput = decideConversationInteraction(duplicateLabelInput);
  assert.equal(duplicateLabelOutput.mode, "STOP");
  assert.equal(duplicateLabelOutput.actionCandidate, null);
});

test("C-GUIDE-06 stale source snapshot remains STOP without a target", async () => {
  const { output } = await decision("11");
  assert.equal(output.mode, "STOP");
  assert.equal(output.reasonCode, "STALE_SNAPSHOT");
  assert.equal(output.actionCandidate, null);
});

for (const [name, field] of [["hidden", "visible"], ["disabled", "enabled"]] as const) {
  test(`C-GUIDE-07/08 ${name} target cannot become GUIDE_USER or AUTO_EXECUTE`, () => {
    const input = request("03");
    input.snapshot!.sanitizedDomSnapshot.elements[0]![field] = false;
    const output = decideConversationInteraction(input);
    assert.equal(output.mode, "STOP");
    assert.equal(output.actionCandidate, null);

    const guideInput = request("04");
    const guideOutput = decideConversationInteraction(guideInput);
    guideInput.snapshot!.sanitizedDomSnapshot.elements[0]![field] = false;
    assert.equal(
      validateConversationInteractionDecision(guideInput, guideOutput).valid,
      false,
    );
  });
}

test("C-GUIDE-09 secure policy has priority over an available user-choice target", () => {
  const input = request("08");
  input.snapshot!.sanitizedDomSnapshot.elements.push(conversationElement(
    "el-user-choice",
    "직접 선택",
    { securityPolicy: "USER_DECISION" },
  ));
  const output = decideConversationInteraction(input);
  assert.equal(output.mode, "SECURE_INPUT_REQUIRED");
  assert.equal(output.actionCandidate, null);
});

test("C-GUIDE-10 risk policy has priority over an available user-choice target", () => {
  const input = request("09");
  input.snapshot!.sanitizedDomSnapshot.elements.push(conversationElement(
    "el-user-choice",
    "직접 선택",
    { securityPolicy: "USER_DECISION" },
  ));
  const output = decideConversationInteraction(input);
  assert.equal(output.mode, "RISK_WARNING");
  assert.equal(output.actionCandidate, null);
});

test("C-GUIDE-11 final confirmation cannot be represented as GUIDE_USER", async () => {
  const { input, output } = await decision("10");
  assert.equal(output.mode, "FINAL_CONFIRMATION_REQUIRED");
  assert.equal(output.actionCandidate, null);
  const guideAttempt = {
    ...output,
    mode: "GUIDE_USER",
    actionCandidate: {
      actionType: "WAIT_FOR_USER",
      targetElementId: "el-final-approve",
      role: "button",
      accessibleLabel: "Demo 예금 최종 승인",
      guide: output.message,
    },
  };
  assert.equal(validateConversationInteractionDecision(input, guideAttempt).valid, false);
});

test("C-GUIDE-12 raw selectors and public target fields are strict-contract errors", async () => {
  const { input, output } = await decision("04");
  for (const actionCandidate of [
    { ...output.actionCandidate!, selector: "#product" },
    { ...output.actionCandidate!, XPath: "//button" },
    { ...output.actionCandidate!, targetId: "public-target" },
    { ...output.actionCandidate!, rectangle: { x: 0, y: 0, width: 1, height: 1 } },
    { ...output.actionCandidate!, pageIdentity: "model-created-page" },
    { ...output.actionCandidate!, expiresAt: "2099-01-01T00:00:00Z" },
    { ...output.actionCandidate!, observationId: "model-observation" },
    { ...output.actionCandidate!, sourceSnapshotId: "duplicated-source" },
  ]) {
    assert.equal(validateConversationInteractionDecision(input, {
      ...output,
      actionCandidate,
    }).valid, false);
  }
  for (const accessibleLabel of ["#product", "//button", "<button>상품</button>"]) {
    assert.equal(validateConversationInteractionDecision(input, {
      ...output,
      actionCandidate: { ...output.actionCandidate!, accessibleLabel },
    }).valid, false);
  }
  const markdownGuide = "[계속](/next)";
  assert.equal(validateConversationInteractionDecision(input, {
    ...output,
    message: markdownGuide,
    actionCandidate: { ...output.actionCandidate!, guide: markdownGuide },
  }).valid, false);
});

test("C-GUIDE candidate role, label, guide and action type must match current policy", async () => {
  const { input, output } = await decision("04");
  for (const actionCandidate of [
    { ...output.actionCandidate!, role: "link" },
    { ...output.actionCandidate!, accessibleLabel: "다른 항목" },
    { ...output.actionCandidate!, guide: "다른 안내입니다." },
    { ...output.actionCandidate!, actionType: "CLICK" },
  ]) {
    assert.equal(validateConversationInteractionDecision(input, {
      ...output,
      actionCandidate,
    }).valid, false);
  }
});
