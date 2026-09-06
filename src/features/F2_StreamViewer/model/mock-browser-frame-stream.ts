import type { ViewerFrame } from '@/features/F2_StreamViewer/model/viewer-frame';

export interface MockBrowserFrameStreamOptions {
  frames: readonly ViewerFrame[];
  sessionId: string;
  intervalMs: number;
  onFrame: (frame: ViewerFrame) => void;
}

export function selectValidMockFrames(
  frames: readonly ViewerFrame[],
  sessionId: string
): ViewerFrame[] {
  let lastAcceptedTimestamp: number | undefined;

  return frames.filter((frame) => {
    const { metadata } = frame;

    if (
      metadata.sessionId !== sessionId ||
      !Number.isFinite(metadata.timestamp)
    ) {
      return false;
    }

    if (
      lastAcceptedTimestamp !== undefined &&
      metadata.timestamp <= lastAcceptedTimestamp
    ) {
      return false;
    }

    lastAcceptedTimestamp = metadata.timestamp;
    return true;
  });
}

export class MockBrowserFrameStream {
  private readonly frames: readonly ViewerFrame[];
  private readonly intervalMs: number;
  private readonly onFrame: (frame: ViewerFrame) => void;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private nextFrameIndex = 0;
  private running = false;

  constructor({
    frames,
    sessionId,
    intervalMs,
    onFrame
  }: MockBrowserFrameStreamOptions) {
    this.frames = selectValidMockFrames(frames, sessionId);
    this.intervalMs = Number.isFinite(intervalMs)
      ? Math.max(0, intervalMs)
      : 0;
    this.onFrame = onFrame;
  }

  start(): void {
    if (this.running) {
      return;
    }

    this.nextFrameIndex = 0;

    if (this.frames.length === 0) {
      return;
    }

    this.running = true;
    this.deliverNextFrame();
  }

  stop(): void {
    this.running = false;

    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  private deliverNextFrame(): void {
    if (!this.running) {
      return;
    }

    const frame = this.frames[this.nextFrameIndex];

    if (!frame) {
      this.stop();
      return;
    }

    this.onFrame(frame);
    this.nextFrameIndex += 1;

    if (!this.running || this.nextFrameIndex >= this.frames.length) {
      this.stop();
      return;
    }

    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.deliverNextFrame();
    }, this.intervalMs);
  }
}
