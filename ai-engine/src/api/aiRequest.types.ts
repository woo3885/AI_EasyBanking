import type {
  UserDecisionContext,
} from "../workflow/userDecisionContext.store.js";

import type {
  UserDecisionType,
} from "../workflow/userDecision.types.js";

export type BackendSecurityPolicy =
  | "NORMAL"
  | "USER_DECISION"
  | "SECURE_INPUT"
  | "FINAL_CONFIRMATION"
  | "BLOCKED";

export interface BackendBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BackendSanitizedDomElement {
  elementId: string;

  tag: string;

  role: string | null;

  text: string | null;

  ariaLabel: string | null;

  placeholder: string | null;

  inputType: string | null;

  visible: boolean;

  enabled: boolean;

  checked: boolean | null;

  boundingBox: BackendBoundingBox | null;

  securityPolicy: BackendSecurityPolicy;
}

export interface BackendSanitizedDomSnapshot {
  schemaVersion: string;

  snapshotId: string;

  page: {
    url: string;
    title: string;
    productId: string | null;
    productName: string | null;
    productPeriod: string | null;
    /** Backend-owned D27 final-summary context; never model-authored. */
    depositAmount?: string | null;
  };

  elements: BackendSanitizedDomElement[];
}

export interface BackendAiUserDecisionContext {
  decisionId: string;

  decisionType: UserDecisionType;

  selectedOptionIds: readonly string[];

  sourceSnapshotId: string;
}

/**
 * B Backend -> C AI Engine HTTP 요청 계약
 *
 * Java:
 * AiDecisionRequest(
 *   String userRequest,
 *   SanitizedDomSnapshot snapshot,
 *   AiUserDecisionContext userDecision
 * )
 */
export interface BackendAiDecisionRequest {
  userRequest: string;

  snapshot: BackendSanitizedDomSnapshot;

  userDecision?: BackendAiUserDecisionContext;
}

/**
 * C 내부 Structured Action Service에서 사용하는 요청 형태.
 *
 * Backend HTTP 계약과 AI Engine 내부 계약을 분리한다.
 */
export interface AiActionRequest {
  requestId: string;

  userGoal: {
    rawMessage: string;
    intent: string;
    amount?: number;
    recipient?: string;
    duration?: {
      value: number;
      unit: string;
    };
    conditions?: string[];
  };

  domSnapshot: BackendSanitizedDomSnapshot;

  /**
   * Backend-verified selection context for the current Production decision.
   * Backend remains the resume orchestrator and authoritative state owner.
   */
  userDecisionContext?: UserDecisionContext;
}
