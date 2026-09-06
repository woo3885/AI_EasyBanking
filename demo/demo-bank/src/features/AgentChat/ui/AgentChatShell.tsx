import { useState } from 'react';

import { useAgentConversation, type AgentChatSubmitRequest, type AgentConversationDependencies } from '../hooks/use-agent-conversation';
import { useAgentPageProtection } from '../hooks/use-agent-page-protection';
import { useAgentSpeechRecognition, useAgentSpeechSynthesis } from '../hooks/use-agent-speech';
import { useDomTargetOverlay } from '../hooks/use-dom-target-overlay';
import { CHAT_SENSITIVE_ERROR } from '../model/chat-message-policy';
import AgentChatPanel from './AgentChatPanel';
import DomTargetOverlay from './DomTargetOverlay';
import '../styles/agent-chat.css';

interface AgentChatShellProps extends Omit<AgentConversationDependencies, 'onSubmitRequest'> {
  onSubmitRequest?: (request: AgentChatSubmitRequest) => void | Promise<void>;
}

export type { AgentChatSubmitRequest };

export default function AgentChatShell(props: AgentChatShellProps) {
  const pageProtection = useAgentPageProtection();
  const { state, protection, dispatch, submit, reconnect, clearOverlay, observeTarget } = useAgentConversation({
    ...props,
    pageProtection
  });
  const [isOpen, setIsOpen] = useState(true);
  const speechRecognition = useAgentSpeechRecognition({
    blocked: !protection.canStartStt,
    onDraft: (draft) => dispatch({ type: 'DRAFT_CHANGED', draft }),
    onSensitive: () => dispatch({ type: 'SAFE_ERROR_SET', error: CHAT_SENSITIVE_ERROR })
  });
  const speechSynthesis = useAgentSpeechSynthesis(!protection.canPlayTts, state.sessionId);
  const { materializedTarget } = useDomTargetOverlay({
    target: protection.canShowOverlay ? state.activeTarget : null,
    observationPhase: state.observationPhase,
    onClear: clearOverlay,
    onTargetClick: observeTarget
  });

  return (
    <>
      <aside
        className={`agent-chat-shell${isOpen ? '' : ' agent-chat-shell-closed'}`}
        data-ddd-agent-ui="true"
        aria-label="AI 금융 도우미"
      >
        <button
          type="button"
          className="agent-chat-toggle"
          aria-expanded={isOpen}
          aria-controls="agent-chat-panel-content"
          onClick={() => setIsOpen((open) => !open)}
        >
          {isOpen ? 'AI 채팅 접기' : 'AI 채팅 열기'}
        </button>
        {isOpen ? (
          <div id="agent-chat-panel-content">
            <AgentChatPanel
              value={state.draft}
              messages={state.messages}
              submitPhase={state.submitPhase}
              connectionPhase={state.connectionPhase}
              safeError={state.safeError}
              interactionBlocked={!protection.canSubmitMessage}
              interactionBlockedReason={protection.announcement}
              canReconnect={protection.canReconnect}
              speechRecognition={speechRecognition}
              speechSynthesis={speechSynthesis}
              onReconnect={reconnect}
              onDraftChange={(draft) => dispatch({ type: 'DRAFT_CHANGED', draft })}
              onSubmit={(message) => void submit(message)}
              onDismissError={() => dispatch({ type: 'DRAFT_CHANGED', draft: state.draft })}
            />
          </div>
        ) : null}
      </aside>
      {protection.canShowOverlay && materializedTarget ? (
        <DomTargetOverlay
          materializedTarget={materializedTarget}
          observationPhase={state.observationPhase}
        />
      ) : null}
    </>
  );
}
