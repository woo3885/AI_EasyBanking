import assert from "node:assert/strict";
import test from "node:test";

import { ScriptedConversationModel } from "../conversation/scriptedConversation.model.js";
import { C_D2_DEPOSIT_FIXTURES, conversationRequest, conversationSnapshot } from "./fixtures/cD2Deposit.fixtures.js";

test("C-NAV-PAGE-READY creates a fresh GUIDE decision from the destination snapshot", async () => {
  const model = new ScriptedConversationModel();
  const entry = conversationRequest(conversationSnapshot("source-before-navigation", []));
  entry.goal = { ...entry.goal, stage: "DEPOSIT_ENTRY" };

  const navigation = await model.decide(entry);
  assert.equal(navigation.mode, "NAVIGATION_REQUIRED");
  assert.equal(navigation.sourceSnapshotId, "source-before-navigation");

  const destination = structuredClone(C_D2_DEPOSIT_FIXTURES.find((item) => item.id === "04")!.request);
  destination.requestId = "request-after-page-ready";
  destination.requestMessageId = "message-after-page-ready";
  destination.goal = { ...destination.goal, stage: "DEPOSIT_ENTRY" };
  destination.snapshot = {
    ...destination.snapshot!,
    sourceSnapshotId: "source-after-page-ready",
    sanitizedDomSnapshot: {
      ...destination.snapshot!.sanitizedDomSnapshot,
      snapshotId: "source-after-page-ready",
    },
  };

  const next = await model.decide(destination);
  assert.equal(next.mode, "GUIDE_USER");
  assert.equal(next.navigationCandidate, null);
  assert.equal(next.sourceSnapshotId, "source-after-page-ready");
  assert.equal(next.actionCandidate?.targetElementId, "el-product-12m");
  assert.notEqual(next.sourceSnapshotId, navigation.sourceSnapshotId);
  assert.equal(JSON.stringify(next).includes("source-before-navigation"), false);
});
