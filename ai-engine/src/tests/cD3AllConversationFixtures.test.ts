import assert from "node:assert/strict";
import test from "node:test";

import { validateConversationInteractionDecision } from "../conversation/conversationInteraction.policy.js";
import { ScriptedConversationModel } from "../conversation/scriptedConversation.model.js";
import { C_D2_DEPOSIT_FIXTURES } from "./fixtures/cD2Deposit.fixtures.js";
import { C_D3_SAFETY_FIXTURES } from "./fixtures/cD3Safety.fixtures.js";

test("C-D3-14 validates the complete Day2 12 + Day3 12 fixture inventory", async () => {
  const model = new ScriptedConversationModel();
  let accepted = 0;
  let safelyRejected = 0;

  for (const fixture of C_D2_DEPOSIT_FIXTURES) {
    const decision = await model.decide(fixture.request);
    assert.equal(validateConversationInteractionDecision(fixture.request, decision).valid, true);
    accepted += 1;
  }

  for (const fixture of C_D3_SAFETY_FIXTURES) {
    const decision = await model.decide(fixture.request);
    const candidate = fixture.mutateCandidate?.(decision) ?? decision;
    const valid = validateConversationInteractionDecision(fixture.request, candidate).valid;
    if (fixture.expected.result === "CONTRACT_REJECTED") {
      assert.equal(valid, false);
      safelyRejected += 1;
    } else {
      assert.equal(valid, true);
      accepted += 1;
    }
  }

  assert.equal(C_D2_DEPOSIT_FIXTURES.length + C_D3_SAFETY_FIXTURES.length, 24);
  assert.equal(accepted, 23);
  assert.equal(safelyRejected, 1);
});
