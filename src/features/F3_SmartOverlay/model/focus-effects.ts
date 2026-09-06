import type {
  ViewerRect,
  ViewerSize
} from '@/features/F2_StreamViewer/model/coordinate-transform';

export type FocusDimPanelName = 'top' | 'bottom' | 'left' | 'right';

export interface FocusDimPanelRect extends ViewerRect {
  name: FocusDimPanelName;
}

export type FocusMagnifierPlacement = 'right' | 'left' | 'bottom' | 'top';

export interface FocusMagnifierLayout extends ViewerRect {
  placement: FocusMagnifierPlacement;
  zoom: number;
}

export interface FocusMagnifierOptions {
  lensSize?: ViewerSize;
  zoom?: number;
  gap?: number;
  blockedRects?: readonly ViewerRect[];
}

export const DEFAULT_FOCUS_MAGNIFIER_SIZE: ViewerSize = {
  width: 180,
  height: 112.5
};
export const DEFAULT_FOCUS_MAGNIFIER_ZOOM = 2;
export const DEFAULT_FOCUS_MAGNIFIER_GAP = 16;

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

function isValidSize(size: ViewerSize): boolean {
  return (
    isFiniteNumber(size.width) &&
    isFiniteNumber(size.height) &&
    size.width > 0 &&
    size.height > 0
  );
}

function isValidRect(rect: ViewerRect): boolean {
  return (
    isFiniteNumber(rect.x) &&
    isFiniteNumber(rect.y) &&
    isFiniteNumber(rect.width) &&
    isFiniteNumber(rect.height) &&
    rect.width > 0 &&
    rect.height > 0 &&
    isFiniteNumber(rect.x + rect.width) &&
    isFiniteNumber(rect.y + rect.height)
  );
}

function isRectInsideViewer(rect: ViewerRect, displaySize: ViewerSize): boolean {
  return (
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.x + rect.width <= displaySize.width &&
    rect.y + rect.height <= displaySize.height
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function rectsOverlap(left: ViewerRect, right: ViewerRect): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

export function createFocusDimPanels(
  displayRect: ViewerRect,
  displaySize: ViewerSize
): FocusDimPanelRect[] {
  if (
    !isValidRect(displayRect) ||
    !isValidSize(displaySize) ||
    !isRectInsideViewer(displayRect, displaySize)
  ) {
    return [];
  }

  const targetRight = displayRect.x + displayRect.width;
  const targetBottom = displayRect.y + displayRect.height;
  const panels: FocusDimPanelRect[] = [
    {
      name: 'top',
      x: 0,
      y: 0,
      width: displaySize.width,
      height: displayRect.y
    },
    {
      name: 'bottom',
      x: 0,
      y: targetBottom,
      width: displaySize.width,
      height: displaySize.height - targetBottom
    },
    {
      name: 'left',
      x: 0,
      y: displayRect.y,
      width: displayRect.x,
      height: displayRect.height
    },
    {
      name: 'right',
      x: targetRight,
      y: displayRect.y,
      width: displaySize.width - targetRight,
      height: displayRect.height
    }
  ];

  return panels.filter((panel) => panel.width > 0 && panel.height > 0);
}

export function createFocusMagnifierLayout(
  displayRect: ViewerRect,
  displaySize: ViewerSize,
  options: FocusMagnifierOptions = {}
): FocusMagnifierLayout | null {
  const lensSize = options.lensSize ?? DEFAULT_FOCUS_MAGNIFIER_SIZE;
  const zoom = options.zoom ?? DEFAULT_FOCUS_MAGNIFIER_ZOOM;
  const gap = options.gap ?? DEFAULT_FOCUS_MAGNIFIER_GAP;
  const blockedRects = options.blockedRects ?? [];

  if (
    !isValidRect(displayRect) ||
    !isValidSize(displaySize) ||
    !isRectInsideViewer(displayRect, displaySize) ||
    !isValidSize(lensSize) ||
    lensSize.width > displaySize.width ||
    lensSize.height > displaySize.height ||
    !isFiniteNumber(zoom) ||
    zoom <= 0 ||
    !isFiniteNumber(gap) ||
    gap < 0 ||
    blockedRects.some((rect) => !isValidRect(rect))
  ) {
    return null;
  }

  const targetRight = displayRect.x + displayRect.width;
  const targetBottom = displayRect.y + displayRect.height;
  const centeredX = clamp(
    displayRect.x + displayRect.width / 2 - lensSize.width / 2,
    0,
    displaySize.width - lensSize.width
  );
  const centeredY = clamp(
    displayRect.y + displayRect.height / 2 - lensSize.height / 2,
    0,
    displaySize.height - lensSize.height
  );
  const candidates: Array<ViewerRect & { placement: FocusMagnifierPlacement }> = [
    {
      placement: 'right',
      x: targetRight + gap,
      y: centeredY,
      width: lensSize.width,
      height: lensSize.height
    },
    {
      placement: 'left',
      x: displayRect.x - gap - lensSize.width,
      y: centeredY,
      width: lensSize.width,
      height: lensSize.height
    },
    {
      placement: 'bottom',
      x: centeredX,
      y: targetBottom + gap,
      width: lensSize.width,
      height: lensSize.height
    },
    {
      placement: 'top',
      x: centeredX,
      y: displayRect.y - gap - lensSize.height,
      width: lensSize.width,
      height: lensSize.height
    }
  ];

  const candidate = candidates.find(
    (item) =>
      isRectInsideViewer(item, displaySize) &&
      !rectsOverlap(item, displayRect) &&
      blockedRects.every((blockedRect) => !rectsOverlap(item, blockedRect))
  );

  return candidate ? { ...candidate, zoom } : null;
}
