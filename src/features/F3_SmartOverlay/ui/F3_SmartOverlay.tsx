import {
  createContainCoordinateTransform,
  serverRectToDisplayRect,
  type ViewerSize
} from '@/features/F2_StreamViewer/model/coordinate-transform';
import type { ViewerFrameStatus } from '@/features/F2_StreamViewer/model/viewer-frame';
import {
  createFocusDimPanels,
  createFocusMagnifierLayout
} from '@/features/F3_SmartOverlay/model/focus-effects';
import {
  calculateTargetPointerPosition
} from '@/features/F3_SmartOverlay/model/target-highlight';
import type { ViewerRect } from '@/features/F2_StreamViewer/model/coordinate-transform';

export interface TargetHighlightTarget extends ViewerRect {
  elementId: string;
  label?: string;
}

export interface F3SmartOverlayProps {
  target: TargetHighlightTarget | null;
  serverSize: ViewerSize;
  displaySize: ViewerSize;
  message: string;
  visible?: boolean;
  focusEffectsEnabled?: boolean;
  magnifierImageSrc?: string;
  frameStatus?: ViewerFrameStatus;
}

export const TARGET_POINTER_SIZE: ViewerSize = { width: 32, height: 40 };
export const TARGET_POINTER_GAP = 12;

export default function F3_SmartOverlay({
  target,
  serverSize,
  displaySize,
  message,
  visible = true,
  focusEffectsEnabled = false,
  magnifierImageSrc,
  frameStatus
}: F3SmartOverlayProps) {
  if (!visible || !target) {
    return null;
  }

  const transform = createContainCoordinateTransform(serverSize, displaySize);

  if (!transform) {
    return null;
  }

  const displayRect = serverRectToDisplayRect(target, transform);

  if (!displayRect) {
    return null;
  }

  const pointerPosition = calculateTargetPointerPosition(
    displayRect,
    displaySize,
    TARGET_POINTER_SIZE,
    TARGET_POINTER_GAP
  );

  if (!pointerPosition) {
    return null;
  }

  const focusEffectsVisible =
    focusEffectsEnabled && frameStatus === 'READY';
  const dimPanels = focusEffectsVisible
    ? createFocusDimPanels(displayRect, displaySize)
    : [];
  const pointerRect = {
    x: pointerPosition.x,
    y: pointerPosition.y,
    width: TARGET_POINTER_SIZE.width,
    height: TARGET_POINTER_SIZE.height
  };
  const magnifierLayout =
    focusEffectsVisible && magnifierImageSrc
      ? createFocusMagnifierLayout(displayRect, displaySize, {
          blockedRects: [pointerRect]
        })
      : null;
  const magnifierBackground = magnifierLayout
    ? {
        sizeX: transform.renderedWidth * magnifierLayout.zoom,
        sizeY: transform.renderedHeight * magnifierLayout.zoom,
        positionX:
          magnifierLayout.width / 2 -
          (displayRect.x + displayRect.width / 2 - transform.offsetX) *
            magnifierLayout.zoom,
        positionY:
          magnifierLayout.height / 2 -
          (displayRect.y + displayRect.height / 2 - transform.offsetY) *
            magnifierLayout.zoom
      }
    : null;

  const normalizedMessage = message.trim();
  const normalizedLabel = target.label?.trim();
  const statusMessage = normalizedMessage
    ? normalizedMessage
    : normalizedLabel
      ? `${normalizedLabel} 위치를 안내하고 있습니다.`
      : '현재 화면의 안내 대상을 표시하고 있습니다.';

  return (
    <div
      id="overlay-target-highlight"
      data-testid="overlay-target-highlight"
      className="absolute inset-0 z-10"
      style={{ pointerEvents: 'none' }}
    >
      {dimPanels.map((panel) => {
        const selector = `dim-target-highlight-${panel.name}`;

        return (
          <div
            key={panel.name}
            id={selector}
            data-testid={selector}
            className="focus-dim-panel absolute z-0"
            aria-hidden="true"
            style={{
              left: panel.x,
              top: panel.y,
              width: panel.width,
              height: panel.height,
              pointerEvents: 'none'
            }}
          />
        );
      })}

      <div
        id="border-target-highlight"
        data-testid="border-target-highlight"
        className="target-highlight-border absolute z-20"
        aria-hidden="true"
        style={{
          boxSizing: 'border-box',
          left: displayRect.x,
          top: displayRect.y,
          width: displayRect.width,
          height: displayRect.height,
          pointerEvents: 'none'
        }}
      />

      <svg
        id="pointer-target-highlight"
        data-testid="pointer-target-highlight"
        className="target-highlight-pointer absolute z-30"
        data-placement={pointerPosition.placement}
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 32 40"
        width={TARGET_POINTER_SIZE.width}
        height={TARGET_POINTER_SIZE.height}
        style={{
          left: pointerPosition.x,
          top: pointerPosition.y,
          pointerEvents: 'none'
        }}
      >
        <g
          transform={
            pointerPosition.placement === 'bottom'
              ? 'rotate(180 16 20)'
              : undefined
          }
        >
          <path
            d="M7 3h18v21h5L16 38 2 24h5V3Z"
            fill="#facc15"
            stroke="#0f172a"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </g>
      </svg>

      {magnifierLayout && magnifierBackground && magnifierImageSrc ? (
        <div
          id="magnifier-target-highlight"
          data-testid="magnifier-target-highlight"
          className="target-focus-magnifier absolute z-40"
          data-placement={magnifierLayout.placement}
          aria-hidden="true"
          style={{
            left: magnifierLayout.x,
            top: magnifierLayout.y,
            width: magnifierLayout.width,
            height: magnifierLayout.height,
            backgroundImage: `url(${JSON.stringify(magnifierImageSrc)})`,
            backgroundSize: `${magnifierBackground.sizeX}px ${magnifierBackground.sizeY}px`,
            backgroundPosition: `${magnifierBackground.positionX}px ${magnifierBackground.positionY}px`,
            backgroundRepeat: 'no-repeat',
            pointerEvents: 'none'
          }}
        />
      ) : null}

      <span
        id="status-target-highlight"
        data-testid="status-target-highlight"
        className="sr-only"
      >
        {statusMessage}
      </span>
    </div>
  );
}
