import { useEffect, useState } from 'react';

import type { ViewerSize } from '@/features/F2_StreamViewer/model/coordinate-transform';

const EMPTY_VIEWER_SIZE: ViewerSize = { width: 0, height: 0 };

function normalizeDimension(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function useCanvasDisplaySize(
  element: HTMLCanvasElement | null
): ViewerSize {
  const [displaySize, setDisplaySize] = useState<ViewerSize>(EMPTY_VIEWER_SIZE);

  useEffect(() => {
    if (!element) {
      setDisplaySize((currentSize) =>
        currentSize.width === 0 && currentSize.height === 0
          ? currentSize
          : EMPTY_VIEWER_SIZE
      );
      return;
    }

    const measure = () => {
      const rect = element.getBoundingClientRect();
      const nextSize = {
        width: normalizeDimension(rect.width),
        height: normalizeDimension(rect.height)
      };

      setDisplaySize((currentSize) =>
        currentSize.width === nextSize.width &&
        currentSize.height === nextSize.height
          ? currentSize
          : nextSize
      );
    };

    measure();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure);
      observer.observe(element);

      return () => {
        observer.disconnect();
      };
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', measure);

      return () => {
        window.removeEventListener('resize', measure);
      };
    }
  }, [element]);

  return displaySize;
}
