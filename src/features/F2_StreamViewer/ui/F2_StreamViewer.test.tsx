import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  VIEWER_FRAME_HEIGHT,
  VIEWER_FRAME_WIDTH
} from '@/features/F2_StreamViewer/model/viewer-constants';
import type { ViewerFrame } from '@/features/F2_StreamViewer/model/viewer-frame';

import F2_StreamViewer from './F2_StreamViewer';

const clearRect = vi.fn();
const drawImage = vi.fn();
const canvasContext = {
  clearRect,
  drawImage
} as unknown as CanvasRenderingContext2D;

class MockImage {
  static instances: MockImage[] = [];

  onload: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  src = '';

  constructor() {
    MockImage.instances.push(this);
  }
}

interface MockResizeObserverRecord {
  callback: ResizeObserverCallback;
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

const resizeObserverRecords: MockResizeObserverRecord[] = [];
let canvasDisplaySize = { width: 640, height: 360 };

class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();

  constructor(callback: ResizeObserverCallback) {
    resizeObserverRecords.push({
      callback,
      observe: this.observe,
      disconnect: this.disconnect
    });
  }
}

function createFrame(
  imageSrc = '/frame-one.png',
  width = VIEWER_FRAME_WIDTH,
  height = VIEWER_FRAME_HEIGHT
): ViewerFrame {
  return {
    metadata: {
      type: 'BROWSER_FRAME',
      sessionId: 'viewer-test-session',
      timestamp: 1,
      width,
      height
    },
    imageSrc
  };
}

class MockPointerEvent extends MouseEvent {
  readonly isPrimary: boolean;
  readonly pointerType: string;

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.isPrimary = init.isPrimary ?? true;
    this.pointerType = init.pointerType ?? 'mouse';
  }
}

function createInteractiveFrame(): ViewerFrame {
  const base = createFrame();
  return {
    ...base,
    metadata: {
      ...base.metadata,
      frameId: 'frm-current',
      sequence: 7
    }
  } as ViewerFrame;
}

function completeImageLoad(
  image = MockImage.instances[MockImage.instances.length - 1]
) {
  act(() => {
    image?.onload?.(new Event('load'));
  });
}

beforeEach(() => {
  clearRect.mockClear();
  drawImage.mockClear();
  MockImage.instances = [];
  resizeObserverRecords.length = 0;
  canvasDisplaySize = { width: 640, height: 360 };
  vi.stubGlobal('Image', MockImage);
  vi.stubGlobal('PointerEvent', MockPointerEvent);
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    canvasContext
  );
  vi.spyOn(
    HTMLCanvasElement.prototype,
    'getBoundingClientRect'
  ).mockImplementation(
    () =>
      ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: canvasDisplaySize.width,
        bottom: canvasDisplaySize.height,
        width: canvasDisplaySize.width,
        height: canvasDisplaySize.height,
        toJSON: () => undefined
      }) as DOMRect
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('F2_StreamViewer', () => {
  it('renderOverlay가 없으면 기존 Canvas만 렌더링한다', () => {
    render(<F2_StreamViewer />);

    expect(screen.getByTestId('canvas-remote-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('test-viewer-overlay')).not.toBeInTheDocument();
  });

  it('renderOverlay 결과를 Canvas와 같은 relative stage에 렌더링한다', () => {
    render(
      <F2_StreamViewer
        renderOverlay={() => (
          <div data-testid="test-viewer-overlay">overlay</div>
        )}
      />
    );
    const canvas = screen.getByTestId('canvas-remote-screen');
    const overlay = screen.getByTestId('test-viewer-overlay');

    expect(canvas.parentElement).toHaveClass('relative');
    expect(canvas.parentElement).toContainElement(overlay);
  });

  it('Canvas 실제 표시 크기만 renderOverlay에 전달한다', () => {
    render(
      <F2_StreamViewer
        renderOverlay={({ displaySize }) => (
          <output data-testid="test-viewer-overlay-size">
            {displaySize.width}×{displaySize.height}
          </output>
        )}
      />
    );

    expect(screen.getByTestId('test-viewer-overlay-size')).toHaveTextContent(
      '640×360'
    );
    expect(resizeObserverRecords[0].observe).toHaveBeenCalledWith(
      screen.getByTestId('canvas-remote-screen')
    );
  });

  it('Canvas resize 후 renderOverlay displaySize를 갱신한다', () => {
    render(
      <F2_StreamViewer
        renderOverlay={({ displaySize }) => (
          <output data-testid="test-viewer-overlay-size">
            {displaySize.width}×{displaySize.height}
          </output>
        )}
      />
    );

    canvasDisplaySize = { width: 960, height: 540 };
    act(() => {
      resizeObserverRecords[0].callback([], {} as ResizeObserver);
    });

    expect(screen.getByTestId('test-viewer-overlay-size')).toHaveTextContent(
      '960×540'
    );
  });

  it('Canvas가 0×0이면 renderOverlay에도 0×0을 전달한다', () => {
    canvasDisplaySize = { width: 0, height: 0 };

    render(
      <F2_StreamViewer
        renderOverlay={({ displaySize }) => (
          <output data-testid="test-viewer-overlay-size">
            {displaySize.width}×{displaySize.height}
          </output>
        )}
      />
    );

    expect(screen.getByTestId('test-viewer-overlay-size')).toHaveTextContent(
      '0×0'
    );
  });

  it('Canvas width를 기준 프레임 너비로 설정한다', () => {
    render(<F2_StreamViewer />);

    expect(screen.getByTestId('canvas-remote-screen')).toHaveAttribute(
      'width',
      String(VIEWER_FRAME_WIDTH)
    );
  });

  it('Canvas height를 기준 프레임 높이로 설정한다', () => {
    render(<F2_StreamViewer />);

    expect(screen.getByTestId('canvas-remote-screen')).toHaveAttribute(
      'height',
      String(VIEWER_FRAME_HEIGHT)
    );
  });

  it('Viewer, Canvas, 상태 요소의 id와 data-testid를 동일하게 유지한다', () => {
    render(<F2_StreamViewer />);

    ['viewer-remote-screen', 'canvas-remote-screen', 'status-viewer-frame'].forEach(
      (selector) => {
        expect(screen.getByTestId(selector)).toHaveAttribute('id', selector);
      }
    );
  });

  it('프레임이 없으면 EMPTY 상태를 안내한다', () => {
    render(<F2_StreamViewer />);

    expect(screen.getByText('EMPTY')).toBeInTheDocument();
    expect(screen.getByText('수신된 원격 화면이 없습니다.')).toBeInTheDocument();
  });

  it('프레임을 전달하면 Image 로딩 동안 LOADING 상태를 안내한다', () => {
    render(<F2_StreamViewer frame={createFrame()} />);

    expect(screen.getByText('LOADING')).toBeInTheDocument();
    expect(MockImage.instances[0].src).toBe('/frame-one.png');
  });

  it('Image 로드가 완료되면 Canvas에 이미지를 그린다', () => {
    render(<F2_StreamViewer frame={createFrame()} />);

    completeImageLoad();

    expect(clearRect).toHaveBeenCalledOnce();
    expect(clearRect.mock.invocationCallOrder[0]).toBeLessThan(
      drawImage.mock.invocationCallOrder[0]
    );
    expect(drawImage).toHaveBeenCalledOnce();
  });

  it('drawImage 대상 영역을 전체 1280 × 720 좌표로 사용한다', () => {
    render(<F2_StreamViewer frame={createFrame()} />);
    const image = MockImage.instances[0];

    completeImageLoad(image);

    expect(drawImage).toHaveBeenCalledWith(
      image,
      0,
      0,
      VIEWER_FRAME_WIDTH,
      VIEWER_FRAME_HEIGHT
    );
  });

  it('Image 로드와 그리기가 끝나면 READY 상태를 안내한다', () => {
    render(<F2_StreamViewer frame={createFrame()} />);

    completeImageLoad();

    expect(screen.getByText('READY')).toBeInTheDocument();
    expect(
      screen.getByText('원격 화면 표시가 완료되었습니다.')
    ).toBeInTheDocument();
  });

  it('Image 로드가 실패하면 ERROR 상태를 안내한다', () => {
    render(<F2_StreamViewer frame={createFrame()} />);

    act(() => {
      MockImage.instances[0].onerror?.(new Event('error'));
    });

    expect(screen.getByText('ERROR')).toBeInTheDocument();
    expect(
      screen.getByText('원격 화면 이미지를 불러오지 못했습니다.')
    ).toBeInTheDocument();
  });

  it('1280 × 720이 아닌 metadata를 오류로 처리한다', () => {
    render(
      <F2_StreamViewer
        frame={createFrame('/unsupported-frame.png', VIEWER_FRAME_WIDTH / 2)}
      />
    );

    expect(screen.getByText('ERROR')).toBeInTheDocument();
    expect(
      screen.getByText(/지원하지 않는 프레임 해상도입니다/)
    ).toBeInTheDocument();
    expect(MockImage.instances).toHaveLength(0);
    expect(drawImage).not.toHaveBeenCalled();
  });

  it('Canvas 2D context를 얻지 못하면 ERROR 상태를 안내한다', () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValueOnce(null);

    render(<F2_StreamViewer frame={createFrame()} />);

    expect(screen.getByText('ERROR')).toBeInTheDocument();
    expect(
      screen.getByText('Canvas 2D 화면을 사용할 수 없습니다.')
    ).toBeInTheDocument();
    expect(drawImage).not.toHaveBeenCalled();
  });

  it('frame 교체 후 이전 Image onload가 최신 프레임을 덮지 않는다', () => {
    const { rerender } = render(
      <F2_StreamViewer frame={createFrame('/old-frame.png')} />
    );
    const staleOnload = MockImage.instances[0].onload;

    rerender(<F2_StreamViewer frame={createFrame('/latest-frame.png')} />);

    act(() => {
      staleOnload?.(new Event('load'));
    });
    expect(drawImage).not.toHaveBeenCalled();

    completeImageLoad(MockImage.instances[1]);
    expect(drawImage).toHaveBeenCalledOnce();
    expect(drawImage).toHaveBeenCalledWith(
      MockImage.instances[1],
      0,
      0,
      VIEWER_FRAME_WIDTH,
      VIEWER_FRAME_HEIGHT
    );
  });

  it('Canvas 설명, fallback 문구와 상태 live region을 제공한다', () => {
    render(<F2_StreamViewer />);

    expect(
      screen.getByRole('img', { name: '1280 × 720 원격 브라우저 화면' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Canvas를 지원하지 않는 환경에서는 원격 화면을 표시할 수 없습니다.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('renderOverlay에 EMPTY frameStatus와 빈 imageSrc를 전달한다', () => {
    render(
      <F2_StreamViewer
        renderOverlay={({ frameStatus, imageSrc }) => (
          <output data-testid="test-overlay-frame-context">
            {frameStatus}:{imageSrc ?? 'none'}
          </output>
        )}
      />
    );

    expect(screen.getByTestId('test-overlay-frame-context')).toHaveTextContent(
      'EMPTY:none'
    );
  });

  it('renderOverlay에 현재 imageSrc와 LOADING 상태를 전달한다', () => {
    render(
      <F2_StreamViewer
        frame={createFrame('/loading-frame.png')}
        renderOverlay={({ frameStatus, imageSrc }) => (
          <output data-testid="test-overlay-frame-context">
            {frameStatus}:{imageSrc}
          </output>
        )}
      />
    );

    expect(screen.getByTestId('test-overlay-frame-context')).toHaveTextContent(
      'LOADING:/loading-frame.png'
    );
  });

  it('Image load 완료 후 renderOverlay에 READY 상태를 전달한다', () => {
    render(
      <F2_StreamViewer
        frame={createFrame('/ready-frame.png')}
        renderOverlay={({ frameStatus }) => (
          <output data-testid="test-overlay-frame-status">{frameStatus}</output>
        )}
      />
    );

    completeImageLoad();

    expect(screen.getByTestId('test-overlay-frame-status')).toHaveTextContent(
      'READY'
    );
  });

  it('Image load 실패 후 renderOverlay에 ERROR 상태를 전달한다', () => {
    render(
      <F2_StreamViewer
        frame={createFrame('/error-frame.png')}
        renderOverlay={({ frameStatus }) => (
          <output data-testid="test-overlay-frame-status">{frameStatus}</output>
        )}
      />
    );

    act(() => {
      MockImage.instances[0].onerror?.(new Event('error'));
    });

    expect(screen.getByTestId('test-overlay-frame-status')).toHaveTextContent(
      'ERROR'
    );
  });

  it('frame 교체 시 이전 READY 대신 새 frame의 LOADING을 즉시 전달한다', () => {
    const firstFrame = createFrame('/first-frame.png');
    const nextFrame = createFrame('/next-frame.png');
    const { rerender } = render(
      <F2_StreamViewer
        frame={firstFrame}
        renderOverlay={({ frameStatus, imageSrc }) => (
          <output data-testid="test-overlay-frame-context">
            {frameStatus}:{imageSrc}
          </output>
        )}
      />
    );
    completeImageLoad();

    expect(screen.getByTestId('test-overlay-frame-context')).toHaveTextContent(
      'READY:/first-frame.png'
    );

    rerender(
      <F2_StreamViewer
        frame={nextFrame}
        renderOverlay={({ frameStatus, imageSrc }) => (
          <output data-testid="test-overlay-frame-context">
            {frameStatus}:{imageSrc}
          </output>
        )}
      />
    );

    expect(screen.getByTestId('test-overlay-frame-context')).toHaveTextContent(
      'LOADING:/next-frame.png'
    );
  });

  it('READY frame의 primary pointer를 현재 metadata CLICK으로 한 번 전달한다', () => {
    const onRemoteAction = vi.fn();
    render(
      <F2_StreamViewer
        frame={createInteractiveFrame()}
        onRemoteAction={onRemoteAction}
      />
    );
    completeImageLoad();

    fireEvent.pointerUp(screen.getByTestId('canvas-remote-screen'), {
      clientX: 320,
      clientY: 180,
      button: 0,
      isPrimary: true,
      pointerType: 'mouse'
    });

    expect(onRemoteAction).toHaveBeenCalledTimes(1);
    expect(onRemoteAction).toHaveBeenCalledWith({
      type: 'CLICK',
      x: 640,
      y: 360,
      frameId: 'frm-current',
      sequence: 7
    });
  });

  it('touch primary pointer도 중복 없이 CLICK 한 번만 전달한다', () => {
    const onRemoteAction = vi.fn();
    render(
      <F2_StreamViewer
        frame={createInteractiveFrame()}
        onRemoteAction={onRemoteAction}
      />
    );
    completeImageLoad();

    fireEvent.pointerUp(screen.getByTestId('canvas-remote-screen'), {
      clientX: 160,
      clientY: 90,
      button: 0,
      isPrimary: true,
      pointerType: 'touch'
    });

    expect(onRemoteAction).toHaveBeenCalledTimes(1);
    expect(onRemoteAction).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'CLICK', x: 320, y: 180 })
    );
  });

  it('pixel wheel을 SCROLL 한 번으로 전달하고 그때만 기본 scroll을 막는다', () => {
    const onRemoteAction = vi.fn();
    render(
      <F2_StreamViewer
        frame={createInteractiveFrame()}
        onRemoteAction={onRemoteAction}
      />
    );
    completeImageLoad();
    const canvas = screen.getByTestId('canvas-remote-screen');
    const wheel = new WheelEvent('wheel', {
      clientX: 320,
      clientY: 180,
      deltaX: -20,
      deltaY: 120,
      deltaMode: 0,
      cancelable: true
    });

    canvas.dispatchEvent(wheel);

    expect(wheel.defaultPrevented).toBe(true);
    expect(onRemoteAction).toHaveBeenCalledTimes(1);
    expect(onRemoteAction).toHaveBeenCalledWith({
      type: 'SCROLL',
      x: 640,
      y: 360,
      deltaX: -20,
      deltaY: 120,
      frameId: 'frm-current',
      sequence: 7
    });
  });

  it('disabled·busy·LOADING에서는 callback과 page scroll을 막지 않는다', () => {
    const onRemoteAction = vi.fn();
    const { rerender } = render(
      <F2_StreamViewer
        frame={createInteractiveFrame()}
        interactionDisabled
        onRemoteAction={onRemoteAction}
      />
    );
    completeImageLoad();
    const canvas = screen.getByTestId('canvas-remote-screen');
    const disabledWheel = new WheelEvent('wheel', {
      clientX: 320,
      clientY: 180,
      deltaY: 100,
      deltaMode: 0,
      cancelable: true
    });
    canvas.dispatchEvent(disabledWheel);
    fireEvent.pointerUp(canvas, {
      clientX: 320,
      clientY: 180,
      button: 0,
      isPrimary: true
    });

    expect(disabledWheel.defaultPrevented).toBe(false);
    expect(onRemoteAction).not.toHaveBeenCalled();

    rerender(
      <F2_StreamViewer
        frame={createInteractiveFrame()}
        interactionBusy
        onRemoteAction={onRemoteAction}
      />
    );
    fireEvent.pointerUp(canvas, {
      clientX: 320,
      clientY: 180,
      button: 0,
      isPrimary: true
    });
    expect(onRemoteAction).not.toHaveBeenCalled();
  });

  it('Canvas 밖·letterbox·보조 pointer와 mount만으로 callback하지 않는다', () => {
    canvasDisplaySize = { width: 1000, height: 700 };
    const onRemoteAction = vi.fn();
    render(
      <F2_StreamViewer
        frame={createInteractiveFrame()}
        onRemoteAction={onRemoteAction}
      />
    );
    completeImageLoad();
    const canvas = screen.getByTestId('canvas-remote-screen');

    expect(onRemoteAction).not.toHaveBeenCalled();
    fireEvent.pointerUp(canvas, {
      clientX: 500,
      clientY: 10,
      button: 0,
      isPrimary: true
    });
    fireEvent.pointerUp(canvas, {
      clientX: 500,
      clientY: 350,
      button: 2,
      isPrimary: true
    });
    fireEvent.pointerUp(canvas, {
      clientX: 1001,
      clientY: 350,
      button: 0,
      isPrimary: true
    });

    expect(onRemoteAction).not.toHaveBeenCalled();
  });
});
