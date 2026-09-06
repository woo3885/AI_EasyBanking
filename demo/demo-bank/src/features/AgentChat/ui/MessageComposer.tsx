import { useState, type FormEvent } from 'react';

import {
  CHAT_SENSITIVE_ERROR,
  isConversationSubmissionPending,
  validateChatMessage
} from '../model/chat-message-policy';
import type { ConversationSubmitPhase } from '../model/conversation-types';
import SensitiveMessageWarning from './SensitiveMessageWarning';

interface MessageComposerProps {
  value: string;
  submitPhase: ConversationSubmitPhase;
  onDraftChange: (value: string) => void;
  onSubmit: (message: string) => void;
  interactionBlocked?: boolean;
  speechRecognition?: {
    isSupported: boolean;
    isListening: boolean;
    start: () => void;
    stop: () => void;
  };
}

const DESCRIPTION_ID = 'description-agent-message-policy';
const VALIDATION_ID = 'status-agent-message-validation';

export default function MessageComposer({
  value,
  submitPhase,
  onDraftChange,
  onSubmit,
  interactionBlocked = false,
  speechRecognition
}: MessageComposerProps) {
  const [sensitiveInputBlocked, setSensitiveInputBlocked] = useState(false);
  const validation = validateChatMessage(value, {
    isSubmissionPending:
      isConversationSubmissionPending(submitPhase) || interactionBlocked
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (validation.isValid) {
      onSubmit(validation.normalizedMessage);
    }
  };

  const handleDraftChange = (candidate: string) => {
    const candidateValidation = validateChatMessage(candidate);
    if (candidateValidation.issues.includes('SENSITIVE_INFORMATION')) {
      setSensitiveInputBlocked(true);
      onDraftChange('');
      return;
    }
    if (!sensitiveInputBlocked) {
      onDraftChange(candidate);
    }
  };

  const handleSensitiveWarningDismiss = () => {
    setSensitiveInputBlocked(false);
    onDraftChange('');
  };

  return (
    <form className="agent-composer" onSubmit={handleSubmit}>
      <label htmlFor="input-agent-message">업무 요청</label>
      <textarea
        id="input-agent-message"
        value={value}
        rows={4}
        aria-describedby={`${DESCRIPTION_ID} ${VALIDATION_ID}`}
        aria-invalid={sensitiveInputBlocked ? 'true' : undefined}
        readOnly={sensitiveInputBlocked}
        onChange={(event) => handleDraftChange(event.currentTarget.value)}
        disabled={interactionBlocked}
      />
      <p id={DESCRIPTION_ID} className="agent-composer-guide">
        비밀번호, OTP, PIN, 인증번호는 입력하지 마세요.
      </p>
      <div id={VALIDATION_ID}>
        {sensitiveInputBlocked ? (
          <SensitiveMessageWarning
            message={CHAT_SENSITIVE_ERROR}
            onDismiss={handleSensitiveWarningDismiss}
          />
        ) : validation.issues.includes('SENSITIVE_INFORMATION') &&
          validation.safeError ? (
          <SensitiveMessageWarning
            message={validation.safeError}
            onDismiss={handleSensitiveWarningDismiss}
          />
        ) : validation.safeError ? (
          <p className="agent-composer-validation">{validation.safeError}</p>
        ) : (
          <p className="agent-composer-ready">안전한 요청을 전송할 수 있습니다.</p>
        )}
      </div>
      {speechRecognition?.isSupported ? (
        <div className="agent-voice-actions" aria-label="음성 입력">
          <button
            type="button"
            disabled={interactionBlocked || speechRecognition.isListening}
            onClick={speechRecognition.start}
          >
            음성 입력 시작
          </button>
          <button
            type="button"
            disabled={!speechRecognition.isListening}
            onClick={speechRecognition.stop}
          >
            음성 입력 중지
          </button>
          {speechRecognition.isListening ? <span role="status">음성을 듣고 있습니다.</span> : null}
        </div>
      ) : null}
      <button
        type="submit"
        className="agent-submit-button"
        disabled={sensitiveInputBlocked || interactionBlocked || !validation.isValid}
        aria-describedby={`${DESCRIPTION_ID} ${VALIDATION_ID}`}
        aria-busy={submitPhase === 'SUBMITTING' ? 'true' : undefined}
      >
        {submitPhase === 'SUBMITTING' ? '전송 준비 중' : '요청 전송'}
      </button>
    </form>
  );
}
