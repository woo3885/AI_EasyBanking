import express from "express";

import {
  aiActionRouter,
} from "./aiAction.route.js";
import { createConversationDecisionRouter } from "./conversationDecision.route.js";
import type { ConversationModelPort } from "../conversation/conversationModel.port.js";

export function createServer(conversationModel?: ConversationModelPort) {
  const app = express();

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "OK",
      service: "ai-engine",
    });
  });

  app.use(
    "/api/ai",
    aiActionRouter,
  );
  app.use("/api/ai", createConversationDecisionRouter(conversationModel));

  return app;
}
