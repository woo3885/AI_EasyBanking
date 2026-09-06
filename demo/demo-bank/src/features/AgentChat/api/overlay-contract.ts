import type {
  ConversationBridgeRecovery,
  DemoAgentBridgeBinding,
  InteractionObservationAccepted,
  PublicOverlayTarget
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

export interface OverlayParseContext {
  sessionId: string;
  pageIdentity: string;
  viewport: { width: number; height: number };
  now?: number;
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

function safeText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim() === value && value.length > 0 &&
    Array.from(value).length <= max && !CONTROL_OR_HTML.test(value) &&
    !RAW_ACCOUNT_NUMBER.test(value) && !RAW_CREDENTIAL.test(value);
}

function safeId(value: unknown): value is string {
  return safeText(value, 128) && /^[A-Za-z0-9._:-]+$/u.test(value);
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function timestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 64 &&
    Number.isFinite(Date.parse(value));
}

function eventIdentity(item: Record<string, unknown>) {
  return safeId(item.eventId) && Number.isSafeInteger(item.eventSequence) &&
    Number(item.eventSequence) > 0 && safeId(item.sessionId) && timestamp(item.occurredAt);
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

function targetGeometryIsValid(target: PublicOverlayTarget, context: OverlayParseContext) {
  const { rectangle, viewport } = target;
  return Math.abs(viewport.width - context.viewport.width) <= 1 &&
    Math.abs(viewport.height - context.viewport.height) <= 1 &&
    rectangle.x >= -rectangle.width && rectangle.y >= -rectangle.height &&
    rectangle.x <= viewport.width && rectangle.y <= viewport.height;
}

const TARGET_KEYS = [
  'targetId', 'sessionId', 'pageIdentity', 'sourceSnapshotId', 'coordinateSpace',
  'rectangle', 'viewport', 'role', 'label', 'guide', 'actionMode', 'createdAt',
  'expiresAt', 'consumedAt'
] as const;

export function parsePublicOverlayTarget(
  payload: unknown,
  context: OverlayParseContext
): PublicOverlayTarget | null {
  const item = record(payload);
  if (!item || !exactKeys(item, TARGET_KEYS)) return null;
  const rectangle = parseRectangle(item.rectangle);
  const viewport = parseViewport(item.viewport);
  if (!rectangle || !viewport || !safeId(item.targetId) || item.sessionId !== context.sessionId ||
      item.pageIdentity !== context.pageIdentity || !safeId(item.sourceSnapshotId) ||
      item.coordinateSpace !== 'VIEWPORT_CSS_PX' || item.actionMode !== 'GUIDE_USER_CLICK' ||
      typeof item.role !== 'string' || !TARGET_ROLES.has(item.role) ||
      !safeText(item.label, 120) || !safeText(item.guide, 200) ||
      !timestamp(item.createdAt) || !timestamp(item.expiresAt) || item.consumedAt !== null) return null;
  const target: PublicOverlayTarget = {
    targetId: item.targetId,
    sessionId: item.sessionId,
    pageIdentity: item.pageIdentity,
    sourceSnapshotId: item.sourceSnapshotId,
    coordinateSpace: 'VIEWPORT_CSS_PX', rectangle, viewport, role: item.role,
    label: item.label, guide: item.guide, actionMode: 'GUIDE_USER_CLICK',
    createdAt: item.createdAt, expiresAt: item.expiresAt, consumedAt: null
  };
  const now = context.now ?? Date.now();
  if (Date.parse(target.expiresAt) <= now || Date.parse(target.expiresAt) <= Date.parse(target.createdAt) ||
      !targetGeometryIsValid(target, context)) return null;
  return target;
}

const OVERLAY_EVENT_KEYS = [
  'eventId', 'eventSequence', 'eventType', 'sessionId', 'workflowStatus',
  'targetId', 'pageIdentity', 'sourceSnapshotId', 'coordinateSpace', 'rectangle',
  'viewport', 'role', 'label', 'guide', 'actionMode', 'expiresAt', 'occurredAt'
] as const;

export function parseOverlayTargetEvent(payload: unknown, context: OverlayParseContext): OverlayTargetEvent | null {
  const item = record(payload);
  if (!item || !exactKeys(item, OVERLAY_EVENT_KEYS) || !eventIdentity(item) ||
      item.eventType !== 'OVERLAY_TARGET' || item.workflowStatus !== 'USER_DECISION_REQUIRED') return null;
  const target = parsePublicOverlayTarget({
    targetId: item.targetId, sessionId: item.sessionId, pageIdentity: item.pageIdentity,
    sourceSnapshotId: item.sourceSnapshotId, coordinateSpace: item.coordinateSpace,
    rectangle: item.rectangle, viewport: item.viewport, role: item.role, label: item.label,
    guide: item.guide, actionMode: item.actionMode, createdAt: item.occurredAt,
    expiresAt: item.expiresAt, consumedAt: null
  }, context);
  return target ? {
    eventId: item.eventId as string, eventSequence: item.eventSequence as number,
    eventType: 'OVERLAY_TARGET', sessionId: target.sessionId,
    workflowStatus: 'USER_DECISION_REQUIRED', targetId: target.targetId,
    pageIdentity: target.pageIdentity, sourceSnapshotId: target.sourceSnapshotId,
    coordinateSpace: target.coordinateSpace, rectangle: target.rectangle,
    viewport: target.viewport, role: target.role, label: target.label, guide: target.guide,
    actionMode: target.actionMode, expiresAt: target.expiresAt,
    occurredAt: item.occurredAt as string
  } : null;
}

export function overlayTargetFromEvent(event: OverlayTargetEvent): PublicOverlayTarget {
  return { ...event, createdAt: event.occurredAt, consumedAt: null };
}

export function parseOverlayClearEvent(payload: unknown, context: Pick<OverlayParseContext, 'sessionId' | 'pageIdentity'>): OverlayClearEvent | null {
  const item = record(payload);
  const keys = ['eventId', 'eventSequence', 'eventType', 'sessionId', 'targetId',
    'pageIdentity', 'sourceSnapshotId', 'reason', 'occurredAt'] as const;
  if (!item || !exactKeys(item, keys) || !eventIdentity(item) || item.eventType !== 'OVERLAY_CLEAR' ||
      item.sessionId !== context.sessionId || item.pageIdentity !== context.pageIdentity ||
      !safeId(item.targetId) || !safeId(item.sourceSnapshotId) ||
      typeof item.reason !== 'string' || !CLEAR_REASONS.has(item.reason)) return null;
  return item as unknown as OverlayClearEvent;
}

export function parseUserActionObservedEvent(payload: unknown, context: Pick<OverlayParseContext, 'sessionId' | 'pageIdentity'>): UserActionObservedEvent | null {
  const item = record(payload);
  const keys = ['eventId', 'eventSequence', 'eventType', 'sessionId', 'workflowStatus',
    'observationId', 'requestId', 'targetId', 'pageIdentity', 'sourceSnapshotId',
    'resultingSnapshotId', 'status', 'occurredAt'] as const;
  if (!item || !exactKeys(item, keys) || !eventIdentity(item) ||
      item.eventType !== 'USER_ACTION_OBSERVED' || item.workflowStatus !== 'AI_EXECUTING' ||
      item.sessionId !== context.sessionId || item.pageIdentity !== context.pageIdentity ||
      !safeId(item.observationId) || !safeId(item.requestId) || !safeId(item.targetId) ||
      !safeId(item.sourceSnapshotId) || !safeId(item.resultingSnapshotId) ||
      item.status !== 'DOM_CHANGE_CONFIRMED') return null;
  return item as unknown as UserActionObservedEvent;
}

export function readDemoAgentBridge(value: unknown): DemoAgentBridgeBinding | null {
  const item = record(value);
  if (!item || !safeId(item.sessionId)) return null;
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
      data.sessionId !== binding.sessionId ||
      data.pageIdentity !== binding.pageIdentity ||
      data.eventSubscription !== `/topic/sessions/${binding.sessionId}/events` ||
      data.conversationSnapshotPath !== `/api/v1/sessions/${binding.sessionId}/conversation` ||
      !timestamp(data.expiresAt) || Date.parse(data.expiresAt) <= now) return null;
  const activeTarget = data.activeTarget == null ? null : parsePublicOverlayTarget(data.activeTarget, {
    sessionId: binding.sessionId, pageIdentity: binding.pageIdentity, viewport, now
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
      data.status !== 'OBSERVATION_ACCEPTED' || !timestamp(data.acceptedAt)) return null;
  return data as unknown as InteractionObservationAccepted;
}
