import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCanvasDisplaySize } from './useCanvasDisplaySize';

type ObserverCallback = ResizeObserverCallback;

interface MockObserverRecord {
  callback: ObserverCallback;
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

const observerRecords: MockObserverRecord[] = [];

class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();

  constructor(callback: ObserverCallback) {
    observerRecords.push({
      callback,
      observe: this.observe,
      disconnect: this.disconnect
    });
  }
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  let currentWidth = width;
  let currentHeight = height;

  vi.spyOn(canvas, 'getBoundingClientRect').mockImplementation(
    () =>
      ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: currentWidth,
        bottom: currentHeight,
        width: currentWidth,
        height: currentHeight,
        toJSON: () => undefined
      }) as DOMRect
  );
  Object.assign(canvas, {
    setMockSize(nextWidth: number, nextHeight: number) {
      currentWidth = nextWidth;
      currentHeight = nextHeight;
    }
  });

  return canvas;
}

function setCanvasSize(
  canvas: HTMLCanvasElement,
  width: number,
  height: number
) {
  (
    canvas as HTMLCanvasElement & {
      setMockSize: (nextWidth: number, nextHeight: number) => void;
    }
  ).setMockSize(width, height);
}

function notifyResize(recordIndex = observerRecords.length - 1) {
  act(() => {
    observerRecords[recordIndex].callback([], {} as ResizeObserver);
  });
}

beforeEach(() => {
  observerRecords.length = 0;
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('useCanvasDisplaySize', () => {
  it('element가 null이면 0×0을 반환한다', () => {
    const { result } = renderHook(() => useCanvasDisplaySize(null));

    expect(result.current).toEqual({ width: 0, height: 0 });
  });

  it('Canvas 연결 직후 getBoundingClientRect로 최초 크기를 측정한다', () => {
    const canvas = createCanvas(640, 360);
    const { result } = renderHook(() => useCanvasDisplaySize(canvas));

    expect(canvas.getBoundingClientRect).toHaveBeenCalled();
    expect(result.current).toEqual({ width: 640, height: 360 });
  });

  it('ResizeObserver가 Canvas를 직접 관찰한다', () => {
    const canvas = createCanvas(640, 360);

    renderHook(() => useCanvasDisplaySize(canvas));

    expect(observerRecords[0].observe).toHaveBeenCalledWith(canvas);
  });

  it('ResizeObserver callback 이후 표시 크기를 갱신한다', () => {
    const canvas = createCanvas(640, 360);
    const { result } = renderHook(() => useCanvasDisplaySize(canvas));

    setCanvasSize(canvas, 960, 540);
    notifyResize();

    expect(result.current).toEqual({ width: 960, height: 540 });
  });

  it('동일한 크기에서는 기존 결과 객체를 유지한다', () => {
    const canvas = createCanvas(640, 360);
    const { result } = renderHook(() => useCanvasDisplaySize(canvas));
    const previousResult = result.current;

    notifyResize();

    expect(result.current).toBe(previousResult);
  });

  it('0×0 측정값을 반영한다', () => {
    const canvas = createCanvas(640, 360);
    const { result } = renderHook(() => useCanvasDisplaySize(canvas));

    setCanvasSize(canvas, 0, 0);
    notifyResize();

    expect(result.current).toEqual({ width: 0, height: 0 });
  });

  it('음수 크기를 0으로 처리한다', () => {
    const canvas = createCanvas(-10, -20);
    const { result } = renderHook(() => useCanvasDisplaySize(canvas));

    expect(result.current).toEqual({ width: 0, height: 0 });
  });

  it('NaN과 Infinity를 0으로 처리한다', () => {
    const canvas = createCanvas(Number.NaN, Number.POSITIVE_INFINITY);
    const { result } = renderHook(() => useCanvasDisplaySize(canvas));

    expect(result.current).toEqual({ width: 0, height: 0 });
  });

  it('element 교체 시 이전 observer를 disconnect한다', () => {
    const firstCanvas = createCanvas(640, 360);
    const secondCanvas = createCanvas(960, 540);
    const { rerender } = renderHook(
      ({ canvas }) => useCanvasDisplaySize(canvas),
      { initialProps: { canvas: firstCanvas as HTMLCanvasElement | null } }
    );

    rerender({ canvas: secondCanvas });

    expect(observerRecords[0].disconnect).toHaveBeenCalledOnce();
    expect(observerRecords[1].observe).toHaveBeenCalledWith(secondCanvas);
  });

  it('unmount 시 observer를 disconnect한다', () => {
    const canvas = createCanvas(640, 360);
    const { unmount } = renderHook(() => useCanvasDisplaySize(canvas));

    unmount();

    expect(observerRecords[0].disconnect).toHaveBeenCalledOnce();
  });

  it('ResizeObserver 미지원 시 window resize로 다시 측정한다', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const canvas = createCanvas(640, 360);
    const { result } = renderHook(() => useCanvasDisplaySize(canvas));

    setCanvasSize(canvas, 800, 450);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toEqual({ width: 800, height: 450 });
  });

  it('fallback cleanup에서 window resize listener를 제거한다', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const removeEventListener = vi.spyOn(window, 'removeEventListener');
    const canvas = createCanvas(640, 360);
    const { unmount } = renderHook(() => useCanvasDisplaySize(canvas));

    unmount();

    expect(removeEventListener).toHaveBeenCalledWith(
      'resize',
      expect.any(Function)
    );
  });
});
