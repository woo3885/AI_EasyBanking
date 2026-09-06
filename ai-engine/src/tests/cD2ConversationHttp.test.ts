import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { createServer } from "../api/server.js";
import type { ConversationModelPort } from "../conversation/conversationModel.port.js";
import { C_D2_DEPOSIT_FIXTURES } from "./fixtures/cD2Deposit.fixtures.js";

async function withServer(
  run: (url: string) => Promise<void>,
  model?: ConversationModelPort,
) {
  const server = createServer(model).listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${address.port}/api/ai/conversation/decision`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

test("C-D2 conversation HTTP returns GUIDE_USER with an internal snapshot target", async () => {
  const request = C_D2_DEPOSIT_FIXTURES.find((fixture) => fixture.id === "04")!.request;
  await withServer(async (url) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
    const body = await response.json() as Record<string, unknown>;
    assert.equal(response.status, 200);
    assert.equal(body.mode, "GUIDE_USER");
    assert.deepEqual(body.actionCandidate, {
      actionType: "WAIT_FOR_USER",
      targetElementId: "el-product-12m",
      role: "button",
      accessibleLabel: "12개월 정기예금 선택",
      guide: "가입할 예금 상품을 직접 선택해 주세요.",
    });
    assert.equal(body.sourceSnapshotId, "snap-04");
  });
});

test("C-D2 conversation HTTP rejects a model attempt to auto-select a product", async () => {
  const request = C_D2_DEPOSIT_FIXTURES.find((fixture) => fixture.id === "04")!.request;
  const unsafeModel: ConversationModelPort = {
    async decide(input) {
      return {
        requestId: input.requestId,
        requestMessageId: input.requestMessageId,
        goalId: input.goal.goalId,
        baseGoalRevision: input.goal.revision,
        mode: "AUTO_EXECUTE",
        message: "상품을 자동으로 선택합니다.",
        confidence: 1,
        reasonCode: "MODEL_AUTO_SELECTION",
        nextCondition: null,
        sourceSnapshotId: input.snapshot!.sourceSnapshotId,
        goalPatch: null,
        question: null,
        actionCandidate: {
          actionType: "CLICK",
          targetElementId: "el-product-12m",
          role: "button",
          accessibleLabel: "12개월 정기예금 선택",
          guide: "상품을 자동으로 선택합니다.",
        },
      };
    },
  };

  await withServer(async (url) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
    const body = await response.json() as Record<string, unknown>;
    assert.equal(response.status, 502);
    assert.equal(body.code, "CONVERSATION_INVALID_DECISION");
    assert.equal(JSON.stringify(body).includes("el-product"), false);
  }, unsafeModel);
});
