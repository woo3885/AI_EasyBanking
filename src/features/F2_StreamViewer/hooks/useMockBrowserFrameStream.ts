import { useEffect, useState } from 'react';

import {
  MockBrowserFrameStream
} from '@/features/F2_StreamViewer/model/mock-browser-frame-stream';
import type { ViewerFrame } from '@/features/F2_StreamViewer/model/viewer-frame';

export interface UseMockBrowserFrameStreamOptions {
  frames: readonly ViewerFrame[];
  sessionId: string;
  intervalMs: number;
}

export interface UseMockBrowserFrameStreamResult {
  currentFrame: ViewerFrame | undefined;
}

export function useMockBrowserFrameStream({
  frames,
  sessionId,
  intervalMs
}: UseMockBrowserFrameStreamOptions): UseMockBrowserFrameStreamResult {
  const [currentFrame, setCurrentFrame] = useState<ViewerFrame>();

  useEffect(() => {
    setCurrentFrame(undefined);

    const stream = new MockBrowserFrameStream({
      frames,
      sessionId,
      intervalMs,
      onFrame: setCurrentFrame
    });

    stream.start();

    return () => {
      stream.stop();
    };
  }, [frames, sessionId, intervalMs]);

  return { currentFrame };
}
