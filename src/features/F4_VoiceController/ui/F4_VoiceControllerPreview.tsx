import { useMemo, useState } from 'react';

import partialResultMock from '../../../../mocks/stt-partial-result.json';
import finalResultMock from '../../../../mocks/stt-final-result.json';
import {
  VOICE_CONTROLLER_PREVIEW_SELECTORS,
  type SpeechRecognitionAlternativeLike,
  type SpeechRecognitionErrorEventLike,
  type SpeechRecognitionEventLike,
  type SpeechRecognitionFactory,
  type SpeechRecognitionInstance,
  type SpeechRecognitionResultLike,
  type SpeechRecognitionResultListLike
} from '@/features/F4_VoiceController/model/speech-recognition';
import {
  TTS_PREVIEW_SELECTORS,
  type SpeechSynthesisAdapter,
  type SpeechSynthesisErrorEventLike,
  type SpeechSynthesisFactory,
  type SpeechSynthesisUtteranceLike,
  type SpeechSynthesisVoiceLike
} from '@/features/F4_VoiceController/model/speech-synthesis';
import { Button } from '@/shared/ui/Button';
import { NoticeBox } from '@/shared/ui/NoticeBox';
import { Panel } from '@/shared/ui/Panel';
import { Text } from '@/shared/ui/Text';
import type { SttEvent } from '@/types/stt-events';

import F4_VoiceController from './F4_VoiceController';

const PREVIEW_TTS_MESSAGE =
  '현재 화면에서 필요한 항목을 직접 선택해 주세요.';

interface PreviewResult {
  text: string;
  isFinal: boolean;
  confidence: number | null;
}

class PreviewSpeechRecognition implements SpeechRecognitionInstance {
  lang = 'ko-KR';
  interimResults = true;
  continuous = false;
  maxAlternatives = 1;
  onstart: (() => void) | null = null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null = null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null = null;
  onend: (() => void) | null = null;

  start() {
    this.onstart?.();
  }

  stop() {
    this.onend?.();
  }

  abort() {
    // Preview cleanup only. It does not access a browser microphone.
  }

  emitResult({ text, isFinal, confidence }: PreviewResult) {
    const alternatives: SpeechRecognitionAlternativeLike[] = [
      { transcript: text, confidence: confidence ?? Number.NaN }
    ];
    const result = Object.assign(alternatives, {
      isFinal,
      item: (index: number) => alternatives[index] ?? null
    }) as SpeechRecognitionResultLike;
    const results = Object.assign([result], {
      item: (index: number) => (index === 0 ? result : null)
    }) as SpeechRecognitionResultListLike;
    this.onresult?.({ resultIndex: 0, results });
  }

  emitError(error: string) {
    this.onerror?.({ error });
  }
}

class PreviewRecognitionHarness {
  current: PreviewSpeechRecognition | null = null;

  readonly factory: SpeechRecognitionFactory = () => {
    const recognition = new PreviewSpeechRecognition();
    this.current = recognition;
    return recognition;
  };
}

class PreviewSpeechSynthesisUtterance
  implements SpeechSynthesisUtteranceLike
{
  lang = '';
  rate = 1;
  voice: SpeechSynthesisVoiceLike | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: SpeechSynthesisErrorEventLike) => void) | null = null;

  constructor(public text: string) {}
}

class PreviewSynthesisHarness implements SpeechSynthesisAdapter {
  voices: SpeechSynthesisVoiceLike[] = [
    { name: 'preview-korean', lang: 'ko-KR' }
  ];
  utterances: PreviewSpeechSynthesisUtterance[] = [];
  current: PreviewSpeechSynthesisUtterance | null = null;
  speakCount = 0;
  cancelCount = 0;
  voiceListener: (() => void) | null = null;

  constructor(private readonly onAction: (message: string) => void) {}

  readonly factory: SpeechSynthesisFactory = () => this;

  createUtterance(text: string) {
    const utterance = new PreviewSpeechSynthesisUtterance(text);
    this.utterances.push(utterance);
    this.current = utterance;
    this.onAction(`Mock utterance 생성 ${this.utterances.length}회`);
    return utterance;
  }

  speak(utterance: SpeechSynthesisUtteranceLike) {
    this.current = utterance as PreviewSpeechSynthesisUtterance;
    this.speakCount += 1;
    this.onAction(
      `Mock speak ${this.speakCount}회 · ${utterance.lang} · ${utterance.rate} · ${utterance.voice?.name ?? 'browser-default'} · ${utterance.text}`
    );
  }

  pause() {
    this.onAction('Mock pause');
  }

  resume() {
    this.onAction('Mock resume');
  }

  cancel() {
    this.cancelCount += 1;
    this.onAction(`Mock cancel ${this.cancelCount}회`);
  }

  getVoices() {
    return this.voices;
  }

  addEventListener(_type: 'voiceschanged', listener: () => void) {
    this.voiceListener = listener;
  }

  removeEventListener(_type: 'voiceschanged', listener: () => void) {
    if (this.voiceListener === listener) {
      this.voiceListener = null;
    }
  }

  emitStart() {
    this.onAction('Mock onstart 발생');
    this.current?.onstart?.();
  }

  emitEnd() {
    this.onAction('Mock onend 발생');
    this.current?.onend?.();
  }

  emitError() {
    this.onAction('Mock onerror 발생');
    this.current?.onerror?.({ error: 'network' });
  }

  emitVoicesChanged() {
    this.voices = [{ name: 'preview-late-korean', lang: 'ko-KR' }];
    this.voiceListener?.();
    this.onAction('Mock voiceschanged 발생 · 자동 재생 없음');
  }
}

function elementIdentity(id: string) {
  return { id, 'data-testid': id };
}

export default function F4_VoiceControllerPreview() {
  const [lastTtsAction, setLastTtsAction] = useState(
    '아직 요청된 Mock TTS 동작이 없습니다.'
  );
  const recognitionHarness = useMemo(
    () => new PreviewRecognitionHarness(),
    []
  );
  const synthesisHarness = useMemo(
    () => new PreviewSynthesisHarness(setLastTtsAction),
    []
  );
  const [lastEvent, setLastEvent] = useState<SttEvent | null>(null);
  const [isSecureInput, setIsSecureInput] = useState(false);
  const [isUnsupported, setIsUnsupported] = useState(false);
  const [isDisabled, setIsDisabled] = useState(false);

  return (
    <main
      {...elementIdentity(VOICE_CONTROLLER_PREVIEW_SELECTORS.root)}
      className="mx-auto w-full max-w-6xl space-y-6 p-6"
    >
      <Text variant="title">Web Speech STT 개발 Preview</Text>
      <NoticeBox variant="warning" title="개발 전용 Mock" announce="off">
        실제 마이크를 사용하지 않으며 실제 음성 출력도 발생하지 않습니다.
        인식 문장은 실제 AI 또는 서버로 전송하지 않습니다.
      </NoticeBox>

      <Panel
        title="Mock 제어"
        description="실제 브라우저 음성 API 없이 STT와 TTS callback 상태를 확인하세요."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Button
            variant="secondary"
            onClick={() =>
              recognitionHarness.current?.emitResult({
                text: partialResultMock.text,
                isFinal: false,
                confidence: partialResultMock.confidence
              })
            }
          >
            Mock 중간 결과
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              recognitionHarness.current?.emitResult({
                text: finalResultMock.text,
                isFinal: true,
                confidence: finalResultMock.confidence
              })
            }
          >
            Mock 최종 결과
          </Button>
          <Button
            variant="danger"
            onClick={() => recognitionHarness.current?.emitError('no-speech')}
          >
            Mock 오류
          </Button>
          <Button
            variant="secondary"
            onClick={() => synthesisHarness.emitStart()}
          >
            Mock TTS 시작
          </Button>
          <Button
            variant="secondary"
            onClick={() => synthesisHarness.emitEnd()}
          >
            Mock TTS 종료
          </Button>
          <Button
            variant="danger"
            onClick={() => synthesisHarness.emitError()}
          >
            Mock TTS 오류
          </Button>
          <Button
            variant="secondary"
            onClick={() => synthesisHarness.emitVoicesChanged()}
          >
            Mock 음성 목록 갱신
          </Button>
          <Button
            variant="secondary"
            onClick={() => setIsSecureInput((current) => !current)}
          >
            보안 입력 {isSecureInput ? '끄기' : '켜기'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => setIsUnsupported((current) => !current)}
          >
            미지원 상태 {isUnsupported ? '해제' : '확인'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => setIsDisabled((current) => !current)}
          >
            전체 제어 {isDisabled ? '활성화' : '비활성화'}
          </Button>
        </div>
      </Panel>

      <F4_VoiceController
        sessionId="preview-stt-session"
        message={PREVIEW_TTS_MESSAGE}
        disabled={isDisabled}
        isSecureInput={isSecureInput}
        recognitionFactory={isUnsupported ? null : recognitionHarness.factory}
        synthesisFactory={isUnsupported ? null : synthesisHarness.factory}
        onSttEvent={setLastEvent}
      />

      <Panel title="마지막 SttEvent">
        <p
          {...elementIdentity(VOICE_CONTROLLER_PREVIEW_SELECTORS.eventStatus)}
          role="status"
          aria-live="polite"
          className="break-words text-base leading-relaxed"
        >
          {lastEvent
            ? `${lastEvent.type}: ${'text' in lastEvent ? lastEvent.text : '이벤트가 생성되었습니다.'}`
            : '아직 생성된 이벤트가 없습니다.'}
        </p>
      </Panel>

      <Panel title="마지막 Mock TTS 동작">
        <p
          {...elementIdentity(TTS_PREVIEW_SELECTORS.actionStatus)}
          role="status"
          aria-live="polite"
          className="break-words text-base leading-relaxed"
        >
          {lastTtsAction}
        </p>
      </Panel>
    </main>
  );
}
