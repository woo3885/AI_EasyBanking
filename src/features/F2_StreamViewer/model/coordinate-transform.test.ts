import { describe, expect, it } from 'vitest';

import {
  clientPointToDisplayPoint,
  clipServerRectToFrame,
  createContainCoordinateTransform,
  displayPointToServerPoint,
  isPointInsideRenderedFrame,
  serverPointToDisplayPoint,
  serverRectToDisplayRect,
  type ViewerCoordinateTransform,
  type ViewerSize
} from './coordinate-transform';

const SERVER_SIZE: ViewerSize = { width: 1280, height: 720 };

function requireTransform(
  displaySize: ViewerSize
): ViewerCoordinateTransform {
  const transform = createContainCoordinateTransform(
    SERVER_SIZE,
    displaySize
  );

  if (!transform) {
    throw new Error('테스트에 필요한 좌표 변환을 만들지 못했습니다.');
  }

  return transform;
}

describe('createContainCoordinateTransform', () => {
  it('1. 동일한 1280 × 720 크기는 scale 1과 offset 0을 반환한다', () => {
    const transform = requireTransform({ width: 1280, height: 720 });

    expect(transform).toMatchObject({
      scale: 1,
      renderedWidth: 1280,
      renderedHeight: 720,
      offsetX: 0,
      offsetY: 0
    });
  });

  it('2. 960 × 540 표시는 0.75배로 축소한다', () => {
    const transform = requireTransform({ width: 960, height: 540 });

    expect(transform).toMatchObject({
      scale: 0.75,
      renderedWidth: 960,
      renderedHeight: 540,
      offsetX: 0,
      offsetY: 0
    });
  });

  it('3. 1920 × 1080 표시는 1.5배로 확대한다', () => {
    const transform = requireTransform({ width: 1920, height: 1080 });

    expect(transform).toMatchObject({
      scale: 1.5,
      renderedWidth: 1920,
      renderedHeight: 1080,
      offsetX: 0,
      offsetY: 0
    });
  });

  it('4. 1000 × 700 표시는 상하 letterbox offset을 계산한다', () => {
    const transform = requireTransform({ width: 1000, height: 700 });

    expect(transform.scale).toBe(0.78125);
    expect(transform.renderedWidth).toBe(1000);
    expect(transform.renderedHeight).toBe(562.5);
    expect(transform.offsetX).toBe(0);
    expect(transform.offsetY).toBe(68.75);
  });

  it('5. 400 × 800 표시는 400 × 225 렌더링 영역을 가운데 둔다', () => {
    const transform = requireTransform({ width: 400, height: 800 });

    expect(transform.scale).toBe(0.3125);
    expect(transform.renderedWidth).toBe(400);
    expect(transform.renderedHeight).toBe(225);
    expect(transform.offsetX).toBe(0);
    expect(transform.offsetY).toBe(287.5);
  });

  it('6. 1000 × 400 표시는 좌우 letterbox offset을 계산한다', () => {
    const transform = requireTransform({ width: 1000, height: 400 });

    expect(transform.scale).toBeCloseTo(0.5555555556, 10);
    expect(transform.renderedWidth).toBeCloseTo(711.1111111, 7);
    expect(transform.renderedHeight).toBe(400);
    expect(transform.offsetX).toBeCloseTo(144.4444444, 7);
    expect(transform.offsetY).toBe(0);
  });
});

describe('Viewer point 변환', () => {
  const transform = requireTransform({ width: 1000, height: 700 });

  it('7. 서버 중심점을 display 중심점으로 변환한다', () => {
    expect(serverPointToDisplayPoint({ x: 640, y: 360 }, transform)).toEqual({
      x: 500,
      y: 350
    });
  });

  it('8. display 중심점을 서버 중심점으로 역변환한다', () => {
    expect(displayPointToServerPoint({ x: 500, y: 350 }, transform)).toEqual({
      x: 640,
      y: 360
    });
  });

  it('9. 임의 소수 point를 최소 8자리 정밀도로 왕복 변환한다', () => {
    const serverPoint = { x: 123.456789, y: 78.987654 };
    const displayPoint = serverPointToDisplayPoint(serverPoint, transform);

    expect(displayPoint).not.toBeNull();

    const restoredPoint = displayPoint
      ? displayPointToServerPoint(displayPoint, transform)
      : null;

    expect(restoredPoint?.x).toBeCloseTo(serverPoint.x, 8);
    expect(restoredPoint?.y).toBeCloseTo(serverPoint.y, 8);
  });

  it('10. 서버 원점을 렌더링 영역의 좌측 상단으로 변환한다', () => {
    expect(serverPointToDisplayPoint({ x: 0, y: 0 }, transform)).toEqual({
      x: 0,
      y: 68.75
    });
  });

  it('11. 음수 server point는 null이다', () => {
    expect(serverPointToDisplayPoint({ x: -1, y: 0 }, transform)).toBeNull();
    expect(serverPointToDisplayPoint({ x: 0, y: -1 }, transform)).toBeNull();
  });

  it('12. server 오른쪽 경계는 포함하지 않는다', () => {
    expect(
      serverPointToDisplayPoint({ x: SERVER_SIZE.width, y: 0 }, transform)
    ).toBeNull();
  });

  it('13. server 아래쪽 경계는 포함하지 않는다', () => {
    expect(
      serverPointToDisplayPoint({ x: 0, y: SERVER_SIZE.height }, transform)
    ).toBeNull();
  });

  it('14. server 범위를 초과한 point는 null이다', () => {
    expect(serverPointToDisplayPoint({ x: 1281, y: 360 }, transform)).toBeNull();
    expect(serverPointToDisplayPoint({ x: 640, y: 721 }, transform)).toBeNull();
  });

  it('15. letterbox 영역의 display point는 null이다', () => {
    expect(displayPointToServerPoint({ x: 500, y: 50 }, transform)).toBeNull();
    expect(isPointInsideRenderedFrame({ x: 500, y: 50 }, transform)).toBe(false);
  });

  it('16. rendered frame 내부 point는 정상적으로 역변환한다', () => {
    expect(isPointInsideRenderedFrame({ x: 500, y: 350 }, transform)).toBe(true);
    expect(displayPointToServerPoint({ x: 500, y: 350 }, transform)).toEqual({
      x: 640,
      y: 360
    });
  });

  it('17. rendered frame의 오른쪽과 아래쪽 경계는 포함하지 않는다', () => {
    expect(
      displayPointToServerPoint({ x: 1000, y: 350 }, transform)
    ).toBeNull();
    expect(
      displayPointToServerPoint({ x: 500, y: 631.25 }, transform)
    ).toBeNull();
  });
});

describe('clientPointToDisplayPoint', () => {
  const bounds = { left: 100, top: 50, width: 960, height: 540 };

  it('18. viewport client 좌표를 Canvas local 좌표로 변환한다', () => {
    expect(clientPointToDisplayPoint({ x: 580, y: 320 }, bounds)).toEqual({
      x: 480,
      y: 270
    });
  });

  it('19. Canvas left와 top 경계는 포함한다', () => {
    expect(clientPointToDisplayPoint({ x: 100, y: 50 }, bounds)).toEqual({
      x: 0,
      y: 0
    });
  });

  it('20. Canvas right와 bottom 경계는 포함하지 않는다', () => {
    expect(clientPointToDisplayPoint({ x: 1060, y: 320 }, bounds)).toBeNull();
    expect(clientPointToDisplayPoint({ x: 580, y: 590 }, bounds)).toBeNull();
  });

  it('21. Canvas 바깥 client 좌표는 null이다', () => {
    expect(clientPointToDisplayPoint({ x: 99, y: 320 }, bounds)).toBeNull();
    expect(clientPointToDisplayPoint({ x: 580, y: 49 }, bounds)).toBeNull();
  });

  it('22. 잘못된 display bounds는 null이다', () => {
    expect(
      clientPointToDisplayPoint(
        { x: 100, y: 50 },
        { ...bounds, width: 0 }
      )
    ).toBeNull();
    expect(
      clientPointToDisplayPoint(
        { x: 100, y: 50 },
        { ...bounds, left: Number.NaN }
      )
    ).toBeNull();
  });
});

describe('Viewer rect 변환', () => {
  const transform = requireTransform({ width: 1000, height: 700 });

  it('23. 정상 server rect를 display rect로 변환한다', () => {
    expect(
      serverRectToDisplayRect(
        { x: 100, y: 50, width: 200, height: 100 },
        transform
      )
    ).toEqual({
      x: 78.125,
      y: 107.8125,
      width: 156.25,
      height: 78.125
    });
  });

  it('24. 왼쪽을 일부 벗어난 rect를 frame 경계로 clip한다', () => {
    const rect = { x: -100, y: 100, width: 200, height: 100 };

    expect(clipServerRectToFrame(rect, SERVER_SIZE)).toEqual({
      x: 0,
      y: 100,
      width: 100,
      height: 100
    });
  });

  it('25. 오른쪽을 일부 벗어난 rect를 frame 경계로 clip한다', () => {
    expect(
      clipServerRectToFrame(
        { x: 1200, y: 100, width: 200, height: 100 },
        SERVER_SIZE
      )
    ).toEqual({ x: 1200, y: 100, width: 80, height: 100 });
  });

  it('26. 위와 아래를 일부 벗어난 rect를 각각 clip한다', () => {
    expect(
      clipServerRectToFrame(
        { x: 100, y: -50, width: 100, height: 100 },
        SERVER_SIZE
      )
    ).toEqual({ x: 100, y: 0, width: 100, height: 50 });
    expect(
      clipServerRectToFrame(
        { x: 100, y: 700, width: 100, height: 50 },
        SERVER_SIZE
      )
    ).toEqual({ x: 100, y: 700, width: 100, height: 20 });
  });

  it('27. frame을 완전히 벗어난 rect는 null이다', () => {
    expect(
      clipServerRectToFrame(
        { x: -200, y: 100, width: 50, height: 50 },
        SERVER_SIZE
      )
    ).toBeNull();
    expect(
      serverRectToDisplayRect(
        { x: 1300, y: 100, width: 50, height: 50 },
        transform
      )
    ).toBeNull();
  });

  it('28. width가 0인 rect는 null이다', () => {
    expect(
      clipServerRectToFrame(
        { x: 0, y: 0, width: 0, height: 10 },
        SERVER_SIZE
      )
    ).toBeNull();
  });

  it('29. height가 0인 rect는 null이다', () => {
    expect(
      clipServerRectToFrame(
        { x: 0, y: 0, width: 10, height: 0 },
        SERVER_SIZE
      )
    ).toBeNull();
  });

  it('30. 음수 width 또는 height를 가진 rect는 null이다', () => {
    expect(
      clipServerRectToFrame(
        { x: 0, y: 0, width: -1, height: 10 },
        SERVER_SIZE
      )
    ).toBeNull();
    expect(
      clipServerRectToFrame(
        { x: 0, y: 0, width: 10, height: -1 },
        SERVER_SIZE
      )
    ).toBeNull();
  });

  it('31. 소수 rect 값을 반올림하지 않고 유지한다', () => {
    const scaledTransform = requireTransform({ width: 960, height: 540 });

    expect(
      serverRectToDisplayRect(
        { x: 0.5, y: 0.25, width: 10.5, height: 20.25 },
        scaledTransform
      )
    ).toEqual({
      x: 0.375,
      y: 0.1875,
      width: 7.875,
      height: 15.1875
    });
  });

  it('32. clip과 display 변환은 입력 rect를 변경하지 않는다', () => {
    const rect = { x: -100, y: 100, width: 200, height: 100 };
    const originalRect = { ...rect };

    clipServerRectToFrame(rect, SERVER_SIZE);
    serverRectToDisplayRect(rect, transform);

    expect(rect).toEqual(originalRect);
  });
});

describe('잘못된 값과 불변성', () => {
  const transform = requireTransform({ width: 1000, height: 700 });

  it('33. width가 0인 size는 transform을 만들지 않는다', () => {
    expect(
      createContainCoordinateTransform(
        { width: 0, height: 720 },
        { width: 1000, height: 700 }
      )
    ).toBeNull();
  });

  it('34. height가 음수인 size는 transform을 만들지 않는다', () => {
    expect(
      createContainCoordinateTransform(
        { width: 1280, height: -1 },
        { width: 1000, height: 700 }
      )
    ).toBeNull();
  });

  it('35. NaN 입력은 null 또는 false를 반환한다', () => {
    const invalidTransform = { ...transform, scale: Number.NaN };

    expect(
      createContainCoordinateTransform(
        { width: Number.NaN, height: 720 },
        { width: 1000, height: 700 }
      )
    ).toBeNull();
    expect(
      serverPointToDisplayPoint({ x: Number.NaN, y: 0 }, transform)
    ).toBeNull();
    expect(
      displayPointToServerPoint({ x: 500, y: Number.NaN }, transform)
    ).toBeNull();
    expect(
      isPointInsideRenderedFrame({ x: 500, y: 350 }, invalidTransform)
    ).toBe(false);
    expect(
      clipServerRectToFrame(
        { x: Number.NaN, y: 0, width: 10, height: 10 },
        SERVER_SIZE
      )
    ).toBeNull();
  });

  it('36. Infinity 입력은 null 또는 false를 반환한다', () => {
    const invalidTransform = {
      ...transform,
      renderedWidth: Number.POSITIVE_INFINITY
    };

    expect(
      createContainCoordinateTransform(
        { width: 1280, height: 720 },
        { width: Number.POSITIVE_INFINITY, height: 700 }
      )
    ).toBeNull();
    expect(
      clientPointToDisplayPoint(
        { x: Number.NEGATIVE_INFINITY, y: 0 },
        { left: 0, top: 0, width: 1000, height: 700 }
      )
    ).toBeNull();
    expect(
      serverRectToDisplayRect(
        { x: 0, y: 0, width: 10, height: 10 },
        invalidTransform
      )
    ).toBeNull();
  });

  it('37. 입력 size를 변경하지 않고 반환 size를 복사한다', () => {
    const serverSize = { width: 1280, height: 720 };
    const displaySize = { width: 1000, height: 700 };
    const originalServerSize = { ...serverSize };
    const originalDisplaySize = { ...displaySize };
    const result = createContainCoordinateTransform(serverSize, displaySize);

    expect(serverSize).toEqual(originalServerSize);
    expect(displaySize).toEqual(originalDisplaySize);
    expect(result?.serverSize).not.toBe(serverSize);
    expect(result?.displaySize).not.toBe(displaySize);
  });

  it('38. point와 transform 계산에서 불필요한 정수 반올림을 하지 않는다', () => {
    const wideTransform = requireTransform({ width: 1000, height: 400 });
    const displayPoint = serverPointToDisplayPoint(
      { x: 0.25, y: 0.25 },
      wideTransform
    );

    expect(displayPoint).not.toBeNull();

    if (!displayPoint) {
      throw new Error('소수 좌표를 display point로 변환하지 못했습니다.');
    }

    expect(wideTransform.offsetX).toBeCloseTo(144.4444444444, 10);
    expect(displayPoint.x).toBeCloseTo(144.5833333333, 10);
    expect(displayPoint.y).toBeCloseTo(0.1388888889, 10);
    expect(Number.isInteger(displayPoint.x)).toBe(false);
    expect(Number.isInteger(displayPoint.y)).toBe(false);
  });
});
