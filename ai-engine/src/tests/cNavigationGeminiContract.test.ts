import assert from "node:assert/strict";
import test from "node:test";

import {
  GeminiConversationContractError,
  GeminiConversationModel,
} from "../conversation/geminiConversation.model.js";
import { createNavigationDecisionId } from "../conversation/conversationNavigation.policy.js";
import { ScriptedConversationModel } from "../conversation/scriptedConversation.model.js";
import type {
  AgentDecision,
  ConversationAgentRequest,
} from "../conversation/conversationAgent.types.js";
import {
  C_D2_DEPOSIT_FIXTURES,
  conversationElement,
  conversationRequest,
  conversationSnapshot,
} from "./fixtures/cD2Deposit.fixtures.js";

const scripted = new ScriptedConversationModel();

function entryRequest(): ConversationAgentRequest {
  const input = conversationRequest(conversationSnapshot("gemini-nav-entry", []));
  input.goal = { ...input.goal, stage: "DEPOSIT_ENTRY" };
  return input;
}

async function navigationFor(input: ConversationAgentRequest): Promise<AgentDecision> {
  const decision = await scripted.decide(input);
  assert.equal(decision.mode, "NAVIGATION_REQUIRED");
  return decision;
}

function proposedNavigationFor(
  input: ConversationAgentRequest,
  template: AgentDecision,
): AgentDecision {
  const semanticRoute = "DEPOSIT_PRODUCTS" as const;
  const navigationMode = "SPA_PUSH" as const;
  return {
    ...template,
    requestId: input.requestId,
    requestMessageId: input.requestMessageId,
    goalId: input.goal.goalId,
    baseGoalRevision: input.goal.revision,
    sourceSnapshotId: input.snapshot!.sourceSnapshotId,
    navigationCandidate: {
      decisionId: createNavigationDecisionId(input, semanticRoute, navigationMode),
      semanticRoute,
      navigationMode,
    },
  };
}

async function expectInvalid(input: ConversationAgentRequest, candidate: unknown) {
  const model = new GeminiConversationModel(async () => JSON.stringify(candidate));
  await assert.rejects(
    () => model.decide(input),
    (error: unknown) => error instanceof GeminiConversationContractError && error.code === "INVALID_DECISION",
  );
}

test("C-NAV-GEMINI-01 accepts the exact semantic navigation proposal", async () => {
  const input = entryRequest();
  const decision = await navigationFor(input);
  const model = new GeminiConversationModel(async () => JSON.stringify(decision));
  assert.deepEqual(await model.decide(input), decision);
});

test("C-NAV-GEMINI-02 rejects a missing navigationCandidate", async () => {
  const input = entryRequest();
  const candidate = { ...await navigationFor(input) } as Record<string, unknown>;
  delete candidate.navigationCandidate;
  await expectInvalid(input, candidate);
});

test("C-NAV-GEMINI-03 rejects NAVIGATION_REQUIRED with an actionCandidate", async () => {
  const input = entryRequest();
  const candidate = {
    ...await navigationFor(input),
    actionCandidate: {
      actionType: "CLICK",
      targetElementId: "el-safe",
      role: "button",
      accessibleLabel: "safe",
      guide: "safe",
    },
  };
  await expectInvalid(input, candidate);
});

test("C-NAV-GEMINI-04 rejects navigation without sourceSnapshotId", async () => {
  const input = entryRequest();
  await expectInvalid(input, { ...await navigationFor(input), sourceSnapshotId: null });
});

test("C-NAV-GEMINI-05 rejects a stale sourceSnapshotId", async () => {
  const input = entryRequest();
  await expectInvalid(input, { ...await navigationFor(input), sourceSnapshotId: "stale-source" });
});

test("C-NAV-GEMINI-06 rejects a random-looking but noncanonical decisionId", async () => {
  const input = entryRequest();
  const decision = await navigationFor(input);
  await expectInvalid(input, {
    ...decision,
    navigationCandidate: { ...decision.navigationCandidate!, decisionId: `navdec_${"a".repeat(64)}` },
  });
});

test("C-NAV-GEMINI-07 rejects an arbitrary navigation mode", async () => {
  const input = entryRequest();
  const decision = await navigationFor(input);
  await expectInvalid(input, {
    ...decision,
    navigationCandidate: {
      ...decision.navigationCandidate!,
      decisionId: createNavigationDecisionId(input, "DEPOSIT_PRODUCTS", "SPA_REPLACE"),
      navigationMode: "SPA_REPLACE",
    },
  });
});

test("C-NAV-GEMINI-08 rejects an arbitrary semantic route", async () => {
  const input = entryRequest();
  const decision = await navigationFor(input);
  await expectInvalid(input, {
    ...decision,
    navigationCandidate: {
      ...decision.navigationCandidate!,
      decisionId: createNavigationDecisionId(input, "TRANSFER_ACCOUNTS", "SPA_PUSH"),
      semanticRoute: "TRANSFER_ACCOUNTS",
    },
  });
});

test("C-NAV-GEMINI-09 rejects a raw URL field", async () => {
  const input = entryRequest();
  const decision = await navigationFor(input);
  await expectInvalid(input, {
    ...decision,
    navigationCandidate: { ...decision.navigationCandidate!, url: "https://untrusted.test/products" },
  });
});

test("C-NAV-GEMINI-10 rejects absolute and relative path fields", async () => {
  const input = entryRequest();
  const decision = await navigationFor(input);
  for (const path of ["/products", "products/list"]) {
    await expectInvalid(input, {
      ...decision,
      navigationCandidate: { ...decision.navigationCandidate!, path },
    });
  }
});

test("C-NAV-GEMINI-11 rejects a selector field", async () => {
  const input = entryRequest();
  const decision = await navigationFor(input);
  await expectInvalid(input, {
    ...decision,
    navigationCandidate: { ...decision.navigationCandidate!, selector: "#product-menu" },
  });
});

test("C-NAV-GEMINI-12 rejects navigationCandidate on a non-navigation mode", async () => {
  const input = structuredClone(C_D2_DEPOSIT_FIXTURES.find((item) => item.id === "04")!.request);
  const guide = await scripted.decide(input);
  const template = await navigationFor(entryRequest());
  await expectInvalid(input, {
    ...guide,
    navigationCandidate: proposedNavigationFor(input, template).navigationCandidate,
  });
});

test("C-NAV-GEMINI-13 secure input cannot be replaced by navigation", async () => {
  const input = entryRequest();
  input.snapshot = {
    ...input.snapshot!,
    sanitizedDomSnapshot: conversationSnapshot(input.snapshot!.sourceSnapshotId, [
      conversationElement("el-secure", "보안 입력", { tag: "input", role: "textbox", inputType: "password", securityPolicy: "SECURE_INPUT" }),
    ]),
  };
  const template = await navigationFor(entryRequest());
  await expectInvalid(input, proposedNavigationFor(input, template));
});

test("C-NAV-GEMINI-14 risk warning cannot be replaced by navigation", async () => {
  const input = entryRequest();
  input.goal = { ...input.goal, safety: { ...input.goal.safety, riskState: "WARNING" } };
  const template = await navigationFor(entryRequest());
  await expectInvalid(input, proposedNavigationFor(input, template));
});

test("C-NAV-GEMINI-15 final confirmation cannot be replaced by navigation", async () => {
  const input = structuredClone(C_D2_DEPOSIT_FIXTURES.find((item) => item.id === "10")!.request);
  input.goal = { ...input.goal, stage: "DEPOSIT_ENTRY" };
  const template = await navigationFor(entryRequest());
  await expectInvalid(input, proposedNavigationFor(input, template));
});

test("C-NAV-GEMINI-16 rejects a null navigationCandidate", async () => {
  const input = entryRequest();
  await expectInvalid(input, { ...await navigationFor(input), navigationCandidate: null });
});

test("C-NAV-GEMINI-17 rejects an unknown semantic route enum", async () => {
  const input = entryRequest();
  const decision = await navigationFor(input);
  await expectInvalid(input, {
    ...decision,
    navigationCandidate: { ...decision.navigationCandidate!, semanticRoute: "UNKNOWN_ROUTE" },
  });
});

test("C-NAV-GEMINI-18 rejects an unknown navigation mode enum", async () => {
  const input = entryRequest();
  const decision = await navigationFor(input);
  await expectInvalid(input, {
    ...decision,
    navigationCandidate: { ...decision.navigationCandidate!, navigationMode: "FULL_RELOAD" },
  });
});

test("C-NAV-GEMINI-19 identical retries preserve the accepted decisionId", async () => {
  const input = entryRequest();
  const first = await navigationFor(input);
  const second = await navigationFor(structuredClone(input));
  const model = new GeminiConversationModel(async () => JSON.stringify(first));
  assert.equal((await model.decide(input)).navigationCandidate?.decisionId, second.navigationCandidate?.decisionId);
});

test("C-NAV-GEMINI-20 semantic route changes decisionId", async () => {
  const input = entryRequest();
  assert.notEqual(
    createNavigationDecisionId(input, "DEPOSIT_PRODUCTS", "SPA_PUSH"),
    createNavigationDecisionId(input, "TRANSFER_ACCOUNTS", "SPA_PUSH"),
  );
});

test("C-NAV-GEMINI-21 navigation mode changes decisionId", async () => {
  const input = entryRequest();
  assert.notEqual(
    createNavigationDecisionId(input, "DEPOSIT_PRODUCTS", "SPA_PUSH"),
    createNavigationDecisionId(input, "DEPOSIT_PRODUCTS", "SPA_REPLACE"),
  );
});
