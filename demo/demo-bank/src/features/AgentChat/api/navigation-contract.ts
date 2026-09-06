import { ROUTES } from '../../../constants/routes';
import type {
  BrowserPageReadyAccepted,
  BrowserPageReadyRequest,
  PendingBrowserNavigation
} from '../model/navigation-types';
import type {
  NavigationClearEvent,
  NavigationRequiredEvent,
  PageReadyObservedEvent,
  PageReadyResumeFailedEvent
} from '../model/conversation-types';
import type { DemoAgentBridgeBinding } from '../model/overlay-types';

const CONTROL_OR_HTML = /[\u0000-\u001F\u007F<>]/u;
const SAFE_ID = /^[A-Za-z0-9._:-]+$/u;
const RESUME_ERROR_CODES = new Set([
  'PAGE_READY_RESUME_FAILED',
  'DESTINATION_SNAPSHOT_FAILED',
  'OVERLAY_TARGET_NOT_FOUND',
  'OVERLAY_TARGET_AMBIGUOUS',
  'OVERLAY_TARGET_STALE_SNAPSHOT',
  'OVERLAY_TARGET_POLICY_MISMATCH'
]);

export interface NavigationParseContext {
  sessionId: string;
  browserBindingId: string;
  pageIdentity: string;
  pendingNavigation?: PendingBrowserNavigation | null;
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
    Array.from(value).length <= max && !CONTROL_OR_HTML.test(value);
}

function safeId(value: unknown): value is string {
  return safeText(value, 128) && SAFE_ID.test(value);
}

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function timestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 64 && Number.isFinite(Date.parse(value));
}

function envelopeData(value: unknown): Record<string, unknown> | null {
  const root = record(value);
  if (!root || !exactKeys(root, ['success', 'data', 'message', 'errorCode']) ||
      root.success !== true || root.errorCode !== null ||
      (root.message !== null && typeof root.message !== 'string')) return null;
  return record(root.data);
}

export function isAllowedBrowserNavigationRoute(
  value: unknown
): value is PendingBrowserNavigation['destinationRoute'] {
  return value === ROUTES.DEPOSIT_PRODUCTS || value === ROUTES.TRANSFER_ACCOUNTS;
}

export function parseBrowserBridgeBinding(
  payload: unknown,
  expectedSessionId: string,
  now = Date.now()
): DemoAgentBridgeBinding | null {
  const item = record(payload);
  const keys = [
    'sessionId', 'browserBindingId', 'bridgeToken', 'pageIdentity',
    'expiresAt', 'recoveryPath', 'pageReadyStatus'
  ] as const;
  if (!item || !exactKeys(item, keys) || item.sessionId !== expectedSessionId ||
      !safeId(item.sessionId) || !safeId(item.browserBindingId) ||
      !safeId(item.bridgeToken) || !safeId(item.pageIdentity) ||
      !timestamp(item.expiresAt) || Date.parse(item.expiresAt) <= now ||
      item.recoveryPath !== `/api/v1/sessions/${expectedSessionId}/conversation/bridge` ||
      item.pageReadyStatus !== 'READY') return null;
  return item as unknown as DemoAgentBridgeBinding;
}

function validEventIdentity(item: Record<string, unknown>, context: NavigationParseContext) {
  return safeId(item.eventId) && positiveInteger(item.eventSequence) &&
    item.sessionId === context.sessionId && timestamp(item.occurredAt);
}

export function parseNavigationServerEvent(
  payload: unknown,
  context: NavigationParseContext
): NavigationRequiredEvent | PageReadyObservedEvent | NavigationClearEvent | PageReadyResumeFailedEvent | null {
  const item = record(payload);
  if (!item || !validEventIdentity(item, context)) return null;

  if (item.eventType === 'NAVIGATION_REQUIRED') {
    const keys = [
      'eventId', 'eventSequence', 'eventType', 'sessionId', 'navigationId',
      'browserBindingId', 'sourcePageIdentity', 'destinationPageIdentity',
      'destinationRoute', 'routeRevision', 'navigationMode', 'expiresAt',
      'guide', 'occurredAt'
    ] as const;
    if (!exactKeys(item, keys) || !safeId(item.navigationId) ||
        item.browserBindingId !== context.browserBindingId ||
        item.sourcePageIdentity !== context.pageIdentity ||
        !safeId(item.destinationPageIdentity) ||
        item.destinationPageIdentity === item.sourcePageIdentity ||
        !isAllowedBrowserNavigationRoute(item.destinationRoute) ||
        !positiveInteger(item.routeRevision) ||
        (item.navigationMode !== 'SPA_PUSH' && item.navigationMode !== 'SPA_REPLACE') ||
        !timestamp(item.expiresAt) || Date.parse(item.expiresAt) <= (context.now ?? Date.now()) ||
        !safeText(item.guide, 200)) return null;
    return item as unknown as NavigationRequiredEvent;
  }

  if (item.eventType === 'PAGE_READY_OBSERVED') {
    const keys = [
      'eventId', 'eventSequence', 'eventType', 'sessionId', 'navigationId',
      'browserBindingId', 'sourcePageIdentity', 'pageIdentity', 'routeRevision', 'occurredAt'
    ] as const;
    if (!exactKeys(item, keys) || !safeId(item.navigationId) ||
        item.browserBindingId !== context.browserBindingId || !safeId(item.sourcePageIdentity) ||
        !safeId(item.pageIdentity) || !positiveInteger(item.routeRevision)) return null;
    const pending = context.pendingNavigation;
    if (pending && (item.navigationId !== pending.navigationId ||
        item.sourcePageIdentity !== pending.sourcePageIdentity ||
        item.pageIdentity !== pending.destinationPageIdentity ||
        item.routeRevision !== pending.routeRevision)) return null;
    return item as unknown as PageReadyObservedEvent;
  }

  if (item.eventType === 'NAVIGATION_CLEAR') {
    const keys = [
      'eventId', 'eventSequence', 'eventType', 'sessionId', 'navigationId',
      'browserBindingId', 'sourcePageIdentity', 'destinationPageIdentity',
      'routeRevision', 'reason', 'occurredAt'
    ] as const;
    if (!exactKeys(item, keys) || !safeId(item.navigationId) ||
        item.browserBindingId !== context.browserBindingId ||
        !safeId(item.sourcePageIdentity) || !safeId(item.destinationPageIdentity) ||
        !positiveInteger(item.routeRevision) || item.reason !== 'REPLACED_OR_CANCELLED') return null;
    return item as unknown as NavigationClearEvent;
  }

  if (item.eventType === 'PAGE_READY_RESUME_FAILED') {
    const keys = [
      'eventId', 'eventSequence', 'eventType', 'sessionId', 'navigationId',
      'errorCode', 'message', 'occurredAt'
    ] as const;
    if (!exactKeys(item, keys) || !safeId(item.navigationId) ||
        typeof item.errorCode !== 'string' || !RESUME_ERROR_CODES.has(item.errorCode) ||
        !safeText(item.message, 200)) return null;
    return item as unknown as PageReadyResumeFailedEvent;
  }

  return null;
}

export function parsePageReadyAccepted(
  payload: unknown,
  binding: DemoAgentBridgeBinding,
  request: BrowserPageReadyRequest
): BrowserPageReadyAccepted | null {
  const data = envelopeData(payload);
  const keys = [
    'sessionId', 'requestId', 'navigationId', 'browserBindingId',
    'sourcePageIdentity', 'pageIdentity', 'routeRevision', 'renderedRoute',
    'status', 'message'
  ] as const;
  if (!data || !exactKeys(data, keys) || data.sessionId !== binding.sessionId ||
      data.requestId !== request.requestId || data.navigationId !== request.navigationId ||
      data.browserBindingId !== binding.browserBindingId ||
      data.sourcePageIdentity !== request.sourcePageIdentity ||
      data.pageIdentity !== request.destinationPageIdentity ||
      data.routeRevision !== request.routeRevision ||
      data.renderedRoute !== request.renderedRoute ||
      data.status !== 'PAGE_READY_ACCEPTED' || !safeText(data.message, 300)) return null;
  return data as unknown as BrowserPageReadyAccepted;
}
