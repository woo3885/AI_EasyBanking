import type {
  NextActionType,
} from "../actions/nextAction.types.js";

export type GuidanceMessageTone =
  | "INFORMATION"
  | "CONFIRMATION"
  | "WARNING"
  | "COMPLETED";

export interface GuidanceMessageInput {
  action: NextActionType;
  targetLabel?: string;
  inputValue?: string;
  requiresConfirmation?: boolean;
  blocked?: boolean;
}

export interface GuidanceMessageResult {
  message: string;
  tone: GuidanceMessageTone;
  ttsReady: boolean;
  characterCount: number;
}