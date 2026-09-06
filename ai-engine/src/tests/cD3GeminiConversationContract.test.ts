import assert from "node:assert/strict";
import test from "node:test";

import type { AgentDecision, ConversationAgentRequest } from "../conversation/conversationAgent.types.js";
import {
  GeminiConversationContractError,
  GeminiConversationModel,
  type GeminiConversationTransport,
} from "../conversation/geminiConversation.model.js";
import { ScriptedConversationModel } from "../conversation/scriptedConversation.model.js";
import { C_D2_DEPOSIT_FIXTURES } from "./fixtures/cD2Deposit.fixtures.js";

function request(id: string): ConversationAgentRequest {
  const fixture = C_D2_DEPOSIT_FIXTURES.find((candidate) => candidate.id === id);
  if (!fixture) throw new Error(`Missing Day2 fixture ${id}`);
  return structuredClone(fixture.request);
}

async function scriptedDecision(id: string): Promise<{ request: ConversationAgentRequest; decision: AgentDecision }> {
  const input = request(id);
  return { request: input, decision: await new ScriptedConversationModel().decide(input) };
}

function adapter(output: unknown, observedPrompts: string[] = []): GeminiConversationModel {
  const transport: GeminiConversationTransport = async ({ prompt }) => {
    observedPrompts.push(prompt);
    return typeof output === "string" ? output : JSON.stringify(output);
  };
  return new GeminiConversationModel(transport);
}

async function rejectsContract(
  input: ConversationAgentRequest,
  output: unknown,
  code: GeminiConversationContractError["code"] = "INVALID_DECISION",
): Promise<void> {
  await assert.rejects(
    adapter(output).decide(input),
    (error: unknown) => error instanceof GeminiConversationContractError && error.code === code,
  );
}

test("C-D3-GEMINI-01 accepts a valid ConversationAgentRequest -> AgentDecision result without a key", async () => {
  const { request: input, decision } = await scriptedDecision("03");
  const prompts: string[] = [];
  const actual = await adapter(decision, prompts).decide(input);
  assert.deepEqual(actual, decision);
  assert.match(prompts[0] ?? "", /BEGIN_UNTRUSTED_DATA_JSON/u);
});

test("C-D3-GEMINI-02 rejects an unknown mode", async () => {
  const { request: input, decision } = await scriptedDecision("03");
  await rejectsContract(input, { ...decision, mode: "ROOT_OVERRIDE" });
});

test("C-D3-GEMINI-03 rejects an invalid action candidate shape", async () => {
  const { request: input, decision } = await scriptedDecision("03");
  await rejectsContract(input, {
    ...decision,
    actionCandidate: { actionType: "CLICK", selector: "#password" },
  });
});

test("C-D3-GEMINI-04 rejects secure-screen AUTO_EXECUTE", async () => {
  const { request: input, decision } = await scriptedDecision("08");
  await rejectsContract(input, {
    ...decision,
    mode: "AUTO_EXECUTE",
    message: "다음 단계를 진행합니다.",
    reasonCode: "MODEL_AUTO",
    actionCandidate: { actionType: "TYPE" },
  });
});

test("C-D3-GEMINI-05 rejects final-confirmation CLICK", async () => {
  const { request: input, decision } = await scriptedDecision("10");
  await rejectsContract(input, {
    ...decision,
    mode: "AUTO_EXECUTE",
    message: "다음 단계를 진행합니다.",
    reasonCode: "MODEL_AUTO",
    actionCandidate: { actionType: "CLICK" },
  });
});

test("C-D3-GEMINI-06 rejects a stale sourceSnapshotId", async () => {
  const { request: input, decision } = await scriptedDecision("03");
  await rejectsContract(input, { ...decision, sourceSnapshotId: "snap-old" });
});

test("C-D3-GEMINI-07 rejects raw credential echo", async () => {
  const { request: input, decision } = await scriptedDecision("03");
  await rejectsContract(input, { ...decision, message: "OTP 123456" });
});

test("C-D3-GEMINI-08 rejects invalid JSON", async () => {
  await rejectsContract(request("03"), "```json not-json ```", "INVALID_JSON");
});
