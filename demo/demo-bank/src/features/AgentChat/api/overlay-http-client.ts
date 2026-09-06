import {
  parseBridgeRecovery,
  parseObservationAck
} from './overlay-contract';
import type {
  ConversationBridgeRecovery,
  DemoAgentBridgeBinding,
  InteractionObservationAccepted,
  InteractionObservationRequest,
  OverlayViewport
} from '../model/overlay-types';
import { DEFAULT_CONVERSATION_API_BASE_URL } from './conversation-http-client';

export interface OverlayHttpClient {
  recoverBridge(
    binding: DemoAgentBridgeBinding,
    viewport: OverlayViewport,
    signal: AbortSignal
  ): Promise<ConversationBridgeRecovery>;
  observeClick(
    binding: DemoAgentBridgeBinding,
    request: InteractionObservationRequest,
    signal: AbortSignal
  ): Promise<InteractionObservationAccepted>;
}

async function jsonResponse(response: Response, status: number) {
  if (response.status !== status || !response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('UNSAFE_OVERLAY_RESPONSE');
  }
  return response.json() as Promise<unknown>;
}

export function createOverlayHttpClient(
  baseUrl = import.meta.env.VITE_BACKEND_BASE_URL || DEFAULT_CONVERSATION_API_BASE_URL,
  fetcher: typeof fetch = fetch
): OverlayHttpClient {
  const normalizedBase = baseUrl.replace(/\/$/u, '');
  const bridgeHeaders = (binding: DemoAgentBridgeBinding) => ({
    Accept: 'application/json',
    'X-DDD-Bridge-Token': binding.bridgeToken,
    'X-DDD-Browser-Binding-Id': binding.browserBindingId,
    'X-DDD-Page-Identity': binding.pageIdentity
  });

  return {
    async recoverBridge(binding, viewport, signal) {
      const response = await fetcher(
        `${normalizedBase}${binding.recoveryPath}`,
        { method: 'GET', headers: bridgeHeaders(binding), cache: 'no-store', signal }
      );
      const recovery = parseBridgeRecovery(await jsonResponse(response, 200), binding, viewport);
      if (!recovery) throw new Error('INVALID_BRIDGE_RECOVERY');
      return recovery;
    },
    async observeClick(binding, request, signal) {
      const response = await fetcher(
        `${normalizedBase}/api/v1/sessions/${encodeURIComponent(binding.sessionId)}/interaction-observations`,
        {
          method: 'POST',
          headers: { ...bridgeHeaders(binding), 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
          cache: 'no-store',
          keepalive: true,
          signal
        }
      );
      const accepted = parseObservationAck(await jsonResponse(response, 202), {
        sessionId: binding.sessionId,
        requestId: request.requestId,
        targetId: request.targetId,
        pageIdentity: binding.pageIdentity,
        sourceSnapshotId: request.sourceSnapshotId
      });
      if (!accepted) throw new Error('INVALID_OBSERVATION_ACK');
      return accepted;
    }
  };
}
