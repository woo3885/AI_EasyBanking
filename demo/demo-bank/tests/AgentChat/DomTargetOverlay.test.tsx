import { act, fireEvent, render, screen } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useDomTargetOverlay } from '../../src/features/AgentChat/hooks/use-dom-target-overlay';
import type { PublicOverlayTarget } from '../../src/features/AgentChat/model/overlay-types';
import DomTargetOverlay from '../../src/features/AgentChat/ui/DomTargetOverlay';

const target: PublicOverlayTarget = {
  targetId: 'target-1', sessionId: 'session-1', pageIdentity: 'page-1',
  sourceSnapshotId: 'snap-1', coordinateSpace: 'VIEWPORT_CSS_PX',
  rectangle: { x: 100, y: 200, width: 180, height: 56 },
  viewport: { width: 1280, height: 720 }, role: 'button', label: '상품 선택',
  guide: '이 버튼을 직접 눌러 주세요.', actionMode: 'GUIDE_USER_CLICK',
  createdAt: '2026-09-06T12:00:00Z', expiresAt: '2099-09-06T12:01:00Z', consumedAt: null
};

function Harness({ onTargetClick }: { onTargetClick: (value: PublicOverlayTarget) => void }) {
  const [active, setActive] = useState<PublicOverlayTarget | null>(target);
  const clear = useCallback(() => setActive(null), []);
  useDomTargetOverlay({ target: active, observationPhase: 'IDLE', onClear: clear, onTargetClick });
  return <>
    <button type="button" data-testid="actual-target">이 상품 선택</button>
    {active ? <DomTargetOverlay target={active} observationPhase="IDLE" /> : null}
  </>;
}

function setTargetRectangle(element: Element) {
  element.getBoundingClientRect = () => ({ x: 100, y: 200, left: 100, top: 200,
    width: 180, height: 56, right: 280, bottom: 256, toJSON: () => ({}) });
}

describe('DomTargetOverlay lifecycle', () => {
  afterEach(() => vi.useRealTimers());
  it('fixed 안내와 highlight를 pointer-events none 경계에 표시한다', () => {
    render(<DomTargetOverlay target={target} observationPhase="IDLE" />);
    const overlay = screen.getByTestId('dom-target-overlay');
    expect(overlay).toHaveAttribute('data-ddd-agent-ui', 'true');
    expect(overlay).toHaveClass('dom-target-overlay');
    expect(screen.getByText('상품 선택')).toBeInTheDocument();
    expect(screen.getByText('대상 종류: button')).toBeInTheDocument();
  });

  it('실제 target click을 한 번만 관찰하고 Overlay click은 무시한다', () => {
    const onTargetClick = vi.fn();
    render(<Harness onTargetClick={onTargetClick} />);
    const button = screen.getByTestId('actual-target');
    setTargetRectangle(button);
    fireEvent.click(screen.getByTestId('dom-target-overlay'), { clientX: 110, clientY: 210, detail: 1 });
    fireEvent.click(button, { clientX: 110, clientY: 210, detail: 1 });
    fireEvent.click(button, { clientX: 110, clientY: 210, detail: 1 });
    expect(onTargetClick).toHaveBeenCalledTimes(1);
    expect(onTargetClick).toHaveBeenCalledWith(target);
  });

  it.each(['scroll', 'resize', 'popstate', 'hashchange'] as const)('%s에서 stale Overlay를 제거한다', (name) => {
    render(<Harness onTargetClick={vi.fn()} />);
    expect(screen.getByTestId('dom-target-overlay')).toBeInTheDocument();
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
      useDomTargetOverlay({ target: active, observationPhase: 'IDLE', onClear: clear, onTargetClick: vi.fn() });
      return active ? <DomTargetOverlay target={active} observationPhase="IDLE" /> : null;
    }
    render(<TimedHarness />);
    act(() => vi.advanceTimersByTime(1_001));
    expect(screen.queryByTestId('dom-target-overlay')).not.toBeInTheDocument();
  });
});
