import { describe, expect, it } from 'vitest';

import type { ViewerRect } from '@/features/F2_StreamViewer/model/coordinate-transform';

import {
  createFocusDimPanels,
  createFocusMagnifierLayout
} from './focus-effects';

const DISPLAY_SIZE = { width: 1280, height: 720 };
const TARGET = { x: 420, y: 310, width: 180, height: 60 };

function expectNoOverlap(left: ViewerRect, right: ViewerRect) {
  expect(
    left.x < right.x + right.width &&
      left.x + left.width > right.x &&
      left.y < right.y + right.height &&
      left.y + left.height > right.y
  ).toBe(false);
}

describe('createFocusDimPanels', () => {
  it('Target 중앙에서 상·하·좌·우 panel을 계산한다', () => {
    expect(createFocusDimPanels(TARGET, DISPLAY_SIZE)).toEqual([
      { name: 'top', x: 0, y: 0, width: 1280, height: 310 },
      { name: 'bottom', x: 0, y: 370, width: 1280, height: 350 },
      { name: 'left', x: 0, y: 310, width: 420, height: 60 },
      { name: 'right', x: 600, y: 310, width: 680, height: 60 }
    ]);
  });

  it('축소된 Viewer에서도 동일한 비율의 panel을 계산한다', () => {
    expect(
      createFocusDimPanels(
        { x: 210, y: 155, width: 90, height: 30 },
        { width: 640, height: 360 }
      )
    ).toEqual([
      { name: 'top', x: 0, y: 0, width: 640, height: 155 },
      { name: 'bottom', x: 0, y: 185, width: 640, height: 175 },
      { name: 'left', x: 0, y: 155, width: 210, height: 30 },
      { name: 'right', x: 300, y: 155, width: 340, height: 30 }
    ]);
  });

  it.each([
    ['왼쪽', { x: 0, y: 100, width: 100, height: 50 }, 'left'],
    ['오른쪽', { x: 1180, y: 100, width: 100, height: 50 }, 'right'],
    ['위쪽', { x: 100, y: 0, width: 100, height: 50 }, 'top'],
    ['아래쪽', { x: 100, y: 670, width: 100, height: 50 }, 'bottom']
  ] as const)('%s 경계에 닿은 Target은 0 크기 panel을 제외한다', (_, rect, name) => {
    expect(createFocusDimPanels(rect, DISPLAY_SIZE).map((panel) => panel.name))
      .not.toContain(name);
  });

  it('모든 panel은 Target 내부와 겹치지 않는다', () => {
    createFocusDimPanels(TARGET, DISPLAY_SIZE).forEach((panel) => {
      expectNoOverlap(panel, TARGET);
    });
  });

  it('panel 면적과 Target 면적의 합이 Viewer 전체 면적이다', () => {
    const panels = createFocusDimPanels(TARGET, DISPLAY_SIZE);
    const panelArea = panels.reduce(
      (total, panel) => total + panel.width * panel.height,
      0
    );

    expect(panelArea + TARGET.width * TARGET.height).toBe(
      DISPLAY_SIZE.width * DISPLAY_SIZE.height
    );
  });

  it('NaN, Infinity, 0 이하 displaySize는 빈 결과다', () => {
    expect(
      createFocusDimPanels({ ...TARGET, x: Number.NaN }, DISPLAY_SIZE)
    ).toEqual([]);
    expect(
      createFocusDimPanels(TARGET, {
        width: Number.POSITIVE_INFINITY,
        height: 720
      })
    ).toEqual([]);
    expect(createFocusDimPanels(TARGET, { width: 0, height: 720 })).toEqual([]);
  });

  it('Viewer 밖 rect를 clamp하지 않고 빈 결과로 처리한다', () => {
    expect(
      createFocusDimPanels({ ...TARGET, x: -1 }, DISPLAY_SIZE)
    ).toEqual([]);
  });

  it('입력 객체를 변경하지 않는다', () => {
    const rect = { ...TARGET };
    const size = { ...DISPLAY_SIZE };
    const originalRect = { ...rect };
    const originalSize = { ...size };

    createFocusDimPanels(rect, size);

    expect(rect).toEqual(originalRect);
    expect(size).toEqual(originalSize);
  });
});

describe('createFocusMagnifierLayout', () => {
  it('기본적으로 Target 오른쪽에 배치한다', () => {
    expect(createFocusMagnifierLayout(TARGET, DISPLAY_SIZE)).toEqual({
      placement: 'right',
      x: 616,
      y: 283.75,
      width: 180,
      height: 112.5,
      zoom: 2
    });
  });

  it('오른쪽 공간이 부족하면 왼쪽에 배치한다', () => {
    expect(
      createFocusMagnifierLayout(
        { x: 1080, y: 300, width: 180, height: 60 },
        DISPLAY_SIZE
      )?.placement
    ).toBe('left');
  });

  it('좌우 공간이 부족하면 아래쪽에 배치한다', () => {
    expect(
      createFocusMagnifierLayout(
        { x: 100, y: 100, width: 440, height: 60 },
        { width: 640, height: 360 }
      )?.placement
    ).toBe('bottom');
  });

  it('아래쪽도 부족하면 위쪽에 배치한다', () => {
    expect(
      createFocusMagnifierLayout(
        { x: 100, y: 250, width: 440, height: 60 },
        { width: 640, height: 360 }
      )?.placement
    ).toBe('top');
  });

  it('magnifier는 Viewer 경계 안에 있고 Target과 겹치지 않는다', () => {
    const layout = createFocusMagnifierLayout(TARGET, DISPLAY_SIZE);

    expect(layout).not.toBeNull();
    expect(layout!.x).toBeGreaterThanOrEqual(0);
    expect(layout!.y).toBeGreaterThanOrEqual(0);
    expect(layout!.x + layout!.width).toBeLessThanOrEqual(DISPLAY_SIZE.width);
    expect(layout!.y + layout!.height).toBeLessThanOrEqual(DISPLAY_SIZE.height);
    expectNoOverlap(layout!, TARGET);
  });

  it('blocked pointer rect와 겹치는 후보를 건너뛴다', () => {
    const rightCandidate = { x: 616, y: 283.75, width: 180, height: 112.5 };
    const layout = createFocusMagnifierLayout(TARGET, DISPLAY_SIZE, {
      blockedRects: [rightCandidate]
    });

    expect(layout?.placement).toBe('left');
    expectNoOverlap(layout!, rightCandidate);
  });

  it('모든 안전한 공간이 막히면 null이다', () => {
    expect(
      createFocusMagnifierLayout(
        { x: 100, y: 60, width: 440, height: 240 },
        { width: 640, height: 360 }
      )
    ).toBeNull();
  });

  it('작은 모바일 Viewer에 lens가 들어가지 않으면 null이다', () => {
    expect(
      createFocusMagnifierLayout(
        { x: 20, y: 20, width: 40, height: 30 },
        { width: 160, height: 90 }
      )
    ).toBeNull();
  });

  it('잘못된 lens size, NaN, Infinity 입력은 null이다', () => {
    expect(
      createFocusMagnifierLayout(TARGET, DISPLAY_SIZE, {
        lensSize: { width: 0, height: 100 }
      })
    ).toBeNull();
    expect(
      createFocusMagnifierLayout({ ...TARGET, x: Number.NaN }, DISPLAY_SIZE)
    ).toBeNull();
    expect(
      createFocusMagnifierLayout(TARGET, DISPLAY_SIZE, {
        zoom: Number.POSITIVE_INFINITY
      })
    ).toBeNull();
  });

  it('소수 좌표를 반올림하지 않는다', () => {
    const layout = createFocusMagnifierLayout(
      { x: 100.25, y: 200.5, width: 50.5, height: 20.25 },
      DISPLAY_SIZE,
      { lensSize: { width: 100.5, height: 60.25 }, gap: 12.25, zoom: 1.5 }
    );

    expect(layout?.x).toBeCloseTo(163);
    expect(layout?.y).toBeCloseTo(180.5);
    expect(layout?.zoom).toBe(1.5);
  });

  it('입력 객체와 options를 변경하지 않는다', () => {
    const rect = { ...TARGET };
    const size = { ...DISPLAY_SIZE };
    const blockedRect = { x: 0, y: 0, width: 10, height: 10 };
    const options = {
      lensSize: { width: 180, height: 112.5 },
      zoom: 2,
      gap: 16,
      blockedRects: [blockedRect]
    };
    const originals = {
      rect: { ...rect },
      size: { ...size },
      lensSize: { ...options.lensSize },
      blockedRect: { ...blockedRect }
    };

    createFocusMagnifierLayout(rect, size, options);

    expect(rect).toEqual(originals.rect);
    expect(size).toEqual(originals.size);
    expect(options.lensSize).toEqual(originals.lensSize);
    expect(blockedRect).toEqual(originals.blockedRect);
  });
});
