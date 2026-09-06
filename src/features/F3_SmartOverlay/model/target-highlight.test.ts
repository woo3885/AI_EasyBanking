import { describe, expect, it } from 'vitest';

import { calculateTargetPointerPosition } from './target-highlight';

const DISPLAY_SIZE = { width: 1000, height: 600 };
const POINTER_SIZE = { width: 32, height: 40 };
const GAP = 12;

describe('calculateTargetPointerPosition', () => {
  it('중앙 Target 위쪽 중앙에 포인터를 배치한다', () => {
    expect(
      calculateTargetPointerPosition(
        { x: 400, y: 250, width: 200, height: 80 },
        DISPLAY_SIZE,
        POINTER_SIZE,
        GAP
      )
    ).toEqual({ x: 484, y: 198, placement: 'top' });
  });

  it('상단 공간이 부족하면 아래쪽에 배치한다', () => {
    expect(
      calculateTargetPointerPosition(
        { x: 100, y: 20, width: 100, height: 40 },
        DISPLAY_SIZE,
        POINTER_SIZE,
        GAP
      )
    ).toEqual({ x: 134, y: 72, placement: 'bottom' });
  });

  it('하단 Target은 위쪽에 배치한다', () => {
    expect(
      calculateTargetPointerPosition(
        { x: 100, y: 550, width: 100, height: 40 },
        DISPLAY_SIZE,
        POINTER_SIZE,
        GAP
      )
    ).toEqual({ x: 134, y: 498, placement: 'top' });
  });

  it('좌측 경계에서 포인터 x를 0으로 제한한다', () => {
    expect(
      calculateTargetPointerPosition(
        { x: 0, y: 100, width: 10, height: 20 },
        DISPLAY_SIZE,
        POINTER_SIZE,
        GAP
      )?.x
    ).toBe(0);
  });

  it('우측 경계에서 포인터 전체가 화면 안에 있도록 제한한다', () => {
    expect(
      calculateTargetPointerPosition(
        { x: 990, y: 100, width: 10, height: 20 },
        DISPLAY_SIZE,
        POINTER_SIZE,
        GAP
      )?.x
    ).toBe(968);
  });

  it('위와 아래가 모두 부족하면 공간이 더 넓은 방향을 선택한다', () => {
    expect(
      calculateTargetPointerPosition(
        { x: 100, y: 30, width: 100, height: 540 },
        DISPLAY_SIZE,
        POINTER_SIZE,
        GAP
      )?.placement
    ).toBe('top');
  });

  it('매우 넓은 Target도 중심을 기준으로 계산한다', () => {
    expect(
      calculateTargetPointerPosition(
        { x: 10, y: 200, width: 980, height: 40 },
        DISPLAY_SIZE,
        POINTER_SIZE,
        GAP
      )?.x
    ).toBe(484);
  });

  it('매우 작은 Target도 실제 크기를 바꾸지 않고 중심을 사용한다', () => {
    expect(
      calculateTargetPointerPosition(
        { x: 500, y: 200, width: 1, height: 1 },
        DISPLAY_SIZE,
        POINTER_SIZE,
        GAP
      )?.x
    ).toBe(484.5);
  });

  it('부분 clip된 Target의 표시 rect를 그대로 사용한다', () => {
    expect(
      calculateTargetPointerPosition(
        { x: 0, y: 100, width: 50, height: 50 },
        DISPLAY_SIZE,
        POINTER_SIZE,
        GAP
      )
    ).toEqual({ x: 9, y: 48, placement: 'top' });
  });

  it('소수 좌표를 반올림하지 않는다', () => {
    const result = calculateTargetPointerPosition(
      { x: 100.25, y: 200.5, width: 50.5, height: 20.25 },
      DISPLAY_SIZE,
      POINTER_SIZE,
      12.25
    );

    expect(result?.x).toBeCloseTo(109.5);
    expect(result?.y).toBeCloseTo(148.25);
  });

  it('0 크기 display는 null이다', () => {
    expect(
      calculateTargetPointerPosition(
        { x: 1, y: 1, width: 1, height: 1 },
        { width: 0, height: 600 },
        POINTER_SIZE,
        GAP
      )
    ).toBeNull();
  });

  it('0 크기 pointer는 null이다', () => {
    expect(
      calculateTargetPointerPosition(
        { x: 1, y: 1, width: 1, height: 1 },
        DISPLAY_SIZE,
        { width: 0, height: 40 },
        GAP
      )
    ).toBeNull();
  });

  it('음수 gap은 null이다', () => {
    expect(
      calculateTargetPointerPosition(
        { x: 1, y: 1, width: 1, height: 1 },
        DISPLAY_SIZE,
        POINTER_SIZE,
        -1
      )
    ).toBeNull();
  });

  it('NaN과 Infinity 입력은 null이다', () => {
    expect(
      calculateTargetPointerPosition(
        { x: Number.NaN, y: 1, width: 1, height: 1 },
        DISPLAY_SIZE,
        POINTER_SIZE,
        GAP
      )
    ).toBeNull();
    expect(
      calculateTargetPointerPosition(
        { x: 1, y: 1, width: 1, height: 1 },
        DISPLAY_SIZE,
        POINTER_SIZE,
        Number.POSITIVE_INFINITY
      )
    ).toBeNull();
  });

  it('음수 또는 0인 Target 크기는 null이다', () => {
    expect(
      calculateTargetPointerPosition(
        { x: 1, y: 1, width: 0, height: 1 },
        DISPLAY_SIZE,
        POINTER_SIZE,
        GAP
      )
    ).toBeNull();
    expect(
      calculateTargetPointerPosition(
        { x: 1, y: 1, width: 1, height: -1 },
        DISPLAY_SIZE,
        POINTER_SIZE,
        GAP
      )
    ).toBeNull();
  });

  it('입력 객체를 변경하지 않는다', () => {
    const rect = { x: 100, y: 200, width: 50, height: 20 };
    const displaySize = { ...DISPLAY_SIZE };
    const pointerSize = { ...POINTER_SIZE };
    const originals = {
      rect: { ...rect },
      displaySize: { ...displaySize },
      pointerSize: { ...pointerSize }
    };

    calculateTargetPointerPosition(rect, displaySize, pointerSize, GAP);

    expect(rect).toEqual(originals.rect);
    expect(displaySize).toEqual(originals.displaySize);
    expect(pointerSize).toEqual(originals.pointerSize);
  });
});
