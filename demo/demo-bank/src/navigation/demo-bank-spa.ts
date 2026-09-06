import { ELEMENT_IDS } from '../constants/element-ids';
import { normalizePathname, ROUTES } from '../constants/routes';
import type { BrowserNavigationMode, PendingBrowserNavigation } from '../features/AgentChat/model/navigation-types';

export const DEMO_BANK_SPA_NAVIGATION_EVENT = 'ddd:demo-bank-spa-navigation';

const routeRootIds: Record<PendingBrowserNavigation['destinationRoute'], string> = {
  [ROUTES.DEPOSIT_PRODUCTS]: ELEMENT_IDS.PAGE_DEPOSIT_PRODUCTS,
  [ROUTES.TRANSFER_ACCOUNTS]: ELEMENT_IDS.PAGE_TRANSFER_ACCOUNTS
};

export function isDemoBankAgentRoute(
  route: string
): route is PendingBrowserNavigation['destinationRoute'] {
  return route === ROUTES.DEPOSIT_PRODUCTS || route === ROUTES.TRANSFER_ACCOUNTS;
}

export function navigateDemoBankSpa(
  route: PendingBrowserNavigation['destinationRoute'],
  mode: BrowserNavigationMode
) {
  if (!isDemoBankAgentRoute(route)) throw new Error('UNSAFE_NAVIGATION_ROUTE');
  if (mode === 'SPA_REPLACE') window.history.replaceState(null, '', route);
  else window.history.pushState(null, '', route);
  window.dispatchEvent(new Event(DEMO_BANK_SPA_NAVIGATION_EVENT));
}

export function readDemoBankPathname() {
  return normalizePathname(window.location.pathname);
}

export function waitForDemoBankRouteReady(
  route: PendingBrowserNavigation['destinationRoute'],
  signal: AbortSignal,
  timeoutMs = 2000
): Promise<void> {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (signal.aborted) {
        reject(new DOMException('Navigation aborted', 'AbortError'));
        return;
      }
      if (readDemoBankPathname() === route && document.getElementById(routeRootIds[route])) {
        resolve();
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error('NAVIGATION_RENDER_TIMEOUT'));
        return;
      }
      window.setTimeout(check, 16);
    };
    check();
  });
}
