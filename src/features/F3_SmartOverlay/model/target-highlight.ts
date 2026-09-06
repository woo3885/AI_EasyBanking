import type {
  ViewerRect,
  ViewerSize
} from '@/features/F2_StreamViewer/model/coordinate-transform';

export type TargetPointerPlacement = 'top' | 'bottom';

export interface TargetPointerPosition {
  x: number;
  y: number;
  placement: TargetPointerPlacement;
}

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

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

/**
 * 포인터만 Viewer 안으로 제한하는 시각 배치 정책이다.
 * 실제 Target rect와 향후 클릭 좌표는 변경하지 않는다.
 */
export function calculateTargetPointerPosition(
  displayRect: ViewerRect,
  displaySize: ViewerSize,
  pointerSize: ViewerSize,
  gap: number
): TargetPointerPosition | null {
  if (
    !isValidRect(displayRect) ||
    !isValidSize(displaySize) ||
    !isValidSize(pointerSize) ||
    !isFiniteNumber(gap) ||
    gap < 0 ||
    pointerSize.width > displaySize.width ||
    pointerSize.height > displaySize.height
  ) {
    return null;
  }

  const requiredSpace = pointerSize.height + gap;
  const topSpace = displayRect.y;
  const bottomSpace =
    displaySize.height - (displayRect.y + displayRect.height);
  const placement: TargetPointerPlacement =
    topSpace >= requiredSpace
      ? 'top'
      : bottomSpace >= requiredSpace
        ? 'bottom'
        : topSpace >= bottomSpace
          ? 'top'
          : 'bottom';
  const maximumX = displaySize.width - pointerSize.width;
  const maximumY = displaySize.height - pointerSize.height;
  const targetCenterX = displayRect.x + displayRect.width / 2;
  const rawX = targetCenterX - pointerSize.width / 2;
  const rawY =
    placement === 'top'
      ? displayRect.y - gap - pointerSize.height
      : displayRect.y + displayRect.height + gap;

  return {
    x: clamp(rawX, 0, maximumX),
    y: clamp(rawY, 0, maximumY),
    placement
  };
}
