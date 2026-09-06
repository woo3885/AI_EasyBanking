import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ViewerFrame } from '@/features/F2_StreamViewer/model/viewer-frame';

import { MockBrowserFrameStream } from './mock-browser-frame-stream';

const SESSION_ID = 'stream-test-session';
const INTERVAL_MS = 100;

function createFrame(
  timestamp: number,
  sessionId = SESSION_ID,
  imageSrc = `/frame-${timestamp}.svg`
): ViewerFrame {
  return {
    metadata: {
      type: 'BROWSER_FRAME',
      sessionId,
      timestamp,
      width: 1280,
      height: 720
    },
    imageSrc
  };
}

function createStream(
  frames: readonly ViewerFrame[],
  onFrame = vi.fn()
) {
  return {
    onFrame,
    stream: new MockBrowserFrameStream({
      frames,
      sessionId: SESSION_ID,
      intervalMs: INTERVAL_MS,
      onFrame
    })
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('MockBrowserFrameStream', () => {
  it('start 시 첫 유효 프레임을 즉시 전달한다', () => {
    const firstFrame = createFrame(1);
    const { stream, onFrame } = createStream([firstFrame, createFrame(2)]);

    stream.start();

    expect(onFrame).toHaveBeenCalledOnce();
    expect(onFrame).toHaveBeenLastCalledWith(firstFrame);
  });

  it('지정 간격 전에는 다음 프레임을 전달하지 않는다', () => {
    const { stream, onFrame } = createStream([createFrame(1), createFrame(2)]);
    stream.start();

    vi.advanceTimersByTime(INTERVAL_MS - 1);

    expect(onFrame).toHaveBeenCalledOnce();
  });

  it('지정 간격 후 다음 프레임을 전달한다', () => {
    const secondFrame = createFrame(2);
    const { stream, onFrame } = createStream([createFrame(1), secondFrame]);
    stream.start();

    vi.advanceTimersByTime(INTERVAL_MS);

    expect(onFrame).toHaveBeenCalledTimes(2);
    expect(onFrame).toHaveBeenLastCalledWith(secondFrame);
  });

  it('프레임을 timestamp 오름차순으로 전달한다', () => {
    const frames = [createFrame(10), createFrame(20), createFrame(30)];
    const { stream, onFrame } = createStream(frames);
    stream.start();

    vi.runAllTimers();

    expect(onFrame.mock.calls.map(([frame]) => frame.metadata.timestamp)).toEqual([
      10,
      20,
      30
    ]);
  });

  it('마지막 프레임 이후 추가 callback과 timer를 남기지 않는다', () => {
    const { stream, onFrame } = createStream([createFrame(1), createFrame(2)]);
    stream.start();

    vi.runAllTimers();
    vi.advanceTimersByTime(INTERVAL_MS * 10);

    expect(onFrame).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stop 후에는 callback을 호출하지 않는다', () => {
    const { stream, onFrame } = createStream([createFrame(1), createFrame(2)]);
    stream.start();

    stream.stop();
    vi.advanceTimersByTime(INTERVAL_MS);

    expect(onFrame).toHaveBeenCalledOnce();
  });

  it('실행 중 중복 start를 무시한다', () => {
    const { stream, onFrame } = createStream([createFrame(1), createFrame(2)]);

    stream.start();
    stream.start();

    expect(onFrame).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(INTERVAL_MS);
    expect(onFrame).toHaveBeenCalledTimes(2);
  });

  it('stop을 여러 번 호출해도 안전하다', () => {
    const { stream } = createStream([createFrame(1), createFrame(2)]);
    stream.start();

    expect(() => {
      stream.stop();
      stream.stop();
    }).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('다른 sessionId 프레임을 무시한다', () => {
    const validFrame = createFrame(2);
    const { stream, onFrame } = createStream([
      createFrame(1, 'other-session'),
      validFrame
    ]);

    stream.start();

    expect(onFrame).toHaveBeenCalledOnce();
    expect(onFrame).toHaveBeenCalledWith(validFrame);
  });

  it('같은 timestamp 프레임을 중복으로 보고 무시한다', () => {
    const firstFrame = createFrame(1, SESSION_ID, '/first.svg');
    const duplicateFrame = createFrame(1, SESSION_ID, '/duplicate.svg');
    const nextFrame = createFrame(2);
    const { stream, onFrame } = createStream([
      firstFrame,
      duplicateFrame,
      nextFrame
    ]);
    stream.start();

    vi.runAllTimers();

    expect(onFrame.mock.calls.map(([frame]) => frame.imageSrc)).toEqual([
      firstFrame.imageSrc,
      nextFrame.imageSrc
    ]);
  });

  it('더 작은 timestamp 프레임을 오래된 프레임으로 보고 무시한다', () => {
    const firstFrame = createFrame(20);
    const oldFrame = createFrame(10);
    const nextFrame = createFrame(30);
    const { stream, onFrame } = createStream([
      firstFrame,
      oldFrame,
      nextFrame
    ]);
    stream.start();

    vi.runAllTimers();

    expect(onFrame.mock.calls.map(([frame]) => frame.metadata.timestamp)).toEqual([
      20,
      30
    ]);
  });

  it('잘못된 프레임 뒤의 정상 프레임은 계속 전달한다', () => {
    const frames = [
      createFrame(1),
      createFrame(2, 'other-session'),
      createFrame(2),
      createFrame(1),
      createFrame(3)
    ];
    const { stream, onFrame } = createStream(frames);
    stream.start();

    vi.runAllTimers();

    expect(onFrame.mock.calls.map(([frame]) => frame.metadata.timestamp)).toEqual([
      1,
      2,
      3
    ]);
  });

  it('입력 프레임 배열과 순서를 변경하지 않는다', () => {
    const frames = [createFrame(2), createFrame(1), createFrame(3)];
    const originalFrames = [...frames];
    const { stream } = createStream(frames);

    stream.start();
    vi.runAllTimers();

    expect(frames).toEqual(originalFrames);
    expect(frames[0]).toBe(originalFrames[0]);
  });

  it('빈 프레임 목록에서도 안전하다', () => {
    const { stream, onFrame } = createStream([]);

    expect(() => stream.start()).not.toThrow();
    expect(onFrame).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
