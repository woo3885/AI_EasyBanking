export type OverlayCoordinateSpace = 'VIEWPORT_CSS_PX';
export type OverlayActionMode = 'GUIDE_USER_CLICK';
export type OverlayMaterializationMode =
  | 'BACKEND_VIEWPORT_RECT'
  | 'USER_DOM_PUBLIC_TARGET';

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

export interface PublicTargetLocator {
  type: 'PUBLIC_TARGET_KEY';
  publicTargetKey: string;
  role: string;
  accessibleName: string;
}

export interface PublicOverlayTarget {
  contractVersion: 1 | 2;
  materializationMode: OverlayMaterializationMode;
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
  locator: PublicTargetLocator | null;
  actionMode: OverlayActionMode;
  createdAt: string;
  expiresAt: string;
  consumedAt: string | null;
}

export interface MaterializedDomOverlayTarget {
  target: PublicOverlayTarget;
  localRectangle: OverlayRectangle;
  viewport: OverlayViewport;
}

export interface ObservedDomTargetClick extends MaterializedDomOverlayTarget {
  clickPosition: {
    clientX: number;
    clientY: number;
  };
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
  publicTargetKey: string;
}

export interface DemoAgentBridgeBinding {
  sessionId: string;
  browserBindingId: string;
  bridgeToken: string;
  pageIdentity: string;
  expiresAt: string;
  recoveryPath: string;
  pageReadyStatus: 'READY';
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
  publicTargetKey: string;
  role: string;
  actionMode: OverlayActionMode;
  localRectangle: OverlayRectangle;
  clickPosition: {
    clientX: number;
    clientY: number;
  };
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
