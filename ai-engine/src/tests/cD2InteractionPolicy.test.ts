import assert from "node:assert/strict";
import test from "node:test";

import {
  decideConversationInteraction,
  validateConversationInteractionDecision,
} from "../conversation/conversationInteraction.policy.js";
import { ScriptedConversationModel } from "../conversation/scriptedConversation.model.js";
import {
  C_D2_DEPOSIT_FIXTURES,
  conversationElement,
  conversationRequest,
  conversationSnapshot,
} from "./fixtures/cD2Deposit.fixtures.js";

test("C-D2-04 all ten interaction modes remain semantically distinct", async () => {
  const decisions = await Promise.all(
    C_D2_DEPOSIT_FIXTURES.map((fixture) =>
      new ScriptedConversationModel().decide(fixture.request)),
  );
  const completed = conversationRequest(conversationSnapshot(
    "snap-completed",
    [conversationElement("el-home", "메인으로 돌아가기")],
    "https://demo.test/deposit/completed/deposit-12m",
  ));
  decisions.push(decideConversationInteraction(completed));
  const navigation = conversationRequest(conversationSnapshot("snap-navigation", []));
  navigation.goal = { ...navigation.goal, stage: "DEPOSIT_ENTRY" };
  decisions.push(decideConversationInteraction(navigation));

  assert.deepEqual(new Set(decisions.map((decision) => decision.mode)), new Set([
    "AUTO_EXECUTE",
    "GUIDE_USER",
    "NAVIGATION_REQUIRED",
    "ASK_USER",
    "GOAL_PATCH_PROPOSED",
    "SECURE_INPUT_REQUIRED",
    "RISK_WARNING",
    "FINAL_CONFIRMATION_REQUIRED",
    "COMPLETE",
    "STOP",
  ]));
});

test("C-D2-04 protected and stale targets cannot become AUTO_EXECUTE", () => {
  const protectedRequest = conversationRequest(conversationSnapshot("snap-protected", [
    conversationElement("el-product", "정기예금 상품", {
      securityPolicy: "USER_DECISION",
    }),
  ]));
  const unsafe = {
    ...decideConversationInteraction(protectedRequest),
    mode: "AUTO_EXECUTE" as const,
    message: "다음 화면으로 이동합니다.",
    actionCandidate: {
      actionType: "CLICK" as const,
      targetElementId: "el-product",
      role: "button",
      accessibleLabel: "정기예금 상품",
      guide: "다음 화면으로 이동합니다.",
    },
  };
  const result = validateConversationInteractionDecision(protectedRequest, unsafe);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /expected GUIDE_USER|current snapshot policy/u);

  const stale = C_D2_DEPOSIT_FIXTURES.find((fixture) => fixture.id === "11")!;
  const staleDecision = decideConversationInteraction(stale.request);
  assert.equal(staleDecision.mode, "STOP");
  assert.equal(staleDecision.actionCandidate, null);
});

test("C-D2-04 semantic validator rejects Backend authority and unsafe messages", () => {
  const request = C_D2_DEPOSIT_FIXTURES.find((fixture) => fixture.id === "03")!.request;
  const safe = decideConversationInteraction(request);
  for (const invalid of [
    { ...safe, goalId: "model-created-goal" },
    { ...safe, baseGoalRevision: safe.baseGoalRevision + 1 },
    { ...safe, sourceSnapshotId: "stale-snapshot" },
    { ...safe, message: "<b>elementId와 selector를 사용합니다.</b>" },
  ]) {
    assert.equal(validateConversationInteractionDecision(request, invalid).valid, false);
  }
});

test("C-D2-04 unknown mode fails closed at the strict schema", () => {
  const request = C_D2_DEPOSIT_FIXTURES.find((fixture) => fixture.id === "03")!.request;
  const decision = {
    ...decideConversationInteraction(request),
    mode: "MODEL_INVENTED_MODE",
  };
  assert.equal(validateConversationInteractionDecision(request, decision).valid, false);
});

test("C-D2-04 Backend-resolved confirmation cannot be proposed again", () => {
  const fixture = C_D2_DEPOSIT_FIXTURES.find((item) => item.id === "10")!;
  const request = structuredClone(fixture.request);
  request.goal.safety.confirmationState = "APPROVED";

  const decision = decideConversationInteraction(request);
  assert.equal(decision.mode, "STOP");
  assert.equal(decision.reasonCode, "BLOCKED_TARGET");
  assert.equal(decision.actionCandidate, null);
});
