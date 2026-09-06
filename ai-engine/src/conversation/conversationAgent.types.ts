import type {
  BackendSanitizedDomSnapshot,
} from "../api/aiRequest.types.js";

export const GOAL_STATUSES = [
  "ACTIVE",
  "CANCELLED",
  "COMPLETED",
  "SUPERSEDED",
] as const;

export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const GOAL_INTENTS = [
  "DEPOSIT",
  "TRANSFER",
  "INQUIRY",
  "CHANGE",
  "UNKNOWN",
] as const;

export type GoalIntent = (typeof GOAL_INTENTS)[number];

export type DurationUnit = "MONTH";
export type RiskState = "NONE" | "WARNING" | "BLOCKED";
export type ConfirmationState =
  | "NONE"
  | "REQUIRED"
  | "APPROVED"
  | "REJECTED";

export interface GoalAmount {
  value: string;
  currency: "KRW";
}

export interface GoalDuration {
  value: number;
  unit: DurationUnit;
}

export interface ConversationUserGoal {
  goalId: string;
  revision: number;
  status: GoalStatus;
  intent: GoalIntent;
  normalizedRequest: string;
  amount: GoalAmount | null;
  duration: GoalDuration | null;
  missingFields: string[];
  pendingQuestion: {
    questionId: string;
    fieldKey: string;
  } | null;
  stage: string;
  safety: {
    secureInputActive: boolean;
    riskState: RiskState;
    confirmationState: ConfirmationState;
  };
  lastAppliedMessageId: string | null;
}

export interface UserGoalPatch {
  basedOnRevision: number;
  intent?: GoalIntent;
  amount?: GoalAmount | null;
  duration?: GoalDuration | null;
  missingFields?: string[];
  pendingQuestionFieldKey?: string | null;
  status?: Exclude<GoalStatus, "COMPLETED">;
}

export const AGENT_MODES = [
  "AUTO_EXECUTE",
  "GUIDE_USER",
  "NAVIGATION_REQUIRED",
  "ASK_USER",
  "SECURE_INPUT_REQUIRED",
  "RISK_WARNING",
  "FINAL_CONFIRMATION_REQUIRED",
  "COMPLETE",
  "STOP",
  "GOAL_PATCH_PROPOSED",
] as const;

export type AgentMode = (typeof AGENT_MODES)[number];

export const CONVERSATION_ACTION_TYPES = [
  "CLICK",
  "TYPE",
  "WAIT_FOR_USER",
] as const;

export type ConversationActionType =
  (typeof CONVERSATION_ACTION_TYPES)[number];

export const SEMANTIC_NAVIGATION_ROUTES = [
  "DEPOSIT_PRODUCTS",
  "TRANSFER_ACCOUNTS",
] as const;

export type SemanticNavigationRoute =
  (typeof SEMANTIC_NAVIGATION_ROUTES)[number];

export const BROWSER_NAVIGATION_MODES = [
  "SPA_PUSH",
  "SPA_REPLACE",
] as const;

export type BrowserNavigationMode =
  (typeof BROWSER_NAVIGATION_MODES)[number];

export interface ConversationNavigationCandidate {
  decisionId: string;
  semanticRoute: SemanticNavigationRoute;
  navigationMode: BrowserNavigationMode;
}

/**
 * B↔C internal target reference. Backend must revalidate elementId against
 * sourceSnapshotId before creating any public targetId or Browser action.
 */
export interface ConversationActionCandidate {
  actionType: ConversationActionType;
  targetElementId: string;
  role: string;
  accessibleLabel: string;
  guide: string;
}

export interface AgentDecision {
  requestId: string;
  requestMessageId: string;
  goalId: string;
  baseGoalRevision: number;
  mode: AgentMode;
  message: string | null;
  confidence: number;
  reasonCode: string;
  nextCondition: string | null;
  sourceSnapshotId: string | null;
  goalPatch: UserGoalPatch | null;
  question: { fieldKey: string } | null;
  actionCandidate: ConversationActionCandidate | null;
  navigationCandidate: ConversationNavigationCandidate | null;
}

export interface ConversationAgentRequest {
  sessionId: string;
  requestId: string;
  requestMessageId: string;
  conversationSequence: number;
  goal: ConversationUserGoal;
  userMessage: {
    content: string;
    answerToQuestionId: string | null;
  };
  snapshot: {
    sourceSnapshotId: string;
    pageIdentity: string;
    sanitizedDomSnapshot: BackendSanitizedDomSnapshot;
  } | null;
}
