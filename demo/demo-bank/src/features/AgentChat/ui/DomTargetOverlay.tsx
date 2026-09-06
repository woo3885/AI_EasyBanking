import type { CSSProperties } from 'react';

import type {
  OverlayObservationPhase,
  PublicOverlayTarget
} from '../model/overlay-types';

interface DomTargetOverlayProps {
  target: PublicOverlayTarget;
  observationPhase: OverlayObservationPhase;
}

const GUIDE_WIDTH = 320;
const GUIDE_HEIGHT = 92;
const GUIDE_GAP = 12;

function guidePosition(target: PublicOverlayTarget): CSSProperties {
  const below = target.rectangle.y + target.rectangle.height + GUIDE_GAP;
  const top = below + GUIDE_HEIGHT <= target.viewport.height
    ? below
    : Math.max(GUIDE_GAP, target.rectangle.y - GUIDE_HEIGHT - GUIDE_GAP);
  return {
    left: Math.max(GUIDE_GAP, Math.min(target.rectangle.x, target.viewport.width - GUIDE_WIDTH - GUIDE_GAP)),
    top
  };
}

export default function DomTargetOverlay({ target, observationPhase }: DomTargetOverlayProps) {
  return (
    <div
      className="dom-target-overlay"
      data-ddd-agent-ui="true"
      data-testid="dom-target-overlay"
      aria-live="polite"
      role="status"
    >
      <div
        className="dom-target-highlight"
        aria-hidden="true"
        style={{
          left: target.rectangle.x,
          top: target.rectangle.y,
          width: target.rectangle.width,
          height: target.rectangle.height
        }}
      />
      <div className="dom-target-guide" style={guidePosition(target)}>
        <strong>{target.label}</strong>
        <span>{target.guide}</span>
        <span className="dom-target-role">대상 종류: {target.role}</span>
        {observationPhase === 'SUBMITTING' || observationPhase === 'WAITING_FOR_RESULT' ? (
          <span>변경된 화면을 안전하게 확인하고 있습니다.</span>
        ) : null}
      </div>
    </div>
  );
}
