import { isConversationSubmissionPending, validateChatMessage } from './chat-message-policy';
import {
  createInitialConversationState,
  SAFE_MESSAGE_SUBMIT_ERROR,
  SAFE_RESPONSE_ERROR,
  type ActiveConversationQuestion,
  type AiQuestionEvent,
  type ConversationAction,
  type ConversationMessage,
  type ConversationServerEvent,
  type ConversationState
} from './conversation-types';
import { overlayTargetFromEvent } from '../api/overlay-contract';
import {
  isProtectedWorkflowStatus,
  shouldClearDraftForStatus
} from './conversation-safety';

const MAX_SEEN_EVENT_IDS = 200;

function hasMessage(messages: ConversationMessage[], messageId: string) {
  return messages.some((message) => message.messageId === messageId);
}

function rememberEvent(state: ConversationState, eventId: string) {
  return [...state.seenEventIds, eventId].slice(-MAX_SEEN_EVENT_IDS);
}

function toActiveQuestion(event: AiQuestionEvent): ActiveConversationQuestion {
  return {
    messageId: event.messageId,
    questionId: event.questionId,
    sequence: event.sequence,
    goalRevision: event.goalRevision,
    text: event.text,
    occurredAt: event.occurredAt
  };
}

function toMessage(event: ConversationServerEvent): ConversationMessage | null {
  if (
    event.eventType === 'USER_MESSAGE_ACCEPTED' ||
    event.eventType === 'OVERLAY_TARGET' ||
    event.eventType === 'OVERLAY_CLEAR' ||
    event.eventType === 'USER_ACTION_OBSERVED' ||
    event.eventType === 'NAVIGATION_REQUIRED' ||
    event.eventType === 'PAGE_READY_OBSERVED' ||
    event.eventType === 'NAVIGATION_CLEAR' ||
    event.eventType === 'PAGE_READY_RESUME_FAILED'
  ) return null;
  if (event.eventType === 'AI_QUESTION') {
    return {
      messageId: event.messageId,
      role: 'AI',
      kind: 'QUESTION',
      sequence: event.sequence,
      text: event.text,
      questionId: event.questionId,
      goalRevision: event.goalRevision,
      occurredAt: event.occurredAt
    };
  }
  return {
    messageId: event.messageId,
    role: 'AI',
    kind: 'MESSAGE',
    sequence: event.sequence,
    text: event.text,
    questionId: null,
    goalRevision: event.goalRevision,
    occurredAt: event.occurredAt
  };
}

function applyServerEvent(state: ConversationState, event: ConversationServerEvent): ConversationState {
  if (
    event.sessionId !== state.sessionId ||
    event.eventSequence <= state.lastEventSequence ||
    state.seenEventIds.includes(event.eventId)
  ) return state;

  const common = {
    lastEventSequence: event.eventSequence,
    seenEventIds: rememberEvent(state, event.eventId),
    safeError: null
  };

  if (event.eventType === 'NAVIGATION_REQUIRED') {
    if (isProtectedWorkflowStatus(state.workflowStatus)) return { ...state, ...common };
    return {
      ...state,
      ...common,
      workflowStatus: 'PAGE_LOADING',
      pendingNavigation: {
        navigationId: event.navigationId,
        browserBindingId: event.browserBindingId,
        sourcePageIdentity: event.sourcePageIdentity,
        destinationPageIdentity: event.destinationPageIdentity,
        destinationRoute: event.destinationRoute,
        routeRevision: event.routeRevision,
        navigationMode: event.navigationMode,
        expiresAt: event.expiresAt,
        guide: event.guide
      },
      observedNavigationId: null,
      activeTarget: null,
      observationPhase: 'IDLE',
      pendingObservation: null
    };
  }

  if (event.eventType === 'PAGE_READY_OBSERVED') {
    const pending = state.pendingNavigation;
    const matches = pending?.navigationId === event.navigationId &&
      pending.browserBindingId === event.browserBindingId &&
      pending.sourcePageIdentity === event.sourcePageIdentity &&
      pending.destinationPageIdentity === event.pageIdentity &&
      pending.routeRevision === event.routeRevision;
    if (!matches) return { ...state, ...common };
    const identityAlreadyRotated = state.pageIdentity === event.pageIdentity;
    return {
      ...state,
      ...common,
      pendingNavigation: identityAlreadyRotated ? null : pending,
      observedNavigationId: identityAlreadyRotated ? null : event.navigationId
    };
  }

  if (event.eventType === 'NAVIGATION_CLEAR') {
    return {
      ...state,
      ...common,
      pendingNavigation: state.pendingNavigation?.navigationId === event.navigationId
        ? null
        : state.pendingNavigation,
      observedNavigationId: state.observedNavigationId === event.navigationId
        ? null
        : state.observedNavigationId
    };
  }

  if (event.eventType === 'PAGE_READY_RESUME_FAILED') {
    return {
      ...state,
      ...common,
      safeError: SAFE_RESPONSE_ERROR,
      pendingNavigation: state.pendingNavigation?.navigationId === event.navigationId
        ? null
        : state.pendingNavigation,
      observedNavigationId: state.observedNavigationId === event.navigationId
        ? null
        : state.observedNavigationId
    };
  }

  if (event.eventType === 'OVERLAY_TARGET') {
    if (state.pageIdentity !== event.pageIdentity) return state;
    if (isProtectedWorkflowStatus(state.workflowStatus) ||
        isProtectedWorkflowStatus(event.workflowStatus)) {
      return { ...state, ...common };
    }
    return {
      ...state,
      ...common,
      workflowStatus: event.workflowStatus,
      activeTarget: overlayTargetFromEvent(event),
      observationPhase: 'IDLE',
      pendingObservation: null
    };
  }

  if (event.eventType === 'OVERLAY_CLEAR') {
    const matches = state.activeTarget?.targetId === event.targetId &&
      state.activeTarget.pageIdentity === event.pageIdentity &&
      state.activeTarget.sourceSnapshotId === event.sourceSnapshotId;
    return {
      ...state,
      ...common,
      activeTarget: matches ? null : state.activeTarget,
      observationPhase: matches ? 'IDLE' : state.observationPhase,
      pendingObservation: matches ? null : state.pendingObservation
    };
  }

  if (event.eventType === 'USER_ACTION_OBSERVED') {
    const matches = state.pendingObservation?.requestId === event.requestId &&
      state.pendingObservation.targetId === event.targetId &&
      state.pendingObservation.pageIdentity === event.pageIdentity &&
      state.pendingObservation.sourceSnapshotId === event.sourceSnapshotId;
    return {
      ...state,
      ...common,
      workflowStatus: matches ? event.workflowStatus : state.workflowStatus,
      activeTarget: matches ? null : state.activeTarget,
      observationPhase: matches ? 'IDLE' : state.observationPhase,
      pendingObservation: matches ? null : state.pendingObservation
    };
  }

  if (event.eventType === 'USER_MESSAGE_ACCEPTED') {
    const protectedState = isProtectedWorkflowStatus(event.workflowStatus);
    return {
      ...state,
      ...common,
      workflowStatus: event.workflowStatus,
      messages: state.messages.map((message) =>
        message.messageId === event.messageId && message.role === 'USER'
          ? { ...message, sequence: event.acceptedSequence }
          : message
      ),
      conversationSequence: Math.max(state.conversationSequence, event.acceptedSequence),
      draft: shouldClearDraftForStatus(event.workflowStatus) ? '' : state.draft,
      activeTarget: protectedState ? null : state.activeTarget,
      observationPhase: protectedState ? 'IDLE' : state.observationPhase,
      pendingObservation: protectedState ? null : state.pendingObservation,
      pendingNavigation: protectedState ? null : state.pendingNavigation,
      observedNavigationId: protectedState ? null : state.observedNavigationId,
      submitPhase: protectedState ? 'IDLE' : 'WAITING_FOR_AI',
      pendingRequestId: protectedState ? null : state.pendingRequestId,
      pendingMessageId: protectedState ? null : state.pendingMessageId
    };
  }

  const message = toMessage(event);
  const messages = message && !hasMessage(state.messages, message.messageId)
    ? [...state.messages, message]
    : state.messages;
  return {
    ...state,
    ...common,
    workflowStatus: event.workflowStatus,
    messages,
    conversationSequence: Math.max(state.conversationSequence, event.sequence),
    goalRevision: Math.max(state.goalRevision, event.goalRevision),
    activeQuestion: event.eventType === 'AI_QUESTION' ? toActiveQuestion(event) : state.activeQuestion,
    draft: shouldClearDraftForStatus(event.workflowStatus) ? '' : state.draft,
    activeTarget: isProtectedWorkflowStatus(event.workflowStatus) ? null : state.activeTarget,
    observationPhase: isProtectedWorkflowStatus(event.workflowStatus) ? 'IDLE' : state.observationPhase,
    pendingObservation: isProtectedWorkflowStatus(event.workflowStatus) ? null : state.pendingObservation,
    pendingNavigation: isProtectedWorkflowStatus(event.workflowStatus) ? null : state.pendingNavigation,
    observedNavigationId: isProtectedWorkflowStatus(event.workflowStatus) ? null : state.observedNavigationId,
    submitPhase: 'IDLE',
    pendingRequestId: null,
    pendingMessageId: null
  };
}

export function conversationReducer(state: ConversationState, action: ConversationAction): ConversationState {
  switch (action.type) {
    case 'DRAFT_CHANGED':
      if (isProtectedWorkflowStatus(state.workflowStatus)) return state;
      return {
        ...state,
        draft: action.draft,
        submitPhase: state.submitPhase === 'ERROR' ? 'IDLE' : state.submitPhase,
        safeError: null
      };
    case 'SESSION_ASSIGNED':
      return state.sessionId && state.sessionId !== action.sessionId
        ? { ...createInitialConversationState(state.connectionPhase), sessionId: action.sessionId }
        : { ...state, sessionId: action.sessionId };
    case 'MESSAGE_SUBMIT_STARTED': {
      if (isProtectedWorkflowStatus(state.workflowStatus) ||
          (state.sessionId !== null && state.connectionPhase !== 'CONNECTED')) return state;
      const validation = validateChatMessage(action.message.text, {
        isSubmissionPending: isConversationSubmissionPending(state.submitPhase)
      });
      if (
        !validation.isValid ||
        action.message.role !== 'USER' ||
        action.message.kind !== 'MESSAGE' ||
        action.message.sequence !== null ||
        hasMessage(state.messages, action.message.messageId)
      ) return state;
      return {
        ...state,
        messages: [...state.messages, { ...action.message, text: validation.normalizedMessage }],
        draft: '',
        submitPhase: 'SUBMITTING',
        pendingRequestId: action.requestId,
        pendingMessageId: action.message.messageId,
        safeError: null
      };
    }
    case 'MESSAGE_SUBMIT_DISPATCHED':
      return state.pendingRequestId === action.requestId && state.submitPhase === 'SUBMITTING'
        ? { ...state, submitPhase: 'WAITING_FOR_ACK' }
        : state;
    case 'MESSAGE_ACKNOWLEDGED':
      if ((state.submitPhase !== 'SUBMITTING' && state.submitPhase !== 'WAITING_FOR_ACK') ||
          state.pendingRequestId !== action.requestId || state.pendingMessageId !== action.messageId) return state;
      return {
        ...state,
        messages: state.messages.map((message) =>
          message.messageId === action.messageId ? { ...message, sequence: action.acceptedSequence } : message
        ),
        conversationSequence: Math.max(state.conversationSequence, action.acceptedSequence),
        submitPhase: 'WAITING_FOR_AI',
        safeError: null
      };
    case 'SERVER_EVENT_RECEIVED':
      return applyServerEvent(state, action.event);
    case 'MESSAGE_SUBMIT_FAILED':
      if (state.pendingRequestId !== action.requestId) return state;
      return {
        ...state,
        submitPhase: 'ERROR',
        pendingRequestId: null,
        pendingMessageId: null,
        safeError: SAFE_MESSAGE_SUBMIT_ERROR
      };
    case 'SAFE_ERROR_SET':
      return { ...state, safeError: action.error };
    case 'SNAPSHOT_RESTORED': {
      const snapshot = action.snapshot;
      if (snapshot.sessionId !== state.sessionId || snapshot.eventSequence < state.lastEventSequence) return state;
      if (
        snapshot.eventSequence === state.lastEventSequence &&
        (snapshot.conversationSequence < state.conversationSequence || snapshot.goalRevision < state.goalRevision)
      ) return state;
      const byId = new Map<string, ConversationMessage>();
      for (const message of snapshot.recentSafeMessages) {
        if (message.messageId && message.sequence !== null) byId.set(message.messageId, message);
      }
      for (const message of state.messages) {
        if (message.sequence === null && !byId.has(message.messageId)) byId.set(message.messageId, message);
      }
      return {
        ...state,
        messages: [...byId.values()].sort(
          (left, right) => (left.sequence ?? Number.MAX_SAFE_INTEGER) - (right.sequence ?? Number.MAX_SAFE_INTEGER)
        ),
        lastEventSequence: snapshot.eventSequence,
        conversationSequence: snapshot.conversationSequence,
        goalRevision: snapshot.goalRevision,
        activeQuestion: snapshot.activeQuestion,
        draft: shouldClearDraftForStatus(snapshot.workflowStatus) ? '' : state.draft,
        activeTarget: isProtectedWorkflowStatus(snapshot.workflowStatus) ? null : state.activeTarget,
        observationPhase: isProtectedWorkflowStatus(snapshot.workflowStatus) ? 'IDLE' : state.observationPhase,
        pendingObservation: isProtectedWorkflowStatus(snapshot.workflowStatus) ? null : state.pendingObservation,
        pendingNavigation: isProtectedWorkflowStatus(snapshot.workflowStatus) ? null : state.pendingNavigation,
        observedNavigationId: isProtectedWorkflowStatus(snapshot.workflowStatus) ? null : state.observedNavigationId,
        workflowStatus: snapshot.workflowStatus,
        submitPhase: isProtectedWorkflowStatus(snapshot.workflowStatus)
          ? 'IDLE'
          : snapshot.activeQuestion || snapshot.recentSafeMessages.some((message) => message.role === 'AI')
          ? 'IDLE'
          : state.submitPhase,
        pendingRequestId: isProtectedWorkflowStatus(snapshot.workflowStatus) ? null : state.pendingRequestId,
        pendingMessageId: isProtectedWorkflowStatus(snapshot.workflowStatus) ? null : state.pendingMessageId,
        safeError: null
      };
    }
    case 'BRIDGE_RECOVERED':
      return {
        ...state,
        pageIdentity: action.pageIdentity,
        activeTarget: isProtectedWorkflowStatus(state.workflowStatus) ? null : action.activeTarget,
        observationPhase: 'IDLE',
        pendingObservation: null
      };
    case 'PAGE_READY_ACKNOWLEDGED':
      if (state.pendingNavigation?.navigationId !== action.navigationId ||
          state.pendingNavigation.destinationPageIdentity !== action.pageIdentity) return state;
      return {
        ...state,
        pageIdentity: action.pageIdentity,
        pendingNavigation: state.observedNavigationId === action.navigationId
          ? null
          : state.pendingNavigation,
        observedNavigationId: state.observedNavigationId === action.navigationId
          ? null
          : state.observedNavigationId,
        activeTarget: null,
        observationPhase: 'IDLE',
        pendingObservation: null
      };
    case 'OVERLAY_CLEARED_LOCAL':
      return {
        ...state,
        activeTarget: null,
        observationPhase: 'IDLE',
        pendingObservation: null
      };
    case 'OBSERVATION_STARTED':
      if (isProtectedWorkflowStatus(state.workflowStatus) || state.connectionPhase !== 'CONNECTED' ||
          !state.activeTarget || state.observationPhase !== 'IDLE' ||
          state.activeTarget.targetId !== action.observation.targetId ||
          state.activeTarget.pageIdentity !== action.observation.pageIdentity ||
          state.activeTarget.sourceSnapshotId !== action.observation.sourceSnapshotId) return state;
      return { ...state, observationPhase: 'SUBMITTING', pendingObservation: action.observation };
    case 'OBSERVATION_ACKNOWLEDGED':
      return state.pendingObservation?.requestId === action.requestId &&
        state.pendingObservation.targetId === action.targetId
        ? { ...state, observationPhase: 'WAITING_FOR_RESULT' }
        : state;
    case 'OBSERVATION_FAILED':
      return state.pendingObservation?.requestId === action.requestId
        ? { ...state, observationPhase: 'ERROR', pendingObservation: null }
        : state;
    case 'PROTECTION_ENFORCED':
      if (!state.activeTarget && !state.pendingObservation && !state.pendingNavigation &&
          !state.observedNavigationId &&
          state.observationPhase === 'IDLE' && !state.pendingRequestId &&
          !state.pendingMessageId && state.submitPhase === 'IDLE' &&
          (!action.clearDraft || !state.draft)) return state;
      return {
        ...state,
        draft: action.clearDraft ? '' : state.draft,
        submitPhase: 'IDLE',
        pendingRequestId: null,
        pendingMessageId: null,
        activeTarget: null,
        observationPhase: 'IDLE',
        pendingObservation: null,
        pendingNavigation: null,
        observedNavigationId: null
      };
    case 'CONNECTION_CHANGED':
      return action.connectionPhase === 'CONNECTED' || action.connectionPhase === 'CONNECTING'
        ? { ...state, connectionPhase: action.connectionPhase }
        : {
            ...state,
            connectionPhase: action.connectionPhase,
            submitPhase: 'IDLE',
            pendingRequestId: null,
            pendingMessageId: null,
            activeTarget: null,
            observationPhase: 'IDLE',
            pendingObservation: null,
            pendingNavigation: null,
            observedNavigationId: null
          };
    case 'CONVERSATION_RESET':
      return createInitialConversationState(state.connectionPhase);
    default:
      return state;
  }
}
