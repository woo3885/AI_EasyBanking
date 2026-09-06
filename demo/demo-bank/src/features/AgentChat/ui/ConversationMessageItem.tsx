import type { ConversationMessage } from '../model/conversation-types';

interface ConversationMessageItemProps {
  message: ConversationMessage;
  onSpeak?: (text: string) => void;
  canSpeak?: boolean;
}

const kindLabels = {
  MESSAGE: '메시지',
  QUESTION: '질문',
  STATUS: '상태',
  WARNING: '주의'
} as const;

export default function ConversationMessageItem({
  message,
  onSpeak,
  canSpeak = false
}: ConversationMessageItemProps) {
  const speakerLabel = message.role === 'USER' ? '사용자' : 'AI 안내';

  return (
    <li className={`agent-message agent-message-${message.role.toLowerCase()}`}>
      <article aria-label={`${speakerLabel} ${kindLabels[message.kind]}`}>
        <div className="agent-message-heading">
          <strong>{speakerLabel}</strong>
          <span>{kindLabels[message.kind]}</span>
        </div>
        <p>{message.text}</p>
        {message.role === 'AI' && onSpeak ? (
          <button
            type="button"
            className="agent-message-speech"
            disabled={!canSpeak}
            onClick={() => onSpeak(message.text)}
          >
            이 안내 읽어주기
          </button>
        ) : null}
      </article>
    </li>
  );
}
