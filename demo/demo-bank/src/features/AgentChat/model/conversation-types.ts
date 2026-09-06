import type {
  OverlayActionMode,
  OverlayClearReason,
  OverlayCoordinateSpace,
  OverlayObservationPhase,
  OverlayRectangle,
  OverlayViewport,
  PendingOverlayObservation,
  PublicOverlayTarget
} from './overlay-types';
import type { PendingBrowserNavigation } from './navigation-types';

export type ConversationRole = 'USER' | 'AI';
export type ConversationMessageKind = 'MESSAGE' | 'QUESTION' | 'STATUS' | 'WARNING';

export type ConversationWorkflowStatus =
  | 'SESSION_CREATED'
  | 'PAGE_LOADING'
  | 'AI_EXECUTING'
  | 'USER_DECISION_REQUIRED'
  | 'ADDITIONAL_INFORMATION_REQUIRED'
  | 'SECURE_INPUT_REQUIRED'
  | 'RISK_WARNING'
  | 'FINAL_CONFIRMATION_REQUIRED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ERROR'
  | 'TERMINATED';

interface ConversationMessageBase {
  messageId: string;
  requestId?: string | null;
  role: ConversationRole;
  sequence: number | null;
  text: string;
  goalRevision: number | null;
  occurredAt: string;
}

export interface ConversationQuestionMessage extends ConversationMessageBase {
  role: 'AI';
  kind: 'QUESTION';
  questionId: string;
}

export interface ConversationNonQuestionMessage extends ConversationMessageBase {
  kind: Exclude<ConversationMessageKind, 'QUESTION'>;
  questionId: null;
}

export type ConversationMessage = ConversationQuestionMessage | ConversationNonQuestionMessage;

export interface ActiveConversationQuestion {
  messageId: string;
  questionId: string;
  sequence: number;
  goalRevision: number;
  text: string;
  occurredAt: string;
}

export type ConversationSubmitPhase =
  | 'IDLE'
  | 'SUBMITTING'
  | 'WAITING_FOR_ACK'
  | 'WAITING_FOR_AI'
  | 'ERROR';

export type ConversationConnectionPhase =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'ERROR';

export type ConversationSafeError =
  | '요청을 전송하지 못했습니다. 잠시 후 다시 시도해 주세요.'
  | '대화 연결을 확인하지 못했습니다. 다시 연결해 주세요.'
  | '안전하지 않은 응답을 차단했습니다. 다시 시도해 주세요.'
  | '비밀번호나 인증번호는 채팅에 입력할 수 없습니다.';

export const SAFE_MESSAGE_SUBMIT_ERROR: ConversationSafeError =
  '요청을 전송하지 못했습니다. 잠시 후 다시 시도해 주세요.';
export const SAFE_CONNECTION_ERROR: ConversationSafeError =
  '대화 연결을 확인하지 못했습니다. 다시 연결해 주세요.';
export const SAFE_RESPONSE_ERROR: ConversationSafeError =
  '안전하지 않은 응답을 차단했습니다. 다시 시도해 주세요.';

export interface ConversationState {
  sessionId: string | null;
  messages: ConversationMessage[];
  lastEventSequence: number;
  conversationSequence: number;
  goalRevision: number;
  seenEventIds: string[];
  activeQuestion: ActiveConversationQuestion | null;
  workflowStatus: ConversationWorkflowStatus;
  draft: string;
  submitPhase: ConversationSubmitPhase;
  pendingRequestId: string | null;
  pendingMessageId: string | null;
  safeError: ConversationSafeError | null;
  connectionPhase: ConversationConnectionPhase;
  pageIdentity: string | null;
  activeTarget: PublicOverlayTarget | null;
  observationPhase: OverlayObservationPhase;
  pendingObservation: PendingOverlayObservation | null;
  pendingNavigation: PendingBrowserNavigation | null;
  observedNavigationId: string | null;
}

export interface ConversationSnapshot {
  snapshotId: string;
  sessionId: string;
  eventSequence: number;
  conversationSequence: number;
  goalRevision: number;
  userGoal: Record<string, unknown>;
  activeQuestion: ActiveConversationQuestion | null;
  recentSafeMessages: ConversationMessage[];
  workflowStatus: ConversationWorkflowStatus;
  expiresAt: string;
}

interface ConversationEventBase {
  eventId: string;
  eventSequence: number;
  sessionId: string;
  workflowStatus: ConversationWorkflowStatus;
  occurredAt: string;
}

export interface UserMessageAcceptedEvent extends ConversationEventBase {
  eventType: 'USER_MESSAGE_ACCEPTED';
  messageId: string;
  acceptedSequence: number;
}

export interface AiQuestionEvent extends ConversationEventBase {
  eventType: 'AI_QUESTION';
  messageId: string;
  sequence: number;
  questionId: string;
  text: string;
  kind: 'QUESTION';
  goalRevision: number;
}

export interface AiMessageEvent extends ConversationEventBase {
  eventType: 'AI_MESSAGE';
  messageId: string;
  sequence: number;
  text: string;
  kind: 'MESSAGE';
  goalRevision: number;
  errorCode: string | null;
}

export interface OverlayTargetEvent extends ConversationEventBase {
  eventType: 'OVERLAY_TARGET';
  workflowStatus: 'USER_DECISION_REQUIRED';
  targetId: string;
  pageIdentity: string;
  sourceSnapshotId: string;
  coordinateSpace: OverlayCoordinateSpace;
  rectangle: OverlayRectangle;
  viewport: OverlayViewport;
  role: string;
  label: string;
  guide: string;
  actionMode: OverlayActionMode;
  expiresAt: string;
}

export interface OverlayClearEvent {
  eventId: string;
  eventSequence: number;
  eventType: 'OVERLAY_CLEAR';
  sessionId: string;
  targetId: string;
  pageIdentity: string;
  sourceSnapshotId: string;
  reason: OverlayClearReason;
  occurredAt: string;
}

export interface UserActionObservedEvent extends ConversationEventBase {
  eventType: 'USER_ACTION_OBSERVED';
  workflowStatus: 'AI_EXECUTING';
  observationId: string;
  requestId: string;
  targetId: string;
  pageIdentity: string;
  sourceSnapshotId: string;
  resultingSnapshotId: string;
  status: 'DOM_CHANGE_CONFIRMED';
}

export interface NavigationRequiredEvent extends PendingBrowserNavigation {
  eventId: string;
  eventSequence: number;
  eventType: 'NAVIGATION_REQUIRED';
  sessionId: string;
  occurredAt: string;
}

export interface PageReadyObservedEvent {
  eventId: string;
  eventSequence: number;
  eventType: 'PAGE_READY_OBSERVED';
  sessionId: string;
  navigationId: string;
  browserBindingId: string;
  sourcePageIdentity: string;
  pageIdentity: string;
  routeRevision: number;
  occurredAt: string;
}

export interface NavigationClearEvent {
  eventId: string;
  eventSequence: number;
  eventType: 'NAVIGATION_CLEAR';
  sessionId: string;
  navigationId: string;
  browserBindingId: string;
  sourcePageIdentity: string;
  destinationPageIdentity: string;
  routeRevision: number;
  reason: string;
  occurredAt: string;
}

export interface PageReadyResumeFailedEvent {
  eventId: string;
  eventSequence: number;
  eventType: 'PAGE_READY_RESUME_FAILED';
  sessionId: string;
  navigationId: string;
  errorCode:
    | 'PAGE_READY_RESUME_FAILED'
    | 'DESTINATION_SNAPSHOT_FAILED'
    | 'OVERLAY_TARGET_NOT_FOUND'
    | 'OVERLAY_TARGET_AMBIGUOUS'
    | 'OVERLAY_TARGET_STALE_SNAPSHOT'
    | 'OVERLAY_TARGET_POLICY_MISMATCH';
  message: string;
  occurredAt: string;
}

export type ConversationServerEvent =
  | UserMessageAcceptedEvent
  | AiQuestionEvent
  | AiMessageEvent
  | OverlayTargetEvent
  | OverlayClearEvent
  | UserActionObservedEvent
  | NavigationRequiredEvent
  | PageReadyObservedEvent
  | NavigationClearEvent
  | PageReadyResumeFailedEvent;

export type ConversationAction =
  | { type: 'DRAFT_CHANGED'; draft: string }
  | { type: 'SESSION_ASSIGNED'; sessionId: string }
  | { type: 'MESSAGE_SUBMIT_STARTED'; requestId: string; message: ConversationMessage }
  | { type: 'MESSAGE_SUBMIT_DISPATCHED'; requestId: string }
  | { type: 'MESSAGE_ACKNOWLEDGED'; requestId: string; messageId: string; acceptedSequence: number }
  | { type: 'SERVER_EVENT_RECEIVED'; event: ConversationServerEvent }
  | { type: 'MESSAGE_SUBMIT_FAILED'; requestId: string }
  | { type: 'SAFE_ERROR_SET'; error: ConversationSafeError }
  | { type: 'SNAPSHOT_RESTORED'; snapshot: ConversationSnapshot }
  | { type: 'BRIDGE_RECOVERED'; pageIdentity: string; activeTarget: PublicOverlayTarget | null }
  | { type: 'PAGE_READY_ACKNOWLEDGED'; navigationId: string; pageIdentity: string }
  | { type: 'OVERLAY_CLEARED_LOCAL' }
  | { type: 'OBSERVATION_STARTED'; observation: PendingOverlayObservation }
  | { type: 'OBSERVATION_ACKNOWLEDGED'; requestId: string; targetId: string }
  | { type: 'OBSERVATION_FAILED'; requestId: string }
  | { type: 'PROTECTION_ENFORCED'; clearDraft: boolean }
  | { type: 'CONNECTION_CHANGED'; connectionPhase: ConversationConnectionPhase }
  | { type: 'CONVERSATION_RESET' };

export function createInitialConversationState(
  connectionPhase: ConversationConnectionPhase = 'DISCONNECTED'
): ConversationState {
  return {
    sessionId: null,
    messages: [],
    lastEventSequence: 0,
    conversationSequence: 0,
    goalRevision: 0,
    seenEventIds: [],
    activeQuestion: null,
    workflowStatus: 'SESSION_CREATED',
    draft: '',
    submitPhase: 'IDLE',
    pendingRequestId: null,
    pendingMessageId: null,
    safeError: null,
    connectionPhase,
    pageIdentity: null,
    activeTarget: null,
    observationPhase: 'IDLE',
    pendingObservation: null,
    pendingNavigation: null,
    observedNavigationId: null
  };
}
