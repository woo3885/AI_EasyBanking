import { describe, expect, it } from 'vitest';

import {
  createViewerClickAction,
  createViewerScrollAction,
  VIEWER_MAX_SCROLL_DELTA
} from './viewer-interaction';

const frame = {
  frameId: 'frm-current',
  sequence: 7,
  width: 1280 as const,
  height: 720 as const
};

const bounds = {
  left: 100,
  top: 50,
  width: 640,
  height: 360
};

describe('viewer interaction model', () => {
  it('Canvas client 좌표를 1280 × 720 좌표 CLICK으로 변환한다', () => {
    expect(
      createViewerClickAction({
        clientX: 420,
        clientY: 230,
        displayBounds: bounds,
        frame
      })
    ).toEqual({
      type: 'CLICK',
      x: 640,
      y: 360,
      frameId: 'frm-current',
      sequence: 7
    });
  });

  it('확대된 Canvas에서도 현재 포인터가 속한 정수 pixel로 변환한다', () => {
    expect(
      createViewerClickAction({
        clientX: 160.9,
        clientY: 90.9,
        displayBounds: { left: 0, top: 0, width: 2560, height: 1440 },
        frame
      })
    ).toMatchObject({ x: 80, y: 45 });
  });

  it('Canvas 밖과 오른쪽·아래 경계를 거부한다', () => {
    expect(
      createViewerClickAction({
        clientX: 99,
        clientY: 100,
        displayBounds: bounds,
        frame
      })
    ).toBeNull();
    expect(
      createViewerClickAction({
        clientX: 740,
        clientY: 410,
        displayBounds: bounds,
        frame
      })
    ).toBeNull();
  });

  it('letterbox 영역을 거부한다', () => {
    expect(
      createViewerClickAction({
        clientX: 500,
        clientY: 10,
        displayBounds: { left: 0, top: 0, width: 1000, height: 700 },
        frame
      })
    ).toBeNull();
  });

  it('resize된 Canvas의 현재 bounds를 사용한다', () => {
    expect(
      createViewerClickAction({
        clientX: 200,
        clientY: 112.5,
        displayBounds: { left: 0, top: 0, width: 400, height: 225 },
        frame
      })
    ).toMatchObject({ x: 640, y: 360 });
  });

  it('frameId 또는 sequence가 유효하지 않으면 거부한다', () => {
    expect(
      createViewerClickAction({
        clientX: 420,
        clientY: 230,
        displayBounds: bounds,
        frame: { ...frame, frameId: '' }
      })
    ).toBeNull();
    expect(
      createViewerClickAction({
        clientX: 420,
        clientY: 230,
        displayBounds: bounds,
        frame: { ...frame, sequence: 0 }
      })
    ).toBeNull();
  });

  it('CSS pixel wheel을 좌표와 양축 delta가 있는 SCROLL로 만든다', () => {
    expect(
      createViewerScrollAction({
        clientX: 420,
        clientY: 230,
        displayBounds: bounds,
        frame,
        deltaX: -25.9,
        deltaY: 120.8,
        deltaMode: 0
      })
    ).toEqual({
      type: 'SCROLL',
      x: 640,
      y: 360,
      deltaX: -25,
      deltaY: 120,
      frameId: 'frm-current',
      sequence: 7
    });
  });

  it('양축 0, 비유한 값과 최대 delta 초과를 거부한다', () => {
    const base = {
      clientX: 420,
      clientY: 230,
      displayBounds: bounds,
      frame,
      deltaMode: 0
    };
    expect(createViewerScrollAction({ ...base, deltaX: 0, deltaY: 0 })).toBeNull();
    expect(
      createViewerScrollAction({ ...base, deltaX: Number.NaN, deltaY: 1 })
    ).toBeNull();
    expect(
      createViewerScrollAction({
        ...base,
        deltaX: 0,
        deltaY: VIEWER_MAX_SCROLL_DELTA + 1
      })
    ).toBeNull();
  });

  it('CSS pixel이 아닌 deltaMode를 임의 환산하지 않는다', () => {
    expect(
      createViewerScrollAction({
        clientX: 420,
        clientY: 230,
        displayBounds: bounds,
        frame,
        deltaX: 0,
        deltaY: 3,
        deltaMode: 1
      })
    ).toBeNull();
  });
});
