import { useLayoutEffect, useState } from 'react';

import type { AgentPageProtection } from '../model/conversation-safety';

const SECURE_INPUT_POLICY = '[data-ddd-policy="secure-input"]';
const FINAL_CONFIRMATION_POLICY = '[data-ddd-policy="final-confirmation"]';

function readPageProtection(): AgentPageProtection {
  if (document.querySelector(SECURE_INPUT_POLICY)) return 'SECURE_INPUT_ACTIVE';
  if (document.querySelector(FINAL_CONFIRMATION_POLICY)) return 'FINAL_CONFIRMATION_ACTIVE';
  return 'NONE';
}

export function useAgentPageProtection() {
  const [protection, setProtection] = useState<AgentPageProtection>('NONE');

  useLayoutEffect(() => {
    const synchronize = () => setProtection(readPageProtection());
    synchronize();
    const observer = new MutationObserver(synchronize);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-ddd-policy']
    });
    return () => observer.disconnect();
  }, []);

  return protection;
}
