import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEMO_VIEWER_FRAMES,
  MOCK_VIEWER_FRAME_INTERVAL_MS
} from '@/features/F2_StreamViewer/mocks/demo-viewer-frames';

import F2_StreamViewerPreview from './F2_StreamViewerPreview';

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

function completeImageLoad(image: MockImage) {
  act(() => {
    image.onload?.(new Event('load'));
  });
}

function advanceToNextFrame() {
  act(() => {
    vi.advanceTimersByTime(MOCK_VIEWER_FRAME_INTERVAL_MS);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  clearRect.mockClear();
  drawImage.mockClear();
  MockImage.instances = [];
  vi.stubGlobal('Image', MockImage);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    canvasContext
  );
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('F2_StreamViewerPreview', () => {
  it('Preview 최상위 selector를 제공한다', () => {
    render(<F2_StreamViewerPreview />);

    expect(screen.getByTestId('viewer-frame-stream-preview')).toHaveAttribute(
      'id',
      'viewer-frame-stream-preview'
    );
  });

  it('실제 WebSocket이 아닌 Mock Preview임을 안내한다', () => {
    render(<F2_StreamViewerPreview />);

    expect(screen.getByText('개발용 Mock Preview')).toBeInTheDocument();
    expect(
      screen.getByText(/실제 WebSocket 연결이 아닌/)
    ).toBeInTheDocument();
  });

  it('첫 프레임을 기존 F2_StreamViewer에 전달한다', () => {
    render(<F2_StreamViewerPreview />);

    expect(MockImage.instances).toHaveLength(1);
    expect(MockImage.instances[0].src).toBe(DEMO_VIEWER_FRAMES[0].imageSrc);
  });

  it('첫 이미지 onload 후 Canvas에 drawImage를 호출한다', () => {
    render(<F2_StreamViewerPreview />);
    clearRect.mockClear();

    completeImageLoad(MockImage.instances[0]);

    expect(clearRect).toHaveBeenCalledOnce();
    expect(drawImage).toHaveBeenCalledOnce();
  });

  it('timer 진행 후 다음 ViewerFrame을 전달한다', () => {
    render(<F2_StreamViewerPreview />);

    advanceToNextFrame();

    expect(MockImage.instances).toHaveLength(2);
    expect(MockImage.instances[1].src).toBe(DEMO_VIEWER_FRAMES[1].imageSrc);
  });

  it('다음 이미지 onload 후 Canvas를 다시 그린다', () => {
    render(<F2_StreamViewerPreview />);
    clearRect.mockClear();
    completeImageLoad(MockImage.instances[0]);

    advanceToNextFrame();
    completeImageLoad(MockImage.instances[1]);

    expect(drawImage).toHaveBeenCalledTimes(2);
  });

  it('마지막 프레임 이미지를 Canvas에 그린다', () => {
    render(<F2_StreamViewerPreview />);

    advanceToNextFrame();
    const lastImage = MockImage.instances[1];
    completeImageLoad(lastImage);

    expect(drawImage).toHaveBeenLastCalledWith(
      lastImage,
      0,
      0,
      1280,
      720
    );
  });

  it('각 프레임을 그리기 전에 clearRect를 호출한다', () => {
    render(<F2_StreamViewerPreview />);
    clearRect.mockClear();

    completeImageLoad(MockImage.instances[0]);
    advanceToNextFrame();
    completeImageLoad(MockImage.instances[1]);

    expect(clearRect).toHaveBeenCalledTimes(2);
    expect(clearRect.mock.invocationCallOrder[0]).toBeLessThan(
      drawImage.mock.invocationCallOrder[0]
    );
    expect(clearRect.mock.invocationCallOrder[1]).toBeLessThan(
      drawImage.mock.invocationCallOrder[1]
    );
  });

  it('Mock 상태 live region을 다음 프레임 정보로 갱신한다', () => {
    render(<F2_StreamViewerPreview />);
    const status = screen.getByTestId('status-mock-frame-stream');

    expect(status).toHaveAttribute('role', 'status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('1/2 프레임 표시 · timestamp 1000');

    advanceToNextFrame();
    expect(status).toHaveTextContent('2/2 프레임 표시 · timestamp 2000');
  });

  it('unmount 후 추가 프레임을 만들거나 렌더링하지 않는다', () => {
    const { unmount } = render(<F2_StreamViewerPreview />);
    expect(MockImage.instances).toHaveLength(1);

    unmount();
    advanceToNextFrame();

    expect(MockImage.instances).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('기존 F2 Viewer와 Canvas selector를 유지한다', () => {
    render(<F2_StreamViewerPreview />);

    expect(screen.getByTestId('viewer-remote-screen')).toHaveAttribute(
      'id',
      'viewer-remote-screen'
    );
    expect(screen.getByTestId('canvas-remote-screen')).toHaveAttribute(
      'id',
      'canvas-remote-screen'
    );
    expect(screen.getByTestId('status-viewer-frame')).toHaveAttribute(
      'id',
      'status-viewer-frame'
    );
  });

  it('연속 프레임에서 이전 이미지의 늦은 onload를 무시한다', () => {
    render(<F2_StreamViewerPreview />);
    const staleOnload = MockImage.instances[0].onload;

    advanceToNextFrame();
    act(() => {
      staleOnload?.(new Event('load'));
    });
    expect(drawImage).not.toHaveBeenCalled();

    completeImageLoad(MockImage.instances[1]);
    expect(drawImage).toHaveBeenCalledOnce();
  });
});
