import { useEffect, useRef, useState } from 'react';

import { getPublicOverlayTargetRoute } from '../../../constants/public-overlay-targets';
import { normalizePathname } from '../../../constants/routes';
import { DEMO_BANK_SPA_NAVIGATION_EVENT } from '../../../navigation/demo-bank-spa';
import type {
  MaterializedDomOverlayTarget,
  ObservedDomTargetClick,
  OverlayObservationPhase,
  OverlayRectangle,
  PublicOverlayTarget
} from '../model/overlay-types';

interface UseDomTargetOverlayOptions {
  target: PublicOverlayTarget | null;
  observationPhase: OverlayObservationPhase;
  onClear: () => void;
  onTargetClick: (observation: ObservedDomTargetClick) => void;
}

interface ResolvedDomTarget extends MaterializedDomOverlayTarget {
  element: HTMLElement;
}

function roleOf(element: Element) {
  const explicit = element.getAttribute('role');
  if (explicit) return explicit.toLowerCase();
  const tag = element.tagName.toLowerCase();
  if (tag === 'a') return 'link';
  if (tag === 'button') return 'button';
  if (tag === 'option') return 'option';
  if (tag === 'input') {
    const type = (element.getAttribute('type') ?? '').toLowerCase();
    if (type === 'radio' || type === 'checkbox') return type;
  }
  return null;
}

function toRectangle(rect: DOMRect): OverlayRectangle {
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

function finiteRectangle(rectangle: OverlayRectangle) {
  return Number.isFinite(rectangle.x) && Number.isFinite(rectangle.y) &&
    Number.isFinite(rectangle.width) && Number.isFinite(rectangle.height) &&
    rectangle.width > 0 && rectangle.height > 0;
}

function isEnabled(element: HTMLElement) {
  return !(element instanceof HTMLButtonElement && element.disabled) &&
    !(element instanceof HTMLInputElement && element.disabled) &&
    element.getAttribute('aria-disabled') !== 'true';
}

function isVisible(element: HTMLElement, rectangle: OverlayRectangle) {
  const style = window.getComputedStyle(element);
  return !element.hidden && element.getAttribute('aria-hidden') !== 'true' &&
    style.display !== 'none' && style.visibility !== 'hidden' &&
    style.visibility !== 'collapse' && finiteRectangle(rectangle);
}

/** Resolve by enumerating the public attribute and comparing the dataset value exactly. */
export function resolveUserDomOverlayTarget(
  target: PublicOverlayTarget,
  pathname = window.location.pathname
): ResolvedDomTarget | null {
  const locator = target.locator;
  if (target.contractVersion !== 2 ||
      target.materializationMode !== 'USER_DOM_PUBLIC_TARGET' ||
      !locator || locator.type !== 'PUBLIC_TARGET_KEY' ||
      target.role !== locator.role || target.label !== locator.accessibleName) return null;

  const expectedRoute = getPublicOverlayTargetRoute(locator.publicTargetKey);
  if (!expectedRoute || normalizePathname(pathname) !== expectedRoute) return null;

  const matches = Array.from(
    document.querySelectorAll<HTMLElement>('[data-ddd-public-target]')
  ).filter((element) => element.dataset.dddPublicTarget === locator.publicTargetKey);
  if (matches.length !== 1) return null;

  const element = matches[0];
  const localRectangle = toRectangle(element.getBoundingClientRect());
  if (element.closest('[data-ddd-agent-ui="true"]') || roleOf(element) !== locator.role ||
      element.getAttribute('aria-label') !== locator.accessibleName ||
      !isEnabled(element) || !isVisible(element, localRectangle)) return null;

  return {
    target,
    element,
    localRectangle,
    viewport: { width: window.innerWidth, height: window.innerHeight }
  };
}

function sameRectangle(left: OverlayRectangle, right: OverlayRectangle) {
  return left.x === right.x && left.y === right.y && left.width === right.width &&
    left.height === right.height;
}

function eventPathContains(event: MouseEvent, element: HTMLElement) {
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
  return path.includes(element) && !path.some((entry) =>
    entry instanceof Element && entry.getAttribute('data-ddd-agent-ui') === 'true'
  );
}

export function useDomTargetOverlay({
  target,
  observationPhase,
  onClear,
  onTargetClick
}: UseDomTargetOverlayOptions) {
  const [materializedTarget, setMaterializedTarget] =
    useState<MaterializedDomOverlayTarget | null>(null);
  const resolvedRef = useRef<ResolvedDomTarget | null>(null);
  const clickLocked = useRef(false);
  const clearLocked = useRef(false);

  useEffect(() => {
    clickLocked.current = observationPhase !== 'IDLE';
  }, [observationPhase, target?.targetId]);

  useEffect(() => {
    resolvedRef.current = null;
    setMaterializedTarget(null);
    clearLocked.current = false;
    if (!target) return;

    const clearOnce = () => {
      if (clearLocked.current) return;
      clearLocked.current = true;
      resolvedRef.current = null;
      setMaterializedTarget(null);
      onClear();
    };
    const remeasure = () => {
      if (Date.parse(target.expiresAt) <= Date.now()) {
        clearOnce();
        return;
      }
      const resolved = resolveUserDomOverlayTarget(target);
      if (!resolved) {
        clearOnce();
        return;
      }
      resolvedRef.current = resolved;
      setMaterializedTarget((current) =>
        current?.target.targetId === resolved.target.targetId &&
        sameRectangle(current.localRectangle, resolved.localRectangle) &&
        current.viewport.width === resolved.viewport.width &&
        current.viewport.height === resolved.viewport.height
          ? current
          : {
              target: resolved.target,
              localRectangle: resolved.localRectangle,
              viewport: resolved.viewport
            }
      );
    };
    const click = (event: MouseEvent) => {
      const current = resolvedRef.current;
      if (!current || clickLocked.current || Date.parse(target.expiresAt) <= Date.now() ||
          !eventPathContains(event, current.element)) return;
      const refreshed = resolveUserDomOverlayTarget(target);
      if (!refreshed || refreshed.element !== current.element) {
        clearOnce();
        return;
      }
      const { localRectangle } = refreshed;
      const clientX = event.detail === 0
        ? localRectangle.x + localRectangle.width / 2
        : event.clientX;
      const clientY = event.detail === 0
        ? localRectangle.y + localRectangle.height / 2
        : event.clientY;
      if (clientX < localRectangle.x || clientX > localRectangle.x + localRectangle.width ||
          clientY < localRectangle.y || clientY > localRectangle.y + localRectangle.height) return;
      clickLocked.current = true;
      onTargetClick({
        target,
        localRectangle,
        viewport: refreshed.viewport,
        clickPosition: { clientX, clientY }
      });
    };

    remeasure();
    const remaining = Date.parse(target.expiresAt) - Date.now();
    if (remaining <= 0) return;
    const timeout = window.setTimeout(clearOnce, Math.min(remaining, 2_147_483_647));
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(remeasure);
    const observedTarget = resolvedRef.current as ResolvedDomTarget | null;
    if (observedTarget) resizeObserver?.observe(observedTarget.element);

    window.addEventListener('scroll', remeasure, true);
    window.addEventListener('resize', remeasure);
    window.visualViewport?.addEventListener('scroll', remeasure);
    window.visualViewport?.addEventListener('resize', remeasure);
    window.addEventListener('popstate', clearOnce);
    window.addEventListener('hashchange', clearOnce);
    window.addEventListener(DEMO_BANK_SPA_NAVIGATION_EVENT, clearOnce);
    document.addEventListener('click', click, true);
    return () => {
      window.clearTimeout(timeout);
      resizeObserver?.disconnect();
      window.removeEventListener('scroll', remeasure, true);
      window.removeEventListener('resize', remeasure);
      window.visualViewport?.removeEventListener('scroll', remeasure);
      window.visualViewport?.removeEventListener('resize', remeasure);
      window.removeEventListener('popstate', clearOnce);
      window.removeEventListener('hashchange', clearOnce);
      window.removeEventListener(DEMO_BANK_SPA_NAVIGATION_EVENT, clearOnce);
      document.removeEventListener('click', click, true);
      resolvedRef.current = null;
    };
  }, [onClear, onTargetClick, target]);

  return { materializedTarget };
}
