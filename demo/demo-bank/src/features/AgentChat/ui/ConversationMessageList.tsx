import type { ConversationMessage } from '../model/conversation-types';
import ConversationMessageItem from './ConversationMessageItem';

interface ConversationMessageListProps {
  messages: ConversationMessage[];
  onSpeak?: (text: string) => void;
  canSpeak?: boolean;
}

export default function ConversationMessageList({
  messages,
  onSpeak,
  canSpeak
}: ConversationMessageListProps) {
  return (
    <div className="agent-message-region">
      <h3 className="agent-section-title">대화 내용</h3>
      <ol
        className="agent-message-list"
        role="log"
        aria-label="AI 도우미 대화"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {messages.length === 0 ? (
          <li className="agent-empty-message">
            아직 대화가 없습니다. 원하는 금융 업무를 입력해 주세요.
          </li>
        ) : (
          messages.map((message) => (
            <ConversationMessageItem
              key={message.messageId}
              message={message}
              onSpeak={onSpeak}
              canSpeak={canSpeak}
            />
          ))
        )}
      </ol>
    </div>
  );
}
