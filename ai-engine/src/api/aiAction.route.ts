import { Router } from "express";

import {
  generateStructuredAction,
} from "../services/structuredAction.service.js";

import {
  adaptBackendRequestToAiActionRequest,
} from "./aiDecisionRequest.adapter.js";

import {
  adaptStructuredResponseToBackend,
} from "./aiDecisionResponse.adapter.js";

import type {
  AiActionRequest,
} from "./aiRequest.types.js";

import type {
  StructuredAIResponse,
} from "../output/aiResponse.types.js";

export type AiActionGenerator = (
  request: AiActionRequest,
) => Promise<StructuredAIResponse>;

export function createAiActionRouter(
  generateAction: AiActionGenerator =
    generateStructuredAction,
) {
  const router = Router();

  router.post(
    "/action",

    async (req, res) => {
      try {
        const internalRequest =
          adaptBackendRequestToAiActionRequest(
            req.body,
          );

        const structuredResponse =
          await generateAction(
            internalRequest,
          );

        const backendResponse =
          adaptStructuredResponseToBackend(
            structuredResponse,
            internalRequest.domSnapshot.snapshotId,
          );

        res
          .status(200)
          .json(backendResponse);
      } catch {
        console.error(
          "[AI Engine] /action request failed.",
        );

        res.status(500).json({
          message:
            "AI Action 처리 중 오류가 발생했습니다.",
        });
      }
    },
  );

  return router;
}

export const aiActionRouter =
  createAiActionRouter();
