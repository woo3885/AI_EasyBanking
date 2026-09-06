import type { CSSProperties } from 'react';

import type {
  MaterializedDomOverlayTarget,
  OverlayObservationPhase,
} from '../model/overlay-types';

interface DomTargetOverlayProps {
  materializedTarget: MaterializedDomOverlayTarget;
  observationPhase: OverlayObservationPhase;
}

const GUIDE_WIDTH = 320;
const GUIDE_HEIGHT = 92;
const GUIDE_GAP = 12;

function guidePosition(materializedTarget: MaterializedDomOverlayTarget): CSSProperties {
  const { localRectangle, viewport } = materializedTarget;
  const below = localRectangle.y + localRectangle.height + GUIDE_GAP;
  const top = below + GUIDE_HEIGHT <= viewport.height
    ? below
    : Math.max(GUIDE_GAP, localRectangle.y - GUIDE_HEIGHT - GUIDE_GAP);
  return {
    left: Math.max(GUIDE_GAP, Math.min(
      localRectangle.x,
      viewport.width - GUIDE_WIDTH - GUIDE_GAP
    )),
    top
  };
}

export default function DomTargetOverlay({ materializedTarget, observationPhase }: DomTargetOverlayProps) {
  const { target, localRectangle } = materializedTarget;
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
          left: localRectangle.x,
          top: localRectangle.y,
          width: localRectangle.width,
          height: localRectangle.height
        }}
      />
      <div className="dom-target-guide" style={guidePosition(materializedTarget)}>
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
