import type { StructuredAIResponse } from "./aiResponse.types.js";
import {
  assertStructuredAIResponse,
} from "./aiResponse.validator.js";

import {
  sanitizeInternalMessage,
} from "../messages/messageSafety.js";

function removeMarkdownCodeFence(text: string): string {
  const trimmed = text.trim();

  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

export function parseStructuredAIResponse(
  rawText: string,
): StructuredAIResponse {
  const cleanedText = removeMarkdownCodeFence(rawText);

  if (!cleanedText) {
    throw new Error(
      "[AI Engine] Structured AIResponse가 비어 있습니다.",
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(cleanedText);
  } catch {
    throw new Error(
      "[AI Engine] Gemini 응답을 JSON으로 파싱할 수 없습니다.",
    );
  }

  assertStructuredAIResponse(parsed);

  return {
    ...parsed,
    message: sanitizeInternalMessage(
      parsed.message,
    ),
  };
}

export function bindTrustedRequestId(
  response: StructuredAIResponse,
  trustedRequestId: string,
): StructuredAIResponse {
  if (!trustedRequestId.trim()) {
    throw new Error(
      "[AI Engine] C requestId는 비어 있을 수 없습니다.",
    );
  }

  return {
    ...response,
    requestId: trustedRequestId,
  };
}
