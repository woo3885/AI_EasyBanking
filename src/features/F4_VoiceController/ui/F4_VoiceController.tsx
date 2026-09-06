import { useId } from 'react';

import { useSpeechRecognition } from '@/features/F4_VoiceController/hooks/useSpeechRecognition';
import { useSpeechSynthesis } from '@/features/F4_VoiceController/hooks/useSpeechSynthesis';
import {
  VOICE_CONTROLLER_SELECTORS,
  type SpeechRecognitionFactory,
  type SpeechRecognitionStatus
} from '@/features/F4_VoiceController/model/speech-recognition';
import {
  isSpeechSynthesisRate,
  SPEECH_SYNTHESIS_RATE_OPTIONS,
  TTS_CONTROLLER_SELECTORS,
  type SpeechSynthesisFactory,
  type SpeechSynthesisStatus
} from '@/features/F4_VoiceController/model/speech-synthesis';
import { Button } from '@/shared/ui/Button';
import { NoticeBox } from '@/shared/ui/NoticeBox';
import { Text } from '@/shared/ui/Text';
import type { SttEvent } from '@/types/stt-events';

export interface VoiceControllerProps {
  sessionId: string;
  /** 부모가 민감정보를 제거한 뒤 전달하는 화면 표시·TTS 공용 안내 문장이다. */
  message?: string;
  disabled?: boolean;
  isSecureInput?: boolean;
  onSttEvent?: (event: SttEvent) => void;
  /** 실제 제품 기능이 아닌 테스트·Mock Preview용 dependency injection이다. */
  recognitionFactory?: SpeechRecognitionFactory | null;
  /** undefined는 브라우저 탐지, null은 강제 미지원, factory는 테스트 주입이다. */
  synthesisFactory?: SpeechSynthesisFactory | null;
}

const STATUS_MESSAGES: Record<SpeechRecognitionStatus, string> = {
  IDLE: '음성 입력을 시작할 수 있습니다.',
  STARTING: '마이크 연결을 준비하고 있습니다.',
  LISTENING: '음성을 듣고 있습니다. 말씀해 주세요.',
  STOPPING: '음성 입력을 마치는 중입니다.',
  COMPLETED: '음성 인식이 완료되었습니다.',
  ERROR: '음성 인식 중 문제가 발생했습니다.',
  UNSUPPORTED: '이 브라우저에서는 음성 입력을 지원하지 않습니다.'
};

const TTS_STATUS_MESSAGES: Record<SpeechSynthesisStatus, string> = {
  IDLE: '안내 듣기 버튼으로 음성 안내를 시작할 수 있습니다.',
  STARTING: '음성 안내 시작을 요청했습니다.',
  SPEAKING: '음성 안내를 재생하고 있습니다.',
  PAUSED: '음성 안내를 일시정지했습니다.',
  COMPLETED: '음성 안내 재생이 끝났습니다.',
  ERROR: '음성 안내를 재생하지 못했습니다. 다시 시도해 주세요.',
  UNSUPPORTED: '이 브라우저에서는 음성 안내를 사용할 수 없습니다.'
};

function elementIdentity(id: string) {
  return { id, 'data-testid': id };
}

export default function F4_VoiceController({
  sessionId,
  message = '',
  disabled = false,
  isSecureInput = false,
  onSttEvent,
  recognitionFactory,
  synthesisFactory
}: VoiceControllerProps) {
  const ttsHeadingId = useId();
  const rateLabelId = useId();
  const {
    status,
    interimText,
    finalText,
    errorMessage,
    isSupported,
    retryable,
    start,
    stop,
    retry,
    clear
  } = useSpeechRecognition({
    sessionId,
    disabled,
    isSecureInput,
    onSttEvent,
    recognitionFactory
  });
  const {
    status: ttsStatus,
    rate,
    errorMessage: ttsErrorMessage,
    hasPlaybackRequest,
    isSupported: isTtsSupported,
    play,
    replay,
    togglePause,
    stop: stopTts,
    setRate
  } = useSpeechSynthesis({
    message,
    disabled,
    isSecureInput,
    synthesisFactory
  });
  const isBusy =
    status === 'STARTING' ||
    status === 'LISTENING' ||
    status === 'STOPPING';
  const hasContent = Boolean(interimText || finalText || errorMessage);
  const sessionUnavailable = sessionId.trim().length === 0;
  const startDisabled =
    disabled ||
    isSecureInput ||
    !isSupported ||
    sessionUnavailable ||
    isBusy;
  const stopDisabled =
    disabled ||
    isSecureInput ||
    (status !== 'STARTING' && status !== 'LISTENING');
  const retryDisabled =
    disabled ||
    isSecureInput ||
    status !== 'ERROR' ||
    !retryable;
  const normalizedMessage = message.trim();
  const isTtsBusy = ttsStatus === 'STARTING' || ttsStatus === 'SPEAKING';
  const isTtsActive = isTtsBusy || ttsStatus === 'PAUSED';
  const playDisabled =
    disabled ||
    isSecureInput ||
    !isTtsSupported ||
    !normalizedMessage ||
    isTtsActive;
  const replayDisabled =
    disabled ||
    isSecureInput ||
    !isTtsSupported ||
    !normalizedMessage ||
    !hasPlaybackRequest;
  const ttsPauseDisabled =
    disabled ||
    isSecureInput ||
    (ttsStatus !== 'SPEAKING' && ttsStatus !== 'PAUSED');
  const ttsStopDisabled = disabled || isSecureInput || !isTtsActive;
  const rateDisabled = disabled || isSecureInput || !isTtsSupported;
  const selectedRate = SPEECH_SYNTHESIS_RATE_OPTIONS.find(
    (option) => option.value === rate
  );

  return (
    <div className="space-y-6">
      <section
        {...elementIdentity(VOICE_CONTROLLER_SELECTORS.root)}
        aria-label="음성 입력"
        aria-busy={isBusy}
        className="w-full rounded-2xl border-2 border-border bg-surface p-5 text-text-primary shadow-sm sm:p-6"
      >
        <Text as="h2" variant="heading">
          음성 입력
        </Text>
        <Text variant="body" className="mt-2 text-text-secondary">
          시작 버튼을 누른 뒤 원하는 금융 업무를 짧게 말씀해 주세요.
        </Text>

        {isSecureInput && (
          <NoticeBox
            {...elementIdentity(
              VOICE_CONTROLLER_SELECTORS.secureDisabledNotice
            )}
            variant="secure"
            title="보안정보 보호를 위해 음성 입력이 중단되었습니다."
            announce="polite"
            className="mt-5"
          >
            비밀번호와 일회용 인증번호는 말하지 말고 화면에서 직접 입력해
            주세요. 음성 입력은 자동으로 다시 시작되지 않습니다.
          </NoticeBox>
        )}

        {!isSupported && !isSecureInput && (
          <NoticeBox
            {...elementIdentity(
              VOICE_CONTROLLER_SELECTORS.unsupportedNotice
            )}
            variant="warning"
            title="음성 입력을 사용할 수 없습니다."
            announce="polite"
            className="mt-5"
          >
            다른 지원 브라우저를 사용하거나 텍스트 입력으로 진행해 주세요.
          </NoticeBox>
        )}

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Button
            {...elementIdentity(VOICE_CONTROLLER_SELECTORS.startButton)}
            size="lg"
            className="w-full whitespace-normal"
            disabled={startDisabled}
            aria-pressed={isBusy}
            onClick={start}
          >
            음성 입력 시작
          </Button>
          <Button
            {...elementIdentity(VOICE_CONTROLLER_SELECTORS.stopButton)}
            variant="secondary"
            size="lg"
            className="w-full whitespace-normal"
            disabled={stopDisabled}
            onClick={stop}
          >
            음성 입력 중지
          </Button>
          <Button
            {...elementIdentity(VOICE_CONTROLLER_SELECTORS.retryButton)}
            variant="secondary"
            size="lg"
            className="w-full whitespace-normal"
            disabled={retryDisabled}
            onClick={retry}
          >
            다시 시도
          </Button>
          <Button
            {...elementIdentity(VOICE_CONTROLLER_SELECTORS.clearButton)}
            variant="secondary"
            size="lg"
            className="w-full whitespace-normal"
            disabled={!hasContent || isSecureInput}
            onClick={clear}
          >
            인식 내용 지우기
          </Button>
        </div>

        <p
          {...elementIdentity(VOICE_CONTROLLER_SELECTORS.status)}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="mt-5 rounded-xl border border-border bg-slate-50 p-4 text-base font-semibold leading-relaxed text-text-primary"
        >
          {STATUS_MESSAGES[status]}
        </p>

        {errorMessage && !isSecureInput && (
          <NoticeBox
            variant="danger"
            title="음성 입력 오류"
            announce="assertive"
            className="mt-4"
          >
            {errorMessage}
          </NoticeBox>
        )}

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section
            {...elementIdentity(
              VOICE_CONTROLLER_SELECTORS.interimTranscript
            )}
            aria-label="중간 인식 결과"
            aria-live="off"
            className="rounded-xl border-2 border-border bg-slate-50 p-4"
          >
            <Text as="h3" variant="guide">
              중간 인식 결과
            </Text>
            <Text variant="body" className="mt-2 text-text-secondary">
              {interimText || '아직 인식 중인 문장이 없습니다.'}
            </Text>
          </section>

          <section
            {...elementIdentity(VOICE_CONTROLLER_SELECTORS.finalTranscript)}
            aria-label="최종 인식 결과"
            aria-live="polite"
            aria-atomic="true"
            className="rounded-xl border-2 border-primary bg-brand-50 p-4"
          >
            <Text as="h3" variant="guide">
              최종 인식 결과
            </Text>
            <Text variant="body" className="mt-2 text-text-secondary">
              {finalText || '아직 완료된 인식 결과가 없습니다.'}
            </Text>
          </section>
        </div>

        <Text variant="caption" className="mt-4 block">
          인식 내용은 이 화면의 로컬 상태에만 있으며 자동으로 서버에
          전송되지 않습니다.
        </Text>
      </section>

      <section
        {...elementIdentity(TTS_CONTROLLER_SELECTORS.root)}
        aria-labelledby={ttsHeadingId}
        aria-busy={isTtsBusy}
        className="w-full rounded-2xl border-2 border-border bg-surface p-5 text-text-primary shadow-sm sm:p-6"
      >
        <Text id={ttsHeadingId} as="h2" variant="heading">
          음성 안내
        </Text>
        <Text variant="body" className="mt-2 text-text-secondary">
          화면에 표시된 안전한 안내 문장을 사용자가 직접 재생할 수 있습니다.
        </Text>

        <div className="mt-5 rounded-xl border-2 border-border bg-slate-50 p-4">
          <Text as="h3" variant="guide">
            현재 안내 문장
          </Text>
          <Text variant="body" className="mt-2 text-text-primary">
            {isSecureInput
              ? '보안 입력 중에는 안내 문장을 표시하지 않습니다.'
              : normalizedMessage || '재생할 안내 문장이 없습니다.'}
          </Text>
        </div>

        {isSecureInput && (
          <NoticeBox
            {...elementIdentity(TTS_CONTROLLER_SELECTORS.secureNotice)}
            variant="secure"
            title="보안 입력 중에는 음성 안내를 사용할 수 없습니다."
            announce="polite"
            className="mt-5"
          >
            필요한 정보는 현재 화면에서 직접 입력해 주세요. 보안 입력이
            끝나도 음성 안내는 자동으로 시작되지 않습니다.
          </NoticeBox>
        )}

        {!isTtsSupported && !isSecureInput && (
          <NoticeBox
            {...elementIdentity(TTS_CONTROLLER_SELECTORS.unsupportedNotice)}
            variant="warning"
            title="음성 안내를 사용할 수 없습니다."
            announce="polite"
            className="mt-5"
          >
            화면의 안내 문장을 읽고 계속 진행해 주세요.
          </NoticeBox>
        )}

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Button
            {...elementIdentity(TTS_CONTROLLER_SELECTORS.playButton)}
            type="button"
            size="lg"
            className="w-full whitespace-normal"
            disabled={playDisabled}
            onClick={play}
          >
            안내 듣기
          </Button>
          <Button
            {...elementIdentity(TTS_CONTROLLER_SELECTORS.replayButton)}
            type="button"
            variant="secondary"
            size="lg"
            className="w-full whitespace-normal"
            disabled={replayDisabled}
            onClick={replay}
          >
            다시 듣기
          </Button>
          <Button
            {...elementIdentity(TTS_CONTROLLER_SELECTORS.pauseButton)}
            type="button"
            variant="secondary"
            size="lg"
            className="w-full whitespace-normal"
            disabled={ttsPauseDisabled}
            aria-pressed={ttsStatus === 'PAUSED'}
            onClick={togglePause}
          >
            {ttsStatus === 'PAUSED' ? '안내 계속 듣기' : '안내 일시정지'}
          </Button>
          <Button
            {...elementIdentity(TTS_CONTROLLER_SELECTORS.stopButton)}
            type="button"
            variant="secondary"
            size="lg"
            className="w-full whitespace-normal"
            disabled={ttsStopDisabled}
            onClick={stopTts}
          >
            음성 중지
          </Button>
        </div>

        <div className="mt-5">
          <label
            id={rateLabelId}
            htmlFor={TTS_CONTROLLER_SELECTORS.rateSelect}
            className="block text-lg font-bold leading-relaxed"
          >
            안내 속도
          </label>
          <select
            {...elementIdentity(TTS_CONTROLLER_SELECTORS.rateSelect)}
            aria-labelledby={rateLabelId}
            value={rate}
            disabled={rateDisabled}
            onChange={(event) => {
              const nextRate = Number(event.currentTarget.value);
              if (isSpeechSynthesisRate(nextRate)) {
                setRate(nextRate);
              }
            }}
            className="mt-2 min-h-14 w-full rounded-xl border-2 border-border bg-surface px-4 text-lg text-text-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {SPEECH_SYNTHESIS_RATE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <p
          {...elementIdentity(TTS_CONTROLLER_SELECTORS.playbackStatus)}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="mt-5 rounded-xl border border-border bg-slate-50 p-4 text-base font-semibold leading-relaxed text-text-primary"
        >
          {isSecureInput
            ? '보안 입력 중에는 음성 안내를 사용할 수 없습니다.'
            : TTS_STATUS_MESSAGES[ttsStatus]}
        </p>
        <p
          {...elementIdentity(TTS_CONTROLLER_SELECTORS.rateStatus)}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="mt-3 text-base leading-relaxed text-text-secondary"
        >
          현재 속도는 {selectedRate?.label ?? '보통'}입니다. 변경한 속도는 다음
          재생부터 적용됩니다.
        </p>

        {ttsErrorMessage && !isSecureInput && (
          <NoticeBox
            variant="danger"
            title="음성 안내 오류"
            announce="assertive"
            className="mt-4"
          >
            {ttsErrorMessage}
          </NoticeBox>
        )}
      </section>
    </div>
  );
}
