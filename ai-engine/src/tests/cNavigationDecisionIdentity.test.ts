import assert from "node:assert/strict";
import test from "node:test";

import { createNavigationDecisionId } from "../conversation/conversationNavigation.policy.js";
import {
  conversationRequest,
  conversationSnapshot,
} from "./fixtures/cD2Deposit.fixtures.js";

function request() {
  const value = conversationRequest(conversationSnapshot("nav-identity-source", []));
  value.goal = { ...value.goal, stage: "DEPOSIT_ENTRY" };
  return value;
}

test("C-NAV-ID-01 identical authoritative material produces the same ID", () => {
  const input = request();
  assert.equal(
    createNavigationDecisionId(input, "DEPOSIT_PRODUCTS", "SPA_PUSH"),
    createNavigationDecisionId(structuredClone(input), "DEPOSIT_PRODUCTS", "SPA_PUSH"),
  );
});

test("C-NAV-ID-02 requestMessageId changes the ID", () => {
  const first = request();
  const second = request();
  second.requestMessageId = "another-message";
  assert.notEqual(createNavigationDecisionId(first, "DEPOSIT_PRODUCTS", "SPA_PUSH"), createNavigationDecisionId(second, "DEPOSIT_PRODUCTS", "SPA_PUSH"));
});

test("C-NAV-ID-03 goalId changes the ID", () => {
  const first = request();
  const second = request();
  second.goal = { ...second.goal, goalId: "another-goal" };
  assert.notEqual(createNavigationDecisionId(first, "DEPOSIT_PRODUCTS", "SPA_PUSH"), createNavigationDecisionId(second, "DEPOSIT_PRODUCTS", "SPA_PUSH"));
});

test("C-NAV-ID-04 base revision changes the ID", () => {
  const first = request();
  const second = request();
  second.goal = { ...second.goal, revision: second.goal.revision + 1 };
  assert.notEqual(createNavigationDecisionId(first, "DEPOSIT_PRODUCTS", "SPA_PUSH"), createNavigationDecisionId(second, "DEPOSIT_PRODUCTS", "SPA_PUSH"));
});

test("C-NAV-ID-05 source snapshot changes the ID", () => {
  const first = request();
  const second = request();
  second.snapshot = {
    ...second.snapshot!,
    sourceSnapshotId: "another-source",
    sanitizedDomSnapshot: {
      ...second.snapshot!.sanitizedDomSnapshot,
      snapshotId: "another-source",
    },
  };
  assert.notEqual(createNavigationDecisionId(first, "DEPOSIT_PRODUCTS", "SPA_PUSH"), createNavigationDecisionId(second, "DEPOSIT_PRODUCTS", "SPA_PUSH"));
});

test("C-NAV-ID-06 semantic route changes the ID", () => {
  const input = request();
  assert.notEqual(createNavigationDecisionId(input, "DEPOSIT_PRODUCTS", "SPA_PUSH"), createNavigationDecisionId(input, "TRANSFER_ACCOUNTS", "SPA_PUSH"));
});

test("C-NAV-ID-07 navigation mode changes the ID", () => {
  const input = request();
  assert.notEqual(createNavigationDecisionId(input, "DEPOSIT_PRODUCTS", "SPA_PUSH"), createNavigationDecisionId(input, "DEPOSIT_PRODUCTS", "SPA_REPLACE"));
});

test("C-NAV-ID-08 object property insertion order does not change the ID", () => {
  const first = request();
  const second = {
    snapshot: structuredClone(first.snapshot),
    userMessage: structuredClone(first.userMessage),
    goal: structuredClone(first.goal),
    conversationSequence: first.conversationSequence,
    requestMessageId: first.requestMessageId,
    requestId: first.requestId,
    sessionId: first.sessionId,
  };
  assert.equal(createNavigationDecisionId(first, "DEPOSIT_PRODUCTS", "SPA_PUSH"), createNavigationDecisionId(second, "DEPOSIT_PRODUCTS", "SPA_PUSH"));
});

test("C-NAV-ID-09 unrelated nested property ordering does not change the ID", () => {
  const first = request();
  const second = request();
  second.goal = {
    ...second.goal,
    safety: {
      confirmationState: second.goal.safety.confirmationState,
      riskState: second.goal.safety.riskState,
      secureInputActive: second.goal.safety.secureInputActive,
    },
  };
  assert.equal(createNavigationDecisionId(first, "DEPOSIT_PRODUCTS", "SPA_PUSH"), createNavigationDecisionId(second, "DEPOSIT_PRODUCTS", "SPA_PUSH"));
});
