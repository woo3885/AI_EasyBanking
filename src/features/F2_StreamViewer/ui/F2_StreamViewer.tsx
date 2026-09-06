import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from 'react';

import { useCanvasDisplaySize } from '@/features/F2_StreamViewer/hooks/useCanvasDisplaySize';
import type { ViewerSize } from '@/features/F2_StreamViewer/model/coordinate-transform';
import {
  createViewerClickAction,
  createViewerScrollAction,
  type ViewerInteractionFrameMetadata,
  type ViewerRemoteAction
} from '@/features/F2_StreamViewer/model/viewer-interaction';
import {
  VIEWER_FRAME_ASPECT_RATIO,
  VIEWER_FRAME_HEIGHT,
  VIEWER_FRAME_WIDTH
} from '@/features/F2_StreamViewer/model/viewer-constants';
import type {
  ViewerFrame,
  ViewerFrameStatus
} from '@/features/F2_StreamViewer/model/viewer-frame';
import { Panel } from '@/shared/ui/Panel';
import { StatusBadge, type StatusBadgeVariant } from '@/shared/ui/StatusBadge';
import { Text } from '@/shared/ui/Text';

export interface F2StreamViewerProps {
  frame?: ViewerFrame;
  renderOverlay?: (context: ViewerOverlayRenderContext) => ReactNode;
  interactionDisabled?: boolean;
  interactionBusy?: boolean;
  onRemoteAction?: (action: ViewerRemoteAction) => void;
}

export interface ViewerOverlayRenderContext {
  displaySize: ViewerSize;
  frameStatus: ViewerFrameStatus;
  imageSrc?: string;
}

const STATUS_LABELS: Record<ViewerFrameStatus, string> = {
  EMPTY: '수신된 원격 화면이 없습니다.',
  LOADING: '원격 화면을 불러오고 있습니다.',
  READY: '원격 화면 표시가 완료되었습니다.',
  ERROR: '원격 화면을 표시하지 못했습니다.'
};

const STATUS_VARIANTS: Record<ViewerFrameStatus, StatusBadgeVariant> = {
  EMPTY: 'neutral',
  LOADING: 'progress',
  READY: 'success',
  ERROR: 'danger'
};

function getInteractionFrame(
  frame?: ViewerFrame
): ViewerInteractionFrameMetadata | null {
  if (!frame || typeof frame.metadata !== 'object' || frame.metadata === null) {
    return null;
  }

  const metadata = frame.metadata as unknown as Record<string, unknown>;
  if (
    typeof metadata.frameId !== 'string' ||
    !Number.isSafeInteger(metadata.sequence) ||
    metadata.width !== VIEWER_FRAME_WIDTH ||
    metadata.height !== VIEWER_FRAME_HEIGHT
  ) {
    return null;
  }

  return {
    frameId: metadata.frameId,
    sequence: Number(metadata.sequence),
    width: VIEWER_FRAME_WIDTH,
    height: VIEWER_FRAME_HEIGHT
  };
}

export default function F2_StreamViewer({
  frame,
  renderOverlay,
  interactionDisabled = false,
  interactionBusy = false,
  onRemoteAction
}: F2StreamViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasElement, setCanvasElement] =
    useState<HTMLCanvasElement | null>(null);
  const displaySize = useCanvasDisplaySize(canvasElement);
  const [frameStatus, setFrameStatus] = useState<ViewerFrameStatus>(
    frame ? 'LOADING' : 'EMPTY'
  );
  const [frameStatusSource, setFrameStatusSource] = useState(frame);
  const [statusMessage, setStatusMessage] = useState(
    frame ? STATUS_LABELS.LOADING : STATUS_LABELS.EMPTY
  );
  const setCanvasReference = useCallback(
    (element: HTMLCanvasElement | null) => {
      canvasRef.current = element;
      setCanvasElement((currentElement) =>
        currentElement === element ? currentElement : element
      );
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;

    setFrameStatusSource(frame);

    if (!frame) {
      setFrameStatus('EMPTY');
      setStatusMessage(STATUS_LABELS.EMPTY);
      canvas?.getContext('2d')?.clearRect(
        0,
        0,
        VIEWER_FRAME_WIDTH,
        VIEWER_FRAME_HEIGHT
      );
      return () => {
        cancelled = true;
      };
    }

    setFrameStatus('LOADING');
    setStatusMessage(STATUS_LABELS.LOADING);

    if (
      frame.metadata.width !== VIEWER_FRAME_WIDTH ||
      frame.metadata.height !== VIEWER_FRAME_HEIGHT
    ) {
      setFrameStatus('ERROR');
      setStatusMessage(
        `지원하지 않는 프레임 해상도입니다. ${VIEWER_FRAME_WIDTH} × ${VIEWER_FRAME_HEIGHT} 프레임이 필요합니다.`
      );
      return () => {
        cancelled = true;
      };
    }

    const context = canvas?.getContext('2d');

    if (!context) {
      setFrameStatus('ERROR');
      setStatusMessage('Canvas 2D 화면을 사용할 수 없습니다.');
      return () => {
        cancelled = true;
      };
    }

    const image = new Image();

    image.onload = () => {
      if (cancelled) {
        return;
      }

      context.clearRect(0, 0, VIEWER_FRAME_WIDTH, VIEWER_FRAME_HEIGHT);
      context.drawImage(
        image,
        0,
        0,
        VIEWER_FRAME_WIDTH,
        VIEWER_FRAME_HEIGHT
      );
      setFrameStatus('READY');
      setStatusMessage(STATUS_LABELS.READY);
    };

    image.onerror = () => {
      if (cancelled) {
        return;
      }

      setFrameStatus('ERROR');
      setStatusMessage('원격 화면 이미지를 불러오지 못했습니다.');
    };

    image.src = frame.imageSrc;

    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [frame]);

  const overlayFrameStatus: ViewerFrameStatus =
    frameStatusSource === frame
      ? frameStatus
      : frame
        ? 'LOADING'
        : 'EMPTY';

  const interactionFrame = getInteractionFrame(frame);
  const canInteract =
    overlayFrameStatus === 'READY' &&
    interactionFrame !== null &&
    !interactionDisabled &&
    !interactionBusy &&
    onRemoteAction !== undefined;

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (
        !canInteract ||
        event.isPrimary === false ||
        (typeof event.button === 'number' && event.button !== 0)
      ) {
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas || !interactionFrame) {
        return;
      }

      const action = createViewerClickAction({
        clientX: event.clientX,
        clientY: event.clientY,
        displayBounds: canvas.getBoundingClientRect(),
        frame: interactionFrame
      });
      if (!action) {
        return;
      }

      event.preventDefault();
      onRemoteAction?.(action);
    },
    [canInteract, interactionFrame, onRemoteAction]
  );

  useEffect(() => {
    const canvas = canvasElement;
    if (!canvas) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      if (!canInteract || !interactionFrame) {
        return;
      }

      const action = createViewerScrollAction({
        clientX: event.clientX,
        clientY: event.clientY,
        displayBounds: canvas.getBoundingClientRect(),
        frame: interactionFrame,
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        deltaMode: event.deltaMode
      });
      if (!action) {
        return;
      }

      event.preventDefault();
      onRemoteAction?.(action);
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [canInteract, canvasElement, interactionFrame, onRemoteAction]);

  return (
    <Panel
      id="viewer-remote-screen"
      data-testid="viewer-remote-screen"
      title="원격 화면 Viewer"
      description={`${VIEWER_FRAME_WIDTH} × ${VIEWER_FRAME_HEIGHT} 기준 원격 화면 표시 영역입니다.`}
    >
      <div
        className="w-full overflow-hidden rounded-xl border-2 border-border bg-slate-950"
        style={{ aspectRatio: VIEWER_FRAME_ASPECT_RATIO }}
        aria-busy={interactionBusy}
      >
        <div className="relative h-full w-full">
          <canvas
            ref={setCanvasReference}
            id="canvas-remote-screen"
            data-testid="canvas-remote-screen"
            width={VIEWER_FRAME_WIDTH}
            height={VIEWER_FRAME_HEIGHT}
            className="block h-auto w-full"
            role="img"
            aria-disabled={!canInteract}
            onPointerUp={handlePointerUp}
            aria-label="1280 × 720 원격 브라우저 화면"
          >
            Canvas를 지원하지 않는 환경에서는 원격 화면을 표시할 수 없습니다.
          </canvas>
          {renderOverlay?.({
            displaySize,
            frameStatus: overlayFrameStatus,
            imageSrc: frame?.imageSrc
          })}
        </div>
      </div>

      <div
        id="status-viewer-frame"
        data-testid="status-viewer-frame"
        className="mt-4 flex flex-wrap items-center gap-3"
        role="status"
        aria-live="polite"
      >
        <StatusBadge variant={STATUS_VARIANTS[frameStatus]}>
          {frameStatus}
        </StatusBadge>
        <Text variant="body">{statusMessage}</Text>
      </div>
    </Panel>
  );
}
