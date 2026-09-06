import {
  clientPointToDisplayPoint,
  createContainCoordinateTransform,
  displayPointToServerPoint,
  type ViewerDisplayBounds
} from '@/features/F2_StreamViewer/model/coordinate-transform';
import {
  VIEWER_FRAME_HEIGHT,
  VIEWER_FRAME_WIDTH
} from '@/features/F2_StreamViewer/model/viewer-constants';

export const VIEWER_SCROLL_DELTA_MODE_PIXEL = 0;
export const VIEWER_MAX_SCROLL_DELTA = 3000;

export interface ViewerInteractionFrameMetadata {
  frameId: string;
  sequence: number;
  width: typeof VIEWER_FRAME_WIDTH;
  height: typeof VIEWER_FRAME_HEIGHT;
}

interface ViewerRemoteActionBase {
  frameId: string;
  sequence: number;
  x: number;
  y: number;
}

export type ViewerRemoteAction =
  | (ViewerRemoteActionBase & {
      type: 'CLICK';
    })
  | (ViewerRemoteActionBase & {
      type: 'SCROLL';
      deltaX: number;
      deltaY: number;
    });

export interface ViewerInteractionPointInput {
  clientX: number;
  clientY: number;
  displayBounds: ViewerDisplayBounds;
  frame: ViewerInteractionFrameMetadata;
}

export interface ViewerScrollActionInput extends ViewerInteractionPointInput {
  deltaX: number;
  deltaY: number;
  deltaMode: number;
}

function isValidFrame(
  frame: ViewerInteractionFrameMetadata
): boolean {
  return (
    typeof frame.frameId === 'string' &&
    frame.frameId.length > 0 &&
    Number.isSafeInteger(frame.sequence) &&
    frame.sequence > 0 &&
    frame.width === VIEWER_FRAME_WIDTH &&
    frame.height === VIEWER_FRAME_HEIGHT
  );
}

function toServerPixel(
  input: ViewerInteractionPointInput
): { x: number; y: number } | null {
  if (!isValidFrame(input.frame)) {
    return null;
  }

  const displayPoint = clientPointToDisplayPoint(
    { x: input.clientX, y: input.clientY },
    input.displayBounds
  );
  if (!displayPoint) {
    return null;
  }

  const transform = createContainCoordinateTransform(
    { width: input.frame.width, height: input.frame.height },
    {
      width: input.displayBounds.width,
      height: input.displayBounds.height
    }
  );
  if (!transform) {
    return null;
  }

  const serverPoint = displayPointToServerPoint(displayPoint, transform);
  if (!serverPoint) {
    return null;
  }

  // Backend DTO는 CSS pixel 정수를 받는다. 현재 포인터가 속한 픽셀을 유지한다.
  return {
    x: Math.floor(serverPoint.x),
    y: Math.floor(serverPoint.y)
  };
}

export function createViewerClickAction(
  input: ViewerInteractionPointInput
): ViewerRemoteAction | null {
  const point = toServerPixel(input);
  if (!point) {
    return null;
  }

  return {
    type: 'CLICK',
    ...point,
    frameId: input.frame.frameId,
    sequence: input.frame.sequence
  };
}

function normalizeScrollDelta(value: number): number | null {
  if (!Number.isFinite(value) || Math.abs(value) > VIEWER_MAX_SCROLL_DELTA) {
    return null;
  }

  return Math.trunc(value);
}

export function createViewerScrollAction(
  input: ViewerScrollActionInput
): ViewerRemoteAction | null {
  if (input.deltaMode !== VIEWER_SCROLL_DELTA_MODE_PIXEL) {
    return null;
  }

  const deltaX = normalizeScrollDelta(input.deltaX);
  const deltaY = normalizeScrollDelta(input.deltaY);
  if (deltaX === null || deltaY === null || (deltaX === 0 && deltaY === 0)) {
    return null;
  }

  const point = toServerPixel(input);
  if (!point) {
    return null;
  }

  return {
    type: 'SCROLL',
    ...point,
    deltaX,
    deltaY,
    frameId: input.frame.frameId,
    sequence: input.frame.sequence
  };
}
