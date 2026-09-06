import { createElement, StrictMode, type PropsWithChildren } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ViewerFrame } from '@/features/F2_StreamViewer/model/viewer-frame';

import { useMockBrowserFrameStream } from './useMockBrowserFrameStream';

const SESSION_ID = 'hook-test-session';
const INTERVAL_MS = 100;

function createFrame(timestamp: number, sessionId = SESSION_ID): ViewerFrame {
  return {
    metadata: {
      type: 'BROWSER_FRAME',
      sessionId,
      timestamp,
      width: 1280,
      height: 720
    },
    imageSrc: `/hook-frame-${timestamp}.svg`
  };
}

const frames = [createFrame(1), createFrame(2)] as const;

function StrictModeWrapper({ children }: PropsWithChildren) {
  return createElement(StrictMode, undefined, children);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('useMockBrowserFrameStream', () => {
  it('초기 렌더 후 첫 프레임을 즉시 상태에 반영한다', () => {
    const { result } = renderHook(() =>
      useMockBrowserFrameStream({ frames, sessionId: SESSION_ID, intervalMs: INTERVAL_MS })
    );

    expect(result.current.currentFrame).toBe(frames[0]);
  });

  it('timer 진행 후 다음 프레임을 상태에 반영한다', () => {
    const { result } = renderHook(() =>
      useMockBrowserFrameStream({ frames, sessionId: SESSION_ID, intervalMs: INTERVAL_MS })
    );

    act(() => vi.advanceTimersByTime(INTERVAL_MS));

    expect(result.current.currentFrame).toBe(frames[1]);
  });

  it('unmount 시 예약 timer를 정리한다', () => {
    const { unmount } = renderHook(() =>
      useMockBrowserFrameStream({ frames, sessionId: SESSION_ID, intervalMs: INTERVAL_MS })
    );
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('unmount 후 상태를 변경하지 않는다', () => {
    const { result, unmount } = renderHook(() =>
      useMockBrowserFrameStream({ frames, sessionId: SESSION_ID, intervalMs: INTERVAL_MS })
    );
    const frameBeforeUnmount = result.current.currentFrame;

    unmount();
    act(() => vi.advanceTimersByTime(INTERVAL_MS));

    expect(result.current.currentFrame).toBe(frameBeforeUnmount);
  });

  it('동일 설정 재렌더링과 StrictMode에서 중복 timer를 만들지 않는다', () => {
    const { rerender } = renderHook(
      () =>
        useMockBrowserFrameStream({
          frames,
          sessionId: SESSION_ID,
          intervalMs: INTERVAL_MS
        }),
      { wrapper: StrictModeWrapper }
    );

    expect(vi.getTimerCount()).toBe(1);
    rerender();
    expect(vi.getTimerCount()).toBe(1);
  });

  it('설정 변경 시 기존 stream을 정리하고 새 stream을 시작한다', () => {
    const nextSessionId = 'next-hook-session';
    const nextFrames = [
      createFrame(10, nextSessionId),
      createFrame(20, nextSessionId)
    ];
    const { result, rerender } = renderHook(
      ({ activeFrames, activeSessionId }) =>
        useMockBrowserFrameStream({
          frames: activeFrames,
          sessionId: activeSessionId,
          intervalMs: INTERVAL_MS
        }),
      {
        initialProps: {
          activeFrames: frames as readonly ViewerFrame[],
          activeSessionId: SESSION_ID
        }
      }
    );

    rerender({
      activeFrames: nextFrames,
      activeSessionId: nextSessionId
    });

    expect(result.current.currentFrame).toBe(nextFrames[0]);
    expect(vi.getTimerCount()).toBe(1);
    act(() => vi.advanceTimersByTime(INTERVAL_MS));
    expect(result.current.currentFrame).toBe(nextFrames[1]);
  });

  it('마지막 프레임 이후 현재 상태를 유지한다', () => {
    const { result } = renderHook(() =>
      useMockBrowserFrameStream({ frames, sessionId: SESSION_ID, intervalMs: INTERVAL_MS })
    );

    act(() => vi.runAllTimers());
    act(() => vi.advanceTimersByTime(INTERVAL_MS * 10));

    expect(result.current.currentFrame).toBe(frames[1]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('다른 sessionId와 오래된 timestamp를 UI 상태에 반영하지 않는다', () => {
    const validFirst = createFrame(10);
    const validLast = createFrame(20);
    const mixedFrames = [
      createFrame(1, 'other-session'),
      validFirst,
      createFrame(5),
      validLast
    ];
    const { result } = renderHook(() =>
      useMockBrowserFrameStream({
        frames: mixedFrames,
        sessionId: SESSION_ID,
        intervalMs: INTERVAL_MS
      })
    );

    expect(result.current.currentFrame).toBe(validFirst);
    act(() => vi.runAllTimers());
    expect(result.current.currentFrame).toBe(validLast);
  });
});
