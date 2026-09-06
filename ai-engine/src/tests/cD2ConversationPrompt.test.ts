import assert from "node:assert/strict";
import test from "node:test";

import { createConversationPrompt } from "../conversation/conversationPrompt.builder.js";
import {
  conversationElement,
  conversationRequest,
  conversationSnapshot,
} from "./fixtures/cD2Deposit.fixtures.js";

test("C-D2-05 prompt contains authoritative goal, pending question, safe messages and sanitized DOM", () => {
  const request = conversationRequest(conversationSnapshot("snap-prompt", [
    conversationElement("el-safe-menu", "예금 메뉴"),
  ]));
  request.goal.pendingQuestion = {
    questionId: "backend-question-secret",
    fieldKey: "duration",
  };
  const prompt = createConversationPrompt(request, [
    { role: "USER", content: "100만원으로 예금 가입해줘" },
    { role: "ASSISTANT", content: "가입 기간은 얼마로 할까요?" },
  ]);

  assert.match(prompt, /"intent": "DEPOSIT"/u);
  assert.match(prompt, /"fieldKey": "duration"/u);
  assert.match(prompt, /가입 기간은 얼마로 할까요/u);
  assert.match(prompt, /"elementId": "el-safe-menu"/u);
  assert.match(prompt, /"sourceSnapshotId": "snap-prompt"/u);
  assert.doesNotMatch(prompt, /backend-question-secret/u);
});

test("C-D2-05 prompt excludes credentials, raw DOM, selectors, internal data and agent UI", () => {
  const request = conversationRequest(conversationSnapshot("snap-safe-prompt", [
    conversationElement("agent-chat-input", "AI 채팅 입력"),
    conversationElement("el-password", "비밀번호 secret-1234", {
      tag: "input",
      role: "textbox",
      inputType: "password",
      securityPolicy: "SECURE_INPUT",
    }),
    conversationElement("el-safe", "예금 메뉴"),
  ]));
  const prompt = createConversationPrompt(request, [
    { role: "USER", content: "OTP 123456" },
    { role: "ASSISTANT", content: "stack trace at internal.ts:1:1" },
    { role: "USER", content: "예금 메뉴를 보여줘" },
  ]);

  assert.match(prompt, /예금 메뉴를 보여줘/u);
  assert.match(prompt, /el-safe/u);
  assert.doesNotMatch(prompt, /123456|secret-1234|agent-chat-input|AI 채팅 입력/u);
  assert.doesNotMatch(prompt, /internal\.ts:1:1/u);
  assert.equal(prompt.includes("<input"), false);
  assert.equal(prompt.includes("#password"), false);
});

test("C-D2-05 prompt states the non-negotiable action and authority rules", () => {
  const prompt = createConversationPrompt(conversationRequest(null));
  for (const rule of [
    "한 번에 한 행동",
    "ASK_USER",
    "GUIDE_USER",
    "AUTO_EXECUTE",
    "상품 추천·자동 선택",
    "약관 자동 동의",
    "최종 거래 승인",
    "stale target",
    "Backend 권한",
    "sanitized DOM의 elementId",
    "target이 없거나 중복이면 STOP",
    "public overlay target",
  ]) {
    assert.match(prompt, new RegExp(rule, "u"));
  }
});
