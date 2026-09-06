export type OverlayCoordinateSpace = 'VIEWPORT_CSS_PX';
export type OverlayActionMode = 'GUIDE_USER_CLICK';

export type OverlayClearReason =
  | 'REPLACED'
  | 'EXPIRED'
  | 'NAVIGATION'
  | 'SNAPSHOT_CHANGED'
  | 'USER_ACTION'
  | 'RECONNECT'
  | 'SECURE_INPUT'
  | 'RISK_WARNING'
  | 'FINAL_CONFIRMATION'
  | 'SESSION_TERMINATED'
  | 'TARGET_INVALID';

export interface OverlayRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OverlayViewport {
  width: number;
  height: number;
}

export interface PublicOverlayTarget {
  targetId: string;
  sessionId: string;
  pageIdentity: string;
  sourceSnapshotId: string;
  coordinateSpace: OverlayCoordinateSpace;
  rectangle: OverlayRectangle;
  viewport: OverlayViewport;
  role: string;
  label: string;
  guide: string;
  actionMode: OverlayActionMode;
  createdAt: string;
  expiresAt: string;
  consumedAt: string | null;
}

export type OverlayObservationPhase =
  | 'IDLE'
  | 'SUBMITTING'
  | 'WAITING_FOR_RESULT'
  | 'ERROR';

export interface PendingOverlayObservation {
  requestId: string;
  targetId: string;
  pageIdentity: string;
  sourceSnapshotId: string;
}

export interface DemoAgentBridgeBinding {
  sessionId: string;
  bridgeToken: string;
  pageIdentity: string;
}

export interface ConversationBridgeRecovery {
  sessionId: string;
  pageIdentity: string;
  eventSubscription: string;
  conversationSnapshotPath: string;
  expiresAt: string;
  activeTarget: PublicOverlayTarget | null;
}

export interface InteractionObservationRequest {
  requestId: string;
  targetId: string;
  sourceSnapshotId: string;
  observationType: 'USER_CLICK';
  clientOccurredAt: string;
}

export interface InteractionObservationAccepted {
  sessionId: string;
  requestId: string;
  targetId: string;
  pageIdentity: string;
  sourceSnapshotId: string;
  status: 'OBSERVATION_ACCEPTED';
  acceptedAt: string;
}
