import { DEFAULT_CONVERSATION_API_BASE_URL } from './conversation-http-client';
import { parsePageReadyAccepted } from './navigation-contract';
import type {
  BrowserPageReadyAccepted,
  BrowserPageReadyRequest
} from '../model/navigation-types';
import type { DemoAgentBridgeBinding } from '../model/overlay-types';

export interface NavigationHttpClient {
  pageReady(
    binding: DemoAgentBridgeBinding,
    request: BrowserPageReadyRequest,
    signal: AbortSignal
  ): Promise<BrowserPageReadyAccepted>;
}

async function jsonResponse(response: Response, status: number) {
  if (response.status !== status || !response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('UNSAFE_PAGE_READY_RESPONSE');
  }
  return response.json() as Promise<unknown>;
}

export function createNavigationHttpClient(
  baseUrl = import.meta.env.VITE_BACKEND_BASE_URL || DEFAULT_CONVERSATION_API_BASE_URL,
  fetcher: typeof fetch = fetch
): NavigationHttpClient {
  const normalizedBase = baseUrl.replace(/\/$/u, '');
  return {
    async pageReady(binding, request, signal) {
      const response = await fetcher(
        `${normalizedBase}/api/v1/sessions/${encodeURIComponent(binding.sessionId)}/browser-bindings/page-ready`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-DDD-Bridge-Token': binding.bridgeToken,
            'X-DDD-Browser-Binding-Id': binding.browserBindingId,
            'X-DDD-Page-Identity': binding.pageIdentity
          },
          body: JSON.stringify(request),
          cache: 'no-store',
          signal
        }
      );
      const accepted = parsePageReadyAccepted(await jsonResponse(response, 200), binding, request);
      if (!accepted) throw new Error('INVALID_PAGE_READY_ACK');
      return accepted;
    }
  };
}
