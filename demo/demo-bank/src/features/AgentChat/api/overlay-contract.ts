import type {
  ConversationBridgeRecovery,
  DemoAgentBridgeBinding,
  InteractionObservationAccepted,
  OverlayMaterializationMode,
  PublicOverlayTarget,
  PublicTargetLocator
} from '../model/overlay-types';
import type {
  OverlayClearEvent,
  OverlayTargetEvent,
  UserActionObservedEvent
} from '../model/conversation-types';
import { parseBrowserBridgeBinding } from './navigation-contract';

const TARGET_ROLES = new Set(['button', 'link', 'radio', 'checkbox', 'option']);
const CLEAR_REASONS = new Set([
  'REPLACED', 'EXPIRED', 'NAVIGATION', 'SNAPSHOT_CHANGED', 'USER_ACTION',
  'RECONNECT', 'SECURE_INPUT', 'RISK_WARNING', 'FINAL_CONFIRMATION',
  'SESSION_TERMINATED', 'TARGET_INVALID'
]);
const CONTROL_OR_HTML = /[\u0000-\u001F\u007F<>]/u;
const RAW_ACCOUNT_NUMBER = /\b\d{2,4}-\d{2,6}-\d{2,6}\b/u;
const RAW_CREDENTIAL = /(?:비밀번호|password|otp|pin|인증\s*(?:번호|코드))\s*[:=]\s*\S+/iu;
const PROTOCOL_IDENTIFIER = /^[A-Za-z0-9._:-]+$/u;
const PUBLIC_TARGET_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const FORBIDDEN_PUBLIC_TARGET_TOKENS = new Set([
  'session', 'element', 'selector', 'xpath', 'password', 'otp', 'pin', 'token'
]);

export interface OverlayParseContext {
  sessionId: string;
  pageIdentity: string;
  viewport: { width: number; height: number };
  now?: number;
  materializationMode?: OverlayMaterializationMode;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key)) &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

/** User-facing text policy. Protocol identifiers intentionally do not use this policy. */
function safeUserText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim() === value && value.length > 0 &&
    Array.from(value).length <= max && !CONTROL_OR_HTML.test(value) &&
    !RAW_ACCOUNT_NUMBER.test(value) && !RAW_CREDENTIAL.test(value);
}

/** Syntax-only validation for opaque protocol identities such as UUIDs. */
export function isProtocolIdentifier(value: unknown, max = 128): value is string {
  return typeof value === 'string' && value.trim() === value && value.length > 0 &&
    Array.from(value).length <= max && PROTOCOL_IDENTIFIER.test(value);
}

export function isPublicTargetKey(value: unknown): value is string {
  if (typeof value !== 'string' || Array.from(value).length > 96 ||
      !PUBLIC_TARGET_KEY.test(value)) return false;
  return value.split('-').every((token) => !FORBIDDEN_PUBLIC_TARGET_TOKENS.has(token));
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function timestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 64 &&
    Number.isFinite(Date.parse(value));
}

function eventIdentity(item: Record<string, unknown>) {
  return isProtocolIdentifier(item.eventId) && Number.isSafeInteger(item.eventSequence) &&
    Number(item.eventSequence) > 0 && isProtocolIdentifier(item.sessionId) && timestamp(item.occurredAt);
}

function parseRectangle(value: unknown) {
  const item = record(value);
  if (!item || !exactKeys(item, ['x', 'y', 'width', 'height']) ||
      !finite(item.x) || !finite(item.y) || !finite(item.width) || !finite(item.height)) return null;
  if (item.width <= 0 || item.height <= 0) return null;
  return { x: item.x, y: item.y, width: item.width, height: item.height };
}

function parseViewport(value: unknown) {
  const item = record(value);
  if (!item || !exactKeys(item, ['width', 'height']) ||
      !finite(item.width) || !finite(item.height) || item.width <= 0 || item.height <= 0) return null;
  return { width: item.width, height: item.height };
}

function parsePublicTargetLocator(value: unknown): PublicTargetLocator | null {
  const item = record(value);
  if (!item || !exactKeys(item, ['type', 'publicTargetKey', 'role', 'accessibleName']) ||
      item.type !== 'PUBLIC_TARGET_KEY' || !isPublicTargetKey(item.publicTargetKey) ||
      typeof item.role !== 'string' || !TARGET_ROLES.has(item.role) ||
      !safeUserText(item.accessibleName, 120)) return null;
  return item as unknown as PublicTargetLocator;
}

function legacyGeometryIsValid(target: PublicOverlayTarget, context: OverlayParseContext) {
  const { rectangle, viewport } = target;
  return Math.abs(viewport.width - context.viewport.width) <= 1 &&
    Math.abs(viewport.height - context.viewport.height) <= 1 &&
    rectangle.x >= -rectangle.width && rectangle.y >= -rectangle.height &&
    rectangle.x <= viewport.width && rectangle.y <= viewport.height;
}

const TARGET_KEYS_V1 = [
  'contractVersion', 'materializationMode', 'targetId', 'sessionId', 'pageIdentity',
  'sourceSnapshotId', 'coordinateSpace', 'rectangle', 'viewport', 'role', 'label',
  'guide', 'actionMode', 'createdAt', 'expiresAt', 'consumedAt'
] as const;
const TARGET_KEYS_V2 = [...TARGET_KEYS_V1, 'locator'] as const;

export function parsePublicOverlayTarget(
  payload: unknown,
  context: OverlayParseContext
): PublicOverlayTarget | null {
  const item = record(payload);
  const expectedMode = context.materializationMode ?? 'USER_DOM_PUBLIC_TARGET';
  const isV2 = item?.contractVersion === 2 &&
    item.materializationMode === 'USER_DOM_PUBLIC_TARGET';
  const isV1 = item?.contractVersion === 1 &&
    item.materializationMode === 'BACKEND_VIEWPORT_RECT';
  if (!item || (isV2 ? !exactKeys(item, TARGET_KEYS_V2) : !exactKeys(item, TARGET_KEYS_V1)) ||
      (expectedMode === 'USER_DOM_PUBLIC_TARGET' ? !isV2 : !isV1)) return null;

  const rectangle = parseRectangle(item.rectangle);
  const viewport = parseViewport(item.viewport);
  const locator = isV2 ? parsePublicTargetLocator(item.locator) : null;
  if (!rectangle || !viewport || !isProtocolIdentifier(item.targetId) ||
      item.sessionId !== context.sessionId || item.pageIdentity !== context.pageIdentity ||
      !isProtocolIdentifier(item.sourceSnapshotId) || item.coordinateSpace !== 'VIEWPORT_CSS_PX' ||
      item.actionMode !== 'GUIDE_USER_CLICK' || typeof item.role !== 'string' ||
      !TARGET_ROLES.has(item.role) || !safeUserText(item.label, 120) ||
      !safeUserText(item.guide, 200) || !timestamp(item.createdAt) ||
      !timestamp(item.expiresAt) || item.consumedAt !== null ||
      (isV2 && (!locator || locator.role !== item.role || locator.accessibleName !== item.label))) return null;

  const target: PublicOverlayTarget = {
    contractVersion: isV2 ? 2 : 1,
    materializationMode: isV2 ? 'USER_DOM_PUBLIC_TARGET' : 'BACKEND_VIEWPORT_RECT',
    targetId: item.targetId,
    sessionId: item.sessionId,
    pageIdentity: item.pageIdentity,
    sourceSnapshotId: item.sourceSnapshotId,
    coordinateSpace: 'VIEWPORT_CSS_PX', rectangle, viewport, role: item.role,
    label: item.label, guide: item.guide, locator,
    actionMode: 'GUIDE_USER_CLICK', createdAt: item.createdAt,
    expiresAt: item.expiresAt, consumedAt: null
  };
  const now = context.now ?? Date.now();
  if (Date.parse(target.expiresAt) <= now ||
      Date.parse(target.expiresAt) <= Date.parse(target.createdAt) ||
      (isV1 && !legacyGeometryIsValid(target, context))) return null;
  return target;
}

const OVERLAY_EVENT_KEYS_V1 = [
  'eventId', 'eventSequence', 'eventType', 'sessionId', 'workflowStatus',
  'targetId', 'pageIdentity', 'contractVersion', 'materializationMode',
  'sourceSnapshotId', 'coordinateSpace', 'rectangle', 'viewport', 'role', 'label',
  'guide', 'actionMode', 'expiresAt', 'occurredAt'
] as const;
const OVERLAY_EVENT_KEYS_V2 = [...OVERLAY_EVENT_KEYS_V1, 'locator'] as const;

export function parseOverlayTargetEvent(payload: unknown, context: OverlayParseContext): OverlayTargetEvent | null {
  const item = record(payload);
  const isV2 = item?.contractVersion === 2;
  if (!item || !exactKeys(item, isV2 ? OVERLAY_EVENT_KEYS_V2 : OVERLAY_EVENT_KEYS_V1) ||
      !eventIdentity(item) || item.eventType !== 'OVERLAY_TARGET' ||
      item.workflowStatus !== 'USER_DECISION_REQUIRED') return null;
  const target = parsePublicOverlayTarget({
    contractVersion: item.contractVersion, materializationMode: item.materializationMode,
    targetId: item.targetId, sessionId: item.sessionId, pageIdentity: item.pageIdentity,
    sourceSnapshotId: item.sourceSnapshotId, coordinateSpace: item.coordinateSpace,
    rectangle: item.rectangle, viewport: item.viewport, role: item.role, label: item.label,
    guide: item.guide, ...(isV2 ? { locator: item.locator } : {}),
    actionMode: item.actionMode, createdAt: item.occurredAt,
    expiresAt: item.expiresAt, consumedAt: null
  }, context);
  return target ? {
    eventId: item.eventId as string, eventSequence: item.eventSequence as number,
    eventType: 'OVERLAY_TARGET', sessionId: target.sessionId,
    workflowStatus: 'USER_DECISION_REQUIRED', contractVersion: target.contractVersion,
    materializationMode: target.materializationMode, targetId: target.targetId,
    pageIdentity: target.pageIdentity, sourceSnapshotId: target.sourceSnapshotId,
    coordinateSpace: target.coordinateSpace, rectangle: target.rectangle,
    viewport: target.viewport, role: target.role, label: target.label, guide: target.guide,
    locator: target.locator, actionMode: target.actionMode, expiresAt: target.expiresAt,
    occurredAt: item.occurredAt as string
  } : null;
}

export function overlayTargetFromEvent(event: OverlayTargetEvent): PublicOverlayTarget {
  return { ...event, createdAt: event.occurredAt, consumedAt: null };
}

function requiresUserDomTarget(context: Pick<OverlayParseContext, 'materializationMode'>) {
  return (context.materializationMode ?? 'USER_DOM_PUBLIC_TARGET') === 'USER_DOM_PUBLIC_TARGET';
}

export function parseOverlayClearEvent(
  payload: unknown,
  context: Pick<OverlayParseContext, 'sessionId' | 'pageIdentity' | 'materializationMode'>
): OverlayClearEvent | null {
  const item = record(payload);
  const keys = ['eventId', 'eventSequence', 'eventType', 'sessionId', 'targetId',
    'pageIdentity', 'sourceSnapshotId', 'publicTargetKey', 'reason', 'occurredAt'] as const;
  if (!item || !exactKeys(item, keys) || !eventIdentity(item) || item.eventType !== 'OVERLAY_CLEAR' ||
      item.sessionId !== context.sessionId || item.pageIdentity !== context.pageIdentity ||
      !isProtocolIdentifier(item.targetId) || !isProtocolIdentifier(item.sourceSnapshotId) ||
      (requiresUserDomTarget(context) ? !isPublicTargetKey(item.publicTargetKey) : item.publicTargetKey !== null) ||
      typeof item.reason !== 'string' || !CLEAR_REASONS.has(item.reason)) return null;
  return item as unknown as OverlayClearEvent;
}

export function parseUserActionObservedEvent(
  payload: unknown,
  context: Pick<OverlayParseContext, 'sessionId' | 'pageIdentity' | 'materializationMode'>
): UserActionObservedEvent | null {
  const item = record(payload);
  const keys = ['eventId', 'eventSequence', 'eventType', 'sessionId', 'workflowStatus',
    'observationId', 'requestId', 'targetId', 'pageIdentity', 'sourceSnapshotId',
    'publicTargetKey', 'resultingSnapshotId', 'status', 'occurredAt'] as const;
  if (!item || !exactKeys(item, keys) || !eventIdentity(item) ||
      item.eventType !== 'USER_ACTION_OBSERVED' || item.workflowStatus !== 'AI_EXECUTING' ||
      item.sessionId !== context.sessionId || item.pageIdentity !== context.pageIdentity ||
      !isProtocolIdentifier(item.observationId) || !isProtocolIdentifier(item.requestId) ||
      !isProtocolIdentifier(item.targetId) || !isProtocolIdentifier(item.sourceSnapshotId) ||
      !isProtocolIdentifier(item.resultingSnapshotId) ||
      (requiresUserDomTarget(context) ? !isPublicTargetKey(item.publicTargetKey) : item.publicTargetKey !== null) ||
      item.status !== 'DOM_CHANGE_CONFIRMED') return null;
  return item as unknown as UserActionObservedEvent;
}

export function readDemoAgentBridge(value: unknown): DemoAgentBridgeBinding | null {
  const item = record(value);
  if (!item || !isProtocolIdentifier(item.sessionId)) return null;
  return parseBrowserBridgeBinding(item, item.sessionId);
}

export function parseBridgeRecovery(payload: unknown, binding: DemoAgentBridgeBinding,
  viewport: OverlayParseContext['viewport'], now = Date.now()): ConversationBridgeRecovery | null {
  const root = record(payload);
  if (!root || !exactKeys(root, ['success', 'data', 'message', 'errorCode']) ||
      root.success !== true || root.errorCode !== null ||
      (root.message !== null && typeof root.message !== 'string')) return null;
  const data = record(root.data);
  const keys = ['sessionId', 'pageIdentity', 'eventSubscription', 'conversationSnapshotPath', 'expiresAt'] as const;
  const allowedKeys = new Set<string>([...keys, 'activeTarget']);
  if (!data || !Object.keys(data).every((key) => allowedKeys.has(key)) ||
      !keys.every((key) => Object.prototype.hasOwnProperty.call(data, key)) ||
      data.sessionId !== binding.sessionId || data.pageIdentity !== binding.pageIdentity ||
      data.eventSubscription !== `/topic/sessions/${binding.sessionId}/events` ||
      data.conversationSnapshotPath !== `/api/v1/sessions/${binding.sessionId}/conversation` ||
      !timestamp(data.expiresAt) || Date.parse(data.expiresAt) <= now) return null;
  const activeTarget = data.activeTarget == null ? null : parsePublicOverlayTarget(data.activeTarget, {
    sessionId: binding.sessionId, pageIdentity: binding.pageIdentity, viewport, now,
    materializationMode: 'USER_DOM_PUBLIC_TARGET'
  });
  if (data.activeTarget != null && !activeTarget) return null;
  return { sessionId: binding.sessionId, pageIdentity: binding.pageIdentity,
    eventSubscription: data.eventSubscription, conversationSnapshotPath: data.conversationSnapshotPath,
    expiresAt: data.expiresAt, activeTarget };
}

export function parseObservationAck(payload: unknown, expected: {
  sessionId: string; requestId: string; targetId: string; pageIdentity: string; sourceSnapshotId: string;
}): InteractionObservationAccepted | null {
  const root = record(payload);
  if (!root || !exactKeys(root, ['success', 'data', 'message', 'errorCode']) ||
      root.success !== true || root.errorCode !== null || typeof root.message !== 'string') return null;
  const data = record(root.data);
  const keys = ['sessionId', 'requestId', 'targetId', 'pageIdentity', 'sourceSnapshotId', 'status', 'acceptedAt'] as const;
  if (!data || !exactKeys(data, keys) || data.sessionId !== expected.sessionId ||
      data.requestId !== expected.requestId || data.targetId !== expected.targetId ||
      data.pageIdentity !== expected.pageIdentity || data.sourceSnapshotId !== expected.sourceSnapshotId ||
      data.status !== 'OBSERVATION_ACCEPTED' || !timestamp(data.acceptedAt) ||
      !isProtocolIdentifier(data.sessionId) || !isProtocolIdentifier(data.requestId) ||
      !isProtocolIdentifier(data.targetId) || !isProtocolIdentifier(data.pageIdentity) ||
      !isProtocolIdentifier(data.sourceSnapshotId)) return null;
  return data as unknown as InteractionObservationAccepted;
}
