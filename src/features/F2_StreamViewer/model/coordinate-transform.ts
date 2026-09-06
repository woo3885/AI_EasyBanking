export interface ViewerSize {
  width: number;
  height: number;
}

export interface ViewerPoint {
  x: number;
  y: number;
}

export interface ViewerRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ViewerDisplayBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ViewerCoordinateTransform {
  serverSize: ViewerSize;
  displaySize: ViewerSize;
  scale: number;
  offsetX: number;
  offsetY: number;
  renderedWidth: number;
  renderedHeight: number;
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

function isValidPoint(point: ViewerPoint): boolean {
  return isFiniteNumber(point.x) && isFiniteNumber(point.y);
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

function isValidDisplayBounds(bounds: ViewerDisplayBounds): boolean {
  return (
    isFiniteNumber(bounds.left) &&
    isFiniteNumber(bounds.top) &&
    isFiniteNumber(bounds.width) &&
    isFiniteNumber(bounds.height) &&
    bounds.width > 0 &&
    bounds.height > 0 &&
    isFiniteNumber(bounds.left + bounds.width) &&
    isFiniteNumber(bounds.top + bounds.height)
  );
}

function nearlyEqual(left: number, right: number): boolean {
  const tolerance =
    Number.EPSILON * Math.max(1, Math.abs(left), Math.abs(right)) * 8;

  return Math.abs(left - right) <= tolerance;
}

function isValidTransform(
  transform: ViewerCoordinateTransform
): boolean {
  if (
    !isValidSize(transform.serverSize) ||
    !isValidSize(transform.displaySize) ||
    !isFiniteNumber(transform.scale) ||
    !isFiniteNumber(transform.offsetX) ||
    !isFiniteNumber(transform.offsetY) ||
    !isFiniteNumber(transform.renderedWidth) ||
    !isFiniteNumber(transform.renderedHeight) ||
    transform.scale <= 0 ||
    transform.offsetX < 0 ||
    transform.offsetY < 0 ||
    transform.renderedWidth <= 0 ||
    transform.renderedHeight <= 0
  ) {
    return false;
  }

  const expectedScale = Math.min(
    transform.displaySize.width / transform.serverSize.width,
    transform.displaySize.height / transform.serverSize.height
  );
  const expectedRenderedWidth =
    transform.serverSize.width * expectedScale;
  const expectedRenderedHeight =
    transform.serverSize.height * expectedScale;
  const expectedOffsetX =
    (transform.displaySize.width - expectedRenderedWidth) / 2;
  const expectedOffsetY =
    (transform.displaySize.height - expectedRenderedHeight) / 2;

  return (
    nearlyEqual(transform.scale, expectedScale) &&
    nearlyEqual(transform.renderedWidth, expectedRenderedWidth) &&
    nearlyEqual(transform.renderedHeight, expectedRenderedHeight) &&
    nearlyEqual(transform.offsetX, expectedOffsetX) &&
    nearlyEqual(transform.offsetY, expectedOffsetY)
  );
}

export function createContainCoordinateTransform(
  serverSize: ViewerSize,
  displaySize: ViewerSize
): ViewerCoordinateTransform | null {
  if (!isValidSize(serverSize) || !isValidSize(displaySize)) {
    return null;
  }

  const scale = Math.min(
    displaySize.width / serverSize.width,
    displaySize.height / serverSize.height
  );
  const renderedWidth = serverSize.width * scale;
  const renderedHeight = serverSize.height * scale;
  const offsetX = (displaySize.width - renderedWidth) / 2;
  const offsetY = (displaySize.height - renderedHeight) / 2;

  return {
    serverSize: { ...serverSize },
    displaySize: { ...displaySize },
    scale,
    offsetX,
    offsetY,
    renderedWidth,
    renderedHeight
  };
}

export function isPointInsideRenderedFrame(
  point: ViewerPoint,
  transform: ViewerCoordinateTransform
): boolean {
  if (!isValidPoint(point) || !isValidTransform(transform)) {
    return false;
  }

  return (
    point.x >= transform.offsetX &&
    point.x < transform.offsetX + transform.renderedWidth &&
    point.y >= transform.offsetY &&
    point.y < transform.offsetY + transform.renderedHeight
  );
}

export function serverPointToDisplayPoint(
  point: ViewerPoint,
  transform: ViewerCoordinateTransform
): ViewerPoint | null {
  if (
    !isValidPoint(point) ||
    !isValidTransform(transform) ||
    point.x < 0 ||
    point.x >= transform.serverSize.width ||
    point.y < 0 ||
    point.y >= transform.serverSize.height
  ) {
    return null;
  }

  return {
    x: transform.offsetX + point.x * transform.scale,
    y: transform.offsetY + point.y * transform.scale
  };
}

export function displayPointToServerPoint(
  point: ViewerPoint,
  transform: ViewerCoordinateTransform
): ViewerPoint | null {
  if (!isPointInsideRenderedFrame(point, transform)) {
    return null;
  }

  const serverPoint = {
    x: (point.x - transform.offsetX) / transform.scale,
    y: (point.y - transform.offsetY) / transform.scale
  };

  if (
    serverPoint.x < 0 ||
    serverPoint.x >= transform.serverSize.width ||
    serverPoint.y < 0 ||
    serverPoint.y >= transform.serverSize.height
  ) {
    return null;
  }

  return serverPoint;
}

export function clientPointToDisplayPoint(
  clientPoint: ViewerPoint,
  displayBounds: ViewerDisplayBounds
): ViewerPoint | null {
  if (
    !isValidPoint(clientPoint) ||
    !isValidDisplayBounds(displayBounds)
  ) {
    return null;
  }

  const localPoint = {
    x: clientPoint.x - displayBounds.left,
    y: clientPoint.y - displayBounds.top
  };

  if (
    !isValidPoint(localPoint) ||
    localPoint.x < 0 ||
    localPoint.x >= displayBounds.width ||
    localPoint.y < 0 ||
    localPoint.y >= displayBounds.height
  ) {
    return null;
  }

  return localPoint;
}

export function clipServerRectToFrame(
  rect: ViewerRect,
  serverSize: ViewerSize
): ViewerRect | null {
  if (!isValidRect(rect) || !isValidSize(serverSize)) {
    return null;
  }

  const left = Math.max(0, rect.x);
  const top = Math.max(0, rect.y);
  const right = Math.min(serverSize.width, rect.x + rect.width);
  const bottom = Math.min(serverSize.height, rect.y + rect.height);

  if (right <= left || bottom <= top) {
    return null;
  }

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
  };
}

export function serverRectToDisplayRect(
  rect: ViewerRect,
  transform: ViewerCoordinateTransform
): ViewerRect | null {
  if (!isValidTransform(transform)) {
    return null;
  }

  const clippedRect = clipServerRectToFrame(
    rect,
    transform.serverSize
  );

  if (!clippedRect) {
    return null;
  }

  return {
    x: transform.offsetX + clippedRect.x * transform.scale,
    y: transform.offsetY + clippedRect.y * transform.scale,
    width: clippedRect.width * transform.scale,
    height: clippedRect.height * transform.scale
  };
}
