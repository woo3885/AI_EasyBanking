export type BrowserNavigationMode = 'SPA_PUSH' | 'SPA_REPLACE';

export interface PendingBrowserNavigation {
  navigationId: string;
  browserBindingId: string;
  sourcePageIdentity: string;
  destinationPageIdentity: string;
  destinationRoute: '/deposit/products' | '/transfer/accounts';
  routeRevision: number;
  navigationMode: BrowserNavigationMode;
  expiresAt: string;
  guide: string;
}

export interface BrowserPageReadyRequest {
  requestId: string;
  navigationId: string;
  sourcePageIdentity: string;
  destinationPageIdentity: string;
  routeRevision: number;
  renderedRoute: PendingBrowserNavigation['destinationRoute'];
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
}

export interface BrowserPageReadyAccepted {
  sessionId: string;
  requestId: string;
  navigationId: string;
  browserBindingId: string;
  sourcePageIdentity: string;
  pageIdentity: string;
  routeRevision: number;
  renderedRoute: PendingBrowserNavigation['destinationRoute'];
  status: 'PAGE_READY_ACCEPTED';
  message: string;
}
