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
  interactionBlockedReason?: string | null;
  speechRecognition?: {
    isSupported: boolean;
    isListening: boolean;
    start: () => void;
    stop: () => void;
  };
}

const VALIDATION_ID = 'status-agent-message-validation';

export default function MessageComposer({
  value,
  submitPhase,
  onDraftChange,
  onSubmit,
  interactionBlocked = false,
  interactionBlockedReason = null,
  speechRecognition
}: MessageComposerProps) {
  const [sensitiveInputBlocked, setSensitiveInputBlocked] = useState(false);
  const validation = validateChatMessage(value, {
    isSubmissionPending:
      isConversationSubmissionPending(submitPhase) || interactionBlocked
  });
  const hasValidationMessage =
    sensitiveInputBlocked || !validation.issues.includes('EMPTY');
  const describedBy = [
    hasValidationMessage ? VALIDATION_ID : null,
    interactionBlockedReason ? 'agent-protection-reason' : null
  ]
    .filter(Boolean)
    .join(' ') || undefined;

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
        aria-describedby={describedBy}
        aria-invalid={sensitiveInputBlocked ? 'true' : undefined}
        readOnly={sensitiveInputBlocked}
        onChange={(event) => handleDraftChange(event.currentTarget.value)}
        disabled={interactionBlocked}
      />
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
        ) : validation.issues.includes('EMPTY') ? null : validation.safeError ? (
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
            aria-describedby={interactionBlockedReason ? 'agent-protection-reason' : undefined}
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
        aria-describedby={describedBy}
        aria-busy={submitPhase === 'SUBMITTING' ? 'true' : undefined}
      >
        {submitPhase === 'SUBMITTING' ? '전송 준비 중' : '요청 전송'}
      </button>
    </form>
  );
}
