import { Router } from "express";
import type { ConversationModelPort } from "../conversation/conversationModel.port.js";
import { ScriptedConversationModel } from "../conversation/scriptedConversation.model.js";
import {
  validateAgentDecision,
  validateConversationAgentRequest,
} from "../conversation/conversationAgent.validator.js";
import { containsCredentialContext } from "../conversation/userGoalPatch.extractor.js";
import type { ConversationAgentRequest } from "../conversation/conversationAgent.types.js";
import {
  validateConversationInteractionDecision,
} from "../conversation/conversationInteraction.policy.js";

const MODEL_TIMEOUT_MS = 5_000;

export function createConversationDecisionRouter(
  model: ConversationModelPort = new ScriptedConversationModel(),
) {
  const router = Router();
  router.post("/conversation/decision", async (req, res) => {
    const requestValidation = validateConversationAgentRequest(req.body);
    if (!requestValidation.valid) {
      res.status(400).json({ code: "CONVERSATION_INVALID_REQUEST", message: "요청 계약이 올바르지 않습니다." });
      return;
    }
    const request = req.body as ConversationAgentRequest;
    if (containsCredentialContext(request.userMessage.content)) {
      res.status(400).json({ code: "CONVERSATION_SENSITIVE_INPUT", message: "민감정보는 처리할 수 없습니다." });
      return;
    }
    try {
      const decision = await withTimeout(model.decide(request));
      if (
        !validateAgentDecision(decision).valid ||
        !validateConversationInteractionDecision(request, decision).valid
      ) {
        res.status(502).json({ code: "CONVERSATION_INVALID_DECISION", message: "AI 응답 계약이 올바르지 않습니다." });
        return;
      }
      res.status(200).json(decision);
    } catch (error) {
      const timeout = error instanceof Error && error.message === "MODEL_TIMEOUT";
      res.status(timeout ? 504 : 502).json({
        code: timeout ? "CONVERSATION_MODEL_TIMEOUT" : "CONVERSATION_MODEL_ERROR",
        message: "AI 판단을 완료하지 못했습니다.",
      });
    }
  });
  return router;
}

async function withTimeout<T>(operation: Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error("MODEL_TIMEOUT")), MODEL_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
