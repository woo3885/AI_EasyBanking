import { createHash } from "node:crypto";

import type {
  BrowserNavigationMode,
  ConversationAgentRequest,
  SemanticNavigationRoute,
} from "./conversationAgent.types.js";

/** Stable identity for Backend deduplication; excludes time and randomness. */
export function createNavigationDecisionId(
  input: ConversationAgentRequest,
  semanticRoute: SemanticNavigationRoute,
  navigationMode: BrowserNavigationMode,
): string {
  const canonicalMaterial = JSON.stringify([
    input.requestMessageId,
    input.goal.goalId,
    input.goal.revision,
    input.snapshot?.sourceSnapshotId ?? null,
    "NAVIGATION_REQUIRED",
    semanticRoute,
    navigationMode,
  ]);
  const digest = createHash("sha256")
    .update(canonicalMaterial, "utf8")
    .digest("hex");
  return `navdec_${digest}`;
}
