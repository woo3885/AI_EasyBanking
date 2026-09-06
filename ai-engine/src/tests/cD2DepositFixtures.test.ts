import assert from "node:assert/strict";
import test from "node:test";

import { ScriptedConversationModel } from "../conversation/scriptedConversation.model.js";
import { validateConversationInteractionDecision } from "../conversation/conversationInteraction.policy.js";
import {
  C_D2_DEPOSIT_FIXTURES,
} from "./fixtures/cD2Deposit.fixtures.js";

const model = new ScriptedConversationModel();

for (const fixture of C_D2_DEPOSIT_FIXTURES) {
  test(`C-D2-FIXTURE-${fixture.id} ${fixture.title}`, async () => {
    const first = await model.decide(fixture.request);
    const second = await model.decide(fixture.request);

    assert.deepEqual(first, second);
    assert.equal(first.mode, fixture.expected.mode);
    assert.equal(first.actionCandidate?.actionType ?? null, fixture.expected.actionType);
    if ("message" in fixture.expected) {
      assert.equal(first.message, fixture.expected.message);
    }
    if (fixture.expected.reasonCode) {
      assert.equal(first.reasonCode, fixture.expected.reasonCode);
    }

    const validation = validateConversationInteractionDecision(fixture.request, first);
    assert.equal(validation.valid, true, validation.errors.join("\n"));

    const serialized = JSON.stringify(first);
    assert.doesNotMatch(serialized, /(?:secret-1234|123456|#password|\/\/input|<input|agent-chat)/iu);
    assert.equal("selector" in first, false);
    assert.equal("XPath" in first, false);
    assert.equal("confirmationId" in first, false);
    assert.equal("questionId" in first, false);

    if (["04", "07"].includes(fixture.id)) {
      assert.notEqual(first.actionCandidate?.actionType, "CLICK");
      assert.notEqual(first.actionCandidate?.actionType, "TYPE");
    }
    if (["08", "09", "10", "11", "12"].includes(fixture.id)) {
      assert.equal(first.actionCandidate, null);
    }
    if (fixture.id === "12") assert.notEqual(first.mode, "COMPLETE");
  });
}
