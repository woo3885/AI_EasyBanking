export interface PromptElement {
  id: string;
  tag: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PromptContext {
  userRequest: string;
  currentUrl: string;
  pageTitle?: string;
  pageText?: string;
  clickableElements: PromptElement[];
}

export type AiDecisionType =
  | "GUIDE"
  | "EXECUTE"
  | "ASK_CONFIRMATION"
  | "ASK_CLARIFICATION"
  | "BLOCK";

export interface AiDecision {
  decision: AiDecisionType;
  intent: string;
  targetElementId?: string;
  action?: "CLICK" | "INPUT" | "SCROLL" | "BACK";
  guideMessage: string;
  reason: string;
  requiresConfirmation: boolean;
}