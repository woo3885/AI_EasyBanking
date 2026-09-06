import { act, fireEvent, render, screen } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  resolveUserDomOverlayTarget,
  useDomTargetOverlay
} from '../../src/features/AgentChat/hooks/use-dom-target-overlay';
import type {
  MaterializedDomOverlayTarget,
  ObservedDomTargetClick,
  PublicOverlayTarget
} from '../../src/features/AgentChat/model/overlay-types';
import DomTargetOverlay from '../../src/features/AgentChat/ui/DomTargetOverlay';

const target: PublicOverlayTarget = {
  contractVersion: 2, materializationMode: 'USER_DOM_PUBLIC_TARGET',
  targetId: 'target-1', sessionId: 'session-1', pageIdentity: 'page-1',
  sourceSnapshotId: 'snap-1', coordinateSpace: 'VIEWPORT_CSS_PX',
  rectangle: { x: 900, y: 800, width: 20, height: 20 },
  viewport: { width: 1280, height: 720 }, role: 'button', label: '12개월 정기예금 선택',
  guide: '이 버튼을 직접 눌러 주세요.',
  locator: { type: 'PUBLIC_TARGET_KEY', publicTargetKey: 'deposit-product-12m-select',
    role: 'button', accessibleName: '12개월 정기예금 선택' },
  actionMode: 'GUIDE_USER_CLICK', createdAt: '2026-09-06T12:00:00Z',
  expiresAt: '2099-09-06T12:01:00Z', consumedAt: null
};

let rectangle = { x: 100, y: 200, width: 180, height: 56 };
const nativeResizeObserver = globalThis.ResizeObserver;
const nativeDevicePixelRatio = window.devicePixelRatio;

function browserRectangle() {
  return { ...rectangle, left: rectangle.x, top: rectangle.y,
    right: rectangle.x + rectangle.width, bottom: rectangle.y + rectangle.height,
    toJSON: () => ({}) } as DOMRect;
}

function Harness({ onTargetClick, duplicate = false, disabled = false }: {
  onTargetClick: (value: ObservedDomTargetClick) => void;
  duplicate?: boolean;
  disabled?: boolean;
}) {
  const [active, setActive] = useState<PublicOverlayTarget | null>(target);
  const clear = useCallback(() => setActive(null), []);
  const { materializedTarget } = useDomTargetOverlay({
    target: active, observationPhase: 'IDLE', onClear: clear, onTargetClick
  });
  return <>
    <button type="button" data-testid="actual-target"
      data-ddd-public-target="deposit-product-12m-select"
      aria-label="12개월 정기예금 선택" disabled={disabled}>이 상품 선택</button>
    {duplicate ? <button type="button" data-ddd-public-target="deposit-product-12m-select"
      aria-label="12개월 정기예금 선택">중복 대상</button> : null}
    {materializedTarget ? <DomTargetOverlay
      materializedTarget={materializedTarget} observationPhase="IDLE" /> : null}
  </>;
}

function materialized(): MaterializedDomOverlayTarget {
  return { target, localRectangle: rectangle, viewport: { width: 1280, height: 720 } };
}

describe('DomTargetOverlay local DOM lifecycle', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/deposit/products');
    rectangle = { x: 100, y: 200, width: 180, height: 56 };
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(browserRectangle);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      writable: true,
      value: nativeResizeObserver
    });
    Object.defineProperty(window, 'devicePixelRatio', {
      configurable: true,
      value: nativeDevicePixelRatio
    });
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  });

  it('Backend 좌표가 아니라 local DOM rect로 fixed 안내를 표시한다', () => {
    render(<DomTargetOverlay materializedTarget={materialized()} observationPhase="IDLE" />);
    const overlay = screen.getByTestId('dom-target-overlay');
    expect(overlay).toHaveAttribute('data-ddd-agent-ui', 'true');
    expect(screen.getByText('12개월 정기예금 선택')).toBeInTheDocument();
    expect(screen.getByText('대상 종류: button')).toBeInTheDocument();
    expect(overlay.querySelector('.dom-target-highlight')).toHaveStyle({
      left: '100px', top: '200px', width: '180px', height: '56px'
    });
  });

  it('scrollY 521과 Backend 좌표 119px 차이가 있어도 local rect 오차는 0px이다', () => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 521 });
    const mismatchedTarget = {
      ...target,
      rectangle: { x: 100, y: 319, width: 180, height: 56 }
    };
    render(<button type="button" data-ddd-public-target="deposit-product-12m-select"
      aria-label="12개월 정기예금 선택">이 상품 선택</button>);
    const resolved = resolveUserDomOverlayTarget(mismatchedTarget);
    expect(Math.abs((resolved?.localRectangle.y ?? -1) - rectangle.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(mismatchedTarget.rectangle.y - rectangle.y)).toBe(119);
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  });

  it.each([1, 2])('DPR %s에서 CSS pixel local rect에 배율을 다시 곱하지 않는다', (dpr) => {
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: dpr });
    render(<button type="button" data-ddd-public-target="deposit-product-12m-select"
      aria-label="12개월 정기예금 선택">이 상품 선택</button>);
    expect(resolveUserDomOverlayTarget(target)?.localRectangle).toEqual(rectangle);
  });

  it('공개 key를 exact dataset 비교로 하나만 해석한다', () => {
    render(<button type="button" data-ddd-public-target="deposit-product-12m-select"
      aria-label="12개월 정기예금 선택">이 상품 선택</button>);
    expect(resolveUserDomOverlayTarget(target)?.element).toBe(screen.getByRole('button'));
    expect(resolveUserDomOverlayTarget(target, '/transfer/accounts')).toBeNull();
  });

  it('중복·role·accessible name·disabled target을 fail-closed 처리한다', () => {
    const duplicateView = render(<Harness onTargetClick={vi.fn()} duplicate />);
    expect(screen.queryByTestId('dom-target-overlay')).not.toBeInTheDocument();
    duplicateView.unmount();
    render(<Harness onTargetClick={vi.fn()} disabled />);
    expect(screen.queryByTestId('dom-target-overlay')).not.toBeInTheDocument();
  });

  it('role 또는 accessible name이 일치하지 않으면 target을 해석하지 않는다', () => {
    const { rerender } = render(<button type="button"
      data-ddd-public-target="deposit-product-12m-select"
      aria-label="다른 이름">이 상품 선택</button>);
    expect(resolveUserDomOverlayTarget(target)).toBeNull();
    rerender(<a href="/" data-ddd-public-target="deposit-product-12m-select"
      aria-label="12개월 정기예금 선택">이 상품 선택</a>);
    expect(resolveUserDomOverlayTarget(target)).toBeNull();
  });

  it('실제 composedPath target click만 한 번 관찰하고 local geometry를 전달한다', () => {
    const onTargetClick = vi.fn();
    render(<Harness onTargetClick={onTargetClick} />);
    const button = screen.getByTestId('actual-target');
    fireEvent.click(screen.getByTestId('dom-target-overlay'), { clientX: 110, clientY: 210, detail: 1 });
    fireEvent.click(button, { clientX: 110, clientY: 210, detail: 1 });
    fireEvent.click(button, { clientX: 110, clientY: 210, detail: 1 });
    expect(onTargetClick).toHaveBeenCalledTimes(1);
    expect(onTargetClick).toHaveBeenCalledWith(expect.objectContaining({
      target,
      localRectangle: rectangle,
      clickPosition: { clientX: 110, clientY: 210 }
    }));
  });

  it('resolved element의 local rect 바깥 click은 관찰하지 않는다', () => {
    const onTargetClick = vi.fn();
    render(<Harness onTargetClick={onTargetClick} />);
    const button = screen.getByTestId('actual-target');
    fireEvent.click(button, { clientX: 500, clientY: 500, detail: 1 });
    expect(onTargetClick).not.toHaveBeenCalled();
  });

  it.each(['scroll', 'resize'] as const)('%s에서 target을 제거하지 않고 local rect를 재측정한다', (name) => {
    render(<Harness onTargetClick={vi.fn()} />);
    expect(screen.getByTestId('dom-target-overlay')).toBeInTheDocument();
    rectangle = { x: 40, y: 60, width: 180, height: 56 };
    act(() => fireEvent(window, new Event(name)));
    expect(screen.getByTestId('dom-target-overlay').querySelector('.dom-target-highlight'))
      .toHaveStyle({ left: '40px', top: '60px' });
  });

  it('공개 target attribute가 사라지면 다음 재측정에서 fail-closed 제거한다', () => {
    render(<Harness onTargetClick={vi.fn()} />);
    screen.getByTestId('actual-target').removeAttribute('data-ddd-public-target');
    act(() => fireEvent.scroll(window));
    expect(screen.queryByTestId('dom-target-overlay')).not.toBeInTheDocument();
  });

  it('ResizeObserver 변화에서도 local rect를 다시 측정한다', () => {
    let notify = () => undefined;
    class FakeResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        notify = () => callback([], this as unknown as ResizeObserver);
      }
      observe() { return undefined; }
      unobserve() { return undefined; }
      disconnect() { return undefined; }
    }
    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      writable: true,
      value: FakeResizeObserver
    });
    render(<Harness onTargetClick={vi.fn()} />);
    rectangle = { x: 70, y: 90, width: 220, height: 60 };
    act(() => notify());
    expect(screen.getByTestId('dom-target-overlay').querySelector('.dom-target-highlight'))
      .toHaveStyle({ left: '70px', top: '90px', width: '220px', height: '60px' });
  });

  it('unmount에서 ResizeObserver와 listener를 정리한다', () => {
    const disconnect = vi.fn();
    const removeListener = vi.spyOn(window, 'removeEventListener');
    class FakeResizeObserver {
      constructor(_callback: ResizeObserverCallback) { return undefined; }
      observe() { return undefined; }
      unobserve() { return undefined; }
      disconnect() { disconnect(); }
    }
    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      writable: true,
      value: FakeResizeObserver
    });
    const view = render(<Harness onTargetClick={vi.fn()} />);
    view.unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(removeListener).toHaveBeenCalledWith('scroll', expect.any(Function), true);
    expect(removeListener).toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it.each(['popstate', 'hashchange'] as const)('%s에서는 stale target을 제거한다', (name) => {
    render(<Harness onTargetClick={vi.fn()} />);
    fireEvent(window, new Event(name));
    expect(screen.queryByTestId('dom-target-overlay')).not.toBeInTheDocument();
  });

  it('expiresAt 시각에 Overlay를 제거한다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-06T12:00:00Z'));
    const timedTarget = { ...target, expiresAt: '2026-09-06T12:00:01Z' };
    function TimedHarness() {
      const [active, setActive] = useState<PublicOverlayTarget | null>(timedTarget);
      const clear = useCallback(() => setActive(null), []);
      const { materializedTarget } = useDomTargetOverlay({
        target: active, observationPhase: 'IDLE', onClear: clear, onTargetClick: vi.fn()
      });
      return materializedTarget ? <DomTargetOverlay
        materializedTarget={materializedTarget} observationPhase="IDLE" /> : null;
    }
    render(<TimedHarness />);
    act(() => vi.advanceTimersByTime(1_001));
    expect(screen.queryByTestId('dom-target-overlay')).not.toBeInTheDocument();
  });
});
