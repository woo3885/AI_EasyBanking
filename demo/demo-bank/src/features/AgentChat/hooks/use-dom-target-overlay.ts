import { useEffect, useRef } from 'react';

import type {
  OverlayObservationPhase,
  PublicOverlayTarget
} from '../model/overlay-types';

interface UseDomTargetOverlayOptions {
  target: PublicOverlayTarget | null;
  observationPhase: OverlayObservationPhase;
  onClear: () => void;
  onTargetClick: (target: PublicOverlayTarget) => void;
}

const RECTANGLE_TOLERANCE = 2;

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

function interactiveAncestor(value: EventTarget | null, role: string) {
  let element = value instanceof Element ? value : null;
  while (element && element !== document.documentElement) {
    if (element.getAttribute('data-ddd-agent-ui') === 'true') return null;
    if (roleOf(element) === role) return element;
    element = element.parentElement;
  }
  return null;
}

function near(left: number, right: number) {
  return Math.abs(left - right) <= RECTANGLE_TOLERANCE;
}

function isCurrentTargetClick(event: MouseEvent, target: PublicOverlayTarget) {
  const element = interactiveAncestor(event.target, target.role);
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  const expected = target.rectangle;
  return near(rect.x, expected.x) && near(rect.y, expected.y) &&
    near(rect.width, expected.width) && near(rect.height, expected.height) &&
    (event.detail === 0 || (
      event.clientX >= expected.x && event.clientX <= expected.x + expected.width &&
      event.clientY >= expected.y && event.clientY <= expected.y + expected.height
    ));
}

export function useDomTargetOverlay({
  target,
  observationPhase,
  onClear,
  onTargetClick
}: UseDomTargetOverlayOptions) {
  const clickLocked = useRef(false);

  useEffect(() => {
    clickLocked.current = observationPhase !== 'IDLE';
  }, [observationPhase, target?.targetId]);

  useEffect(() => {
    if (!target) return;
    const remaining = Date.parse(target.expiresAt) - Date.now();
    if (remaining <= 0) {
      onClear();
      return;
    }
    const timeout = window.setTimeout(onClear, Math.min(remaining, 2_147_483_647));
    const clear = () => onClear();
    const click = (event: MouseEvent) => {
      if (clickLocked.current || Date.parse(target.expiresAt) <= Date.now() ||
          !isCurrentTargetClick(event, target)) return;
      clickLocked.current = true;
      onTargetClick(target);
    };
    window.addEventListener('scroll', clear, true);
    window.addEventListener('resize', clear);
    window.addEventListener('popstate', clear);
    window.addEventListener('hashchange', clear);
    document.addEventListener('click', click, true);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('scroll', clear, true);
      window.removeEventListener('resize', clear);
      window.removeEventListener('popstate', clear);
      window.removeEventListener('hashchange', clear);
      document.removeEventListener('click', click, true);
    };
  }, [onClear, onTargetClick, target]);
}
