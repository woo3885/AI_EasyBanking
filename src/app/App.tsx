import { useState } from 'react';

import F1_Dashboard from '@/features/F1_Dashboard/ui/F1_Dashboard';
import { createDashboardSessionRequest } from '@/features/F1_Dashboard/model/create-dashboard-session-request';
import type { DashboardStartSelection } from '@/features/F1_Dashboard/model/dashboard-session';
import SessionFramePreview from '@/features/Integration/ui/SessionFramePreview';
import SessionIntegrationView from '@/features/Integration/ui/SessionIntegrationView';
import {
  defaultSessionRestClient,
  type BackendSession
} from '@/features/Integration/api/session-rest-client';

export function shouldRenderSessionFramePreview(
  search: string,
  isDevelopment: boolean
): boolean {
  return isDevelopment && search === '?preview=session-frame';
}

export default function App() {
  const [activeSession, setActiveSession] =
    useState<BackendSession | null>(null);

  if (
    shouldRenderSessionFramePreview(
      window.location.search,
      import.meta.env.DEV
    )
  ) {
    return <SessionFramePreview />;
  }

  const handleStart = async (selection: DashboardStartSelection) => {
    const request = createDashboardSessionRequest(selection);
    const session = await defaultSessionRestClient.createSession({
      userRequest: request.userRequest,
      siteId: request.siteId,
      initialPath: request.initialPath
    });

    setActiveSession(session);

    return {
      sessionId: session.sessionId,
      webSocketUrl: session.frameWebSocketUrl,
      createdAt: new Date().toISOString()
    };
  };

  if (activeSession) {
    return (
      <SessionIntegrationView
        session={activeSession}
        onExit={() => setActiveSession(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-200 p-3 sm:p-6">
      <div className="mx-auto max-w-[1280px]">
        <F1_Dashboard onStart={handleStart} />
      </div>
    </div>
  );
}
