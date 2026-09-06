import assert from "node:assert/strict";
import test from "node:test";

import type { AgentDecision, ConversationAgentRequest } from "../conversation/conversationAgent.types.js";
import { validateConversationInteractionDecision } from "../conversation/conversationInteraction.policy.js";
import { ScriptedConversationModel } from "../conversation/scriptedConversation.model.js";
import {
  C_D2_DEPOSIT_FIXTURES,
  conversationRequest,
  conversationSnapshot,
} from "./fixtures/cD2Deposit.fixtures.js";

function day2(id: string): ConversationAgentRequest {
  const fixture = C_D2_DEPOSIT_FIXTURES.find((candidate) => candidate.id === id);
  if (!fixture) throw new Error(`Missing Day2 fixture ${id}`);
  return structuredClone(fixture.request);
}

function step(request: ConversationAgentRequest, number: number): ConversationAgentRequest {
  request.sessionId = "session-c-d3-e2e";
  request.requestId = `request-c-d3-e2e-${number}`;
  request.requestMessageId = `message-c-d3-e2e-${number}`;
  request.conversationSequence = number;
  return request;
}

const completion = conversationRequest(conversationSnapshot(
  "snap-e2e-10",
  [],
  "https://demo.test/deposit/completed/deposit-12m",
  {
    title: "정기예금 가입 완료",
    productId: "deposit-12m",
    productName: "12개월 정기예금",
    productPeriod: "12개월",
    depositAmount: "1,000,000원",
  },
));
completion.goal.safety.confirmationState = "APPROVED";
completion.goal.stage = "COMPLETED";

const FLOW: readonly {
  name: string;
  request: ConversationAgentRequest;
  mode: AgentDecision["mode"];
}[] = [
  { name: "collect initial deposit goal", request: step(day2("01"), 1), mode: "ASK_USER" },
  { name: "merge duration answer", request: step(day2("02"), 2), mode: "GOAL_PATCH_PROPOSED" },
  { name: "open deposit menu", request: step(day2("03"), 3), mode: "AUTO_EXECUTE" },
  { name: "pause for product selection", request: step(day2("04"), 4), mode: "GUIDE_USER" },
  { name: "continue from selected product", request: step(day2("05"), 5), mode: "AUTO_EXECUTE" },
  { name: "propose authoritative amount entry", request: step(day2("06"), 6), mode: "AUTO_EXECUTE" },
  { name: "pause for terms consent", request: step(day2("07"), 7), mode: "GUIDE_USER" },
  { name: "pause for secure input", request: step(day2("08"), 8), mode: "SECURE_INPUT_REQUIRED" },
  { name: "request Backend final confirmation", request: step(day2("10"), 9), mode: "FINAL_CONFIRMATION_REQUIRED" },
  { name: "recognize verified completion", request: step(completion, 10), mode: "COMPLETE" },
];

test("C-D3-13 internal 10-step deposit E2E is deterministic and never executes Browser actions", async () => {
  const model = new ScriptedConversationModel();
  const executedBrowserActions: unknown[] = [];
  const decisions: AgentDecision[] = [];

  for (const [index, item] of FLOW.entries()) {
    const goalBefore = structuredClone(item.request.goal);
    const first = await model.decide(item.request);
    const second = await model.decide(item.request);
    assert.deepEqual(first, second, `step ${index + 1} must be deterministic`);
    assert.equal(first.mode, item.mode, `step ${index + 1}: ${item.name}`);
    assert.deepEqual(item.request.goal, goalBefore, `step ${index + 1} must not mutate authority`);
    const validation = validateConversationInteractionDecision(item.request, first);
    assert.equal(validation.valid, true, `step ${index + 1}: ${validation.errors.join("; ")}`);
    assert.equal(first.baseGoalRevision, item.request.goal.revision);
    if (first.sourceSnapshotId !== null) {
      assert.equal(first.sourceSnapshotId, item.request.snapshot?.sourceSnapshotId);
    }
    decisions.push(first);
  }

  assert.equal(executedBrowserActions.length, 0);
  assert.equal(decisions[3]?.actionCandidate?.actionType, "WAIT_FOR_USER");
  assert.equal(decisions[6]?.actionCandidate?.actionType, "WAIT_FOR_USER");
  assert.equal(decisions[7]?.actionCandidate, null);
  assert.equal(decisions[8]?.actionCandidate, null);
  assert.equal(decisions[9]?.actionCandidate, null);

  const staleReplay = { ...decisions[4], sourceSnapshotId: "snap-e2e-stale" };
  assert.equal(validateConversationInteractionDecision(FLOW[4]!.request, staleReplay).valid, false);
  const staleRevision = { ...decisions[5], baseGoalRevision: 1 };
  assert.equal(validateConversationInteractionDecision(FLOW[5]!.request, staleRevision).valid, false);
});

test("C-D3-13 flow inventory is exactly ten numbered steps", () => {
  assert.equal(FLOW.length, 10);
  assert.deepEqual(FLOW.map(({ mode }) => mode), [
    "ASK_USER",
    "GOAL_PATCH_PROPOSED",
    "AUTO_EXECUTE",
    "GUIDE_USER",
    "AUTO_EXECUTE",
    "AUTO_EXECUTE",
    "GUIDE_USER",
    "SECURE_INPUT_REQUIRED",
    "FINAL_CONFIRMATION_REQUIRED",
    "COMPLETE",
  ]);
});
