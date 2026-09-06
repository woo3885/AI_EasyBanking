import type {
  ConversationConnectionPhase,
  ConversationMessage,
  ConversationSafeError,
  ConversationSubmitPhase
} from '../model/conversation-types';
import ConversationMessageList from './ConversationMessageList';
import MessageComposer from './MessageComposer';
import SensitiveMessageWarning from './SensitiveMessageWarning';

export interface AgentChatPanelProps {
  value: string;
  messages: ConversationMessage[];
  submitPhase: ConversationSubmitPhase;
  safeError: ConversationSafeError | null;
  onDraftChange: (value: string) => void;
  onSubmit: (message: string) => void;
  onDismissError: () => void;
  connectionPhase?: ConversationConnectionPhase;
  interactionBlocked?: boolean;
  interactionBlockedReason?: string | null;
  canReconnect?: boolean;
  onReconnect?: () => void;
  speechRecognition?: {
    isSupported: boolean;
    isListening: boolean;
    start: () => void;
    stop: () => void;
  };
  speechSynthesis?: {
    isSupported: boolean;
    isSpeaking: boolean;
    speak: (text: string) => void;
    stop: () => void;
  };
}

const quickRequests = [
  '100만 원으로 예금 가입하기',
  '예금 상품 알아보기'
] as const;

const phaseMessages: Partial<Record<ConversationSubmitPhase, string>> = {
  SUBMITTING: '요청을 안전하게 확인하고 있습니다.',
  WAITING_FOR_ACK: 'Backend 요청 접수를 기다리고 있습니다.',
  WAITING_FOR_AI: 'AI 답변을 기다리고 있습니다.'
};

export default function AgentChatPanel({
  value,
  messages,
  submitPhase,
  safeError,
  onDraftChange,
  onSubmit,
  onDismissError,
  connectionPhase = 'DISCONNECTED',
  interactionBlocked = false,
  interactionBlockedReason = null,
  canReconnect = false,
  onReconnect,
  speechRecognition,
  speechSynthesis
}: AgentChatPanelProps) {
  const phaseMessage = phaseMessages[submitPhase];
  const isPending =
    submitPhase === 'SUBMITTING' ||
    submitPhase === 'WAITING_FOR_ACK' ||
    submitPhase === 'WAITING_FOR_AI';

  return (
    <section className="agent-chat-panel" aria-labelledby="agent-chat-title">
      <div className="agent-chat-heading">
        <p className="agent-chat-kicker">대화형 AI 연결</p>
        <h2 id="agent-chat-title">AI 금융 도우미</h2>
        <p>
          원하는 업무를 입력하면 AI가 필요한 정보를 질문하는
          구조입니다.
        </p>
      </div>

      <p className="agent-connection-status" aria-live="polite">
        대화 연결: {connectionPhase === 'CONNECTED' ? '연결됨' : connectionPhase === 'RECONNECTING' ? '다시 연결 중' : connectionPhase === 'CONNECTING' ? '연결 중' : '연결 전'}
      </p>

      {interactionBlockedReason ? (
        <p id="agent-protection-reason" className="agent-protection-notice" role="alert">
          {interactionBlockedReason}
        </p>
      ) : null}

      <ConversationMessageList
        messages={messages}
        onSpeak={speechSynthesis?.speak}
        canSpeak={Boolean(speechSynthesis?.isSupported && !interactionBlocked)}
      />

      {speechSynthesis?.isSpeaking ? (
        <button type="button" className="agent-speech-stop" onClick={speechSynthesis.stop}>
          읽기 중지
        </button>
      ) : null}

      {phaseMessage ? (
        <p className="agent-submit-status" role="status" aria-live="polite">
          {phaseMessage}
        </p>
      ) : null}
      {safeError ? (
        <SensitiveMessageWarning
          message={safeError}
          onDismiss={onDismissError}
        />
      ) : null}
      {canReconnect && onReconnect ? (
        <button type="button" className="agent-reconnect-button" onClick={onReconnect}>
          대화 다시 연결
        </button>
      ) : null}

      <div className="agent-quick-requests" aria-label="빠른 요청 예시">
        <p>빠른 요청은 입력창에만 넣어 드립니다.</p>
        <div>
          {quickRequests.map((request) => (
            <button
              key={request}
              type="button"
              disabled={isPending || interactionBlocked}
              aria-describedby={interactionBlockedReason ? 'agent-protection-reason' : undefined}
              onClick={() => onDraftChange(request)}
            >
              {request}
            </button>
          ))}
        </div>
      </div>

      <MessageComposer
        value={value}
        submitPhase={submitPhase}
        interactionBlocked={interactionBlocked}
        interactionBlockedReason={interactionBlockedReason}
        speechRecognition={speechRecognition}
        onDraftChange={onDraftChange}
        onSubmit={onSubmit}
      />
    </section>
  );
}
