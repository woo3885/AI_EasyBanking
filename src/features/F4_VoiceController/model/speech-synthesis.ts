export const SPEECH_SYNTHESIS_LANGUAGE = 'ko-KR' as const;

export type SpeechSynthesisStatus =
  | 'IDLE'
  | 'STARTING'
  | 'SPEAKING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'ERROR'
  | 'UNSUPPORTED';

export type SpeechSynthesisRate = 0.8 | 1 | 1.2;

export interface SpeechSynthesisRateOption {
  value: SpeechSynthesisRate;
  label: '느리게' | '보통' | '빠르게';
}

/** D13 UI Mock 값이며 서버 또는 D1 확정 규격이 아니다. */
export const SPEECH_SYNTHESIS_RATE_OPTIONS = [
  { value: 0.8, label: '느리게' },
  { value: 1, label: '보통' },
  { value: 1.2, label: '빠르게' }
] as const satisfies readonly SpeechSynthesisRateOption[];

/** D13 UI Mock 기본값이며 브라우저와 운영체제에 따라 체감 속도가 다를 수 있다. */
export const DEFAULT_SPEECH_SYNTHESIS_RATE: SpeechSynthesisRate = 1;

export interface SpeechSynthesisVoiceLike {
  readonly name: string;
  readonly lang: string;
}

export interface SpeechSynthesisErrorEventLike {
  readonly error: string;
}

export interface SpeechSynthesisUtteranceLike {
  text: string;
  lang: string;
  rate: number;
  voice: SpeechSynthesisVoiceLike | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechSynthesisErrorEventLike) => void) | null;
}

export interface SpeechSynthesisAdapter {
  createUtterance: (text: string) => SpeechSynthesisUtteranceLike;
  speak: (utterance: SpeechSynthesisUtteranceLike) => void;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  getVoices: () => readonly SpeechSynthesisVoiceLike[];
  addEventListener: (
    type: 'voiceschanged',
    listener: () => void
  ) => void;
  removeEventListener: (
    type: 'voiceschanged',
    listener: () => void
  ) => void;
}

export type SpeechSynthesisFactory = () => SpeechSynthesisAdapter;

interface SpeechSynthesisGlobalLike {
  speechSynthesis?: unknown;
  SpeechSynthesisUtterance?: unknown;
}

interface BrowserSpeechSynthesisLike {
  speak: (utterance: SpeechSynthesisUtterance) => void;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  getVoices: () => SpeechSynthesisVoice[];
  addEventListener: (type: 'voiceschanged', listener: () => void) => void;
  removeEventListener: (type: 'voiceschanged', listener: () => void) => void;
}

type BrowserSpeechSynthesisUtteranceConstructor =
  new (text?: string) => SpeechSynthesisUtterance;

export const TTS_CONTROLLER_SELECTORS = {
  root: 'controller-tts',
  playButton: 'btn-tts-play',
  replayButton: 'btn-tts-replay',
  pauseButton: 'btn-tts-pause',
  stopButton: 'btn-tts-stop',
  rateSelect: 'select-tts-rate',
  playbackStatus: 'status-tts-playback',
  rateStatus: 'status-tts-rate',
  secureNotice: 'notice-tts-security',
  unsupportedNotice: 'notice-tts-unsupported'
} as const;

export const TTS_PREVIEW_SELECTORS = {
  actionStatus: 'status-preview-tts-action'
} as const;

export const SPEECH_SYNTHESIS_GENERIC_ERROR_MESSAGE =
  '음성 안내를 재생하지 못했습니다. 다시 시도해 주세요.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isBrowserSpeechSynthesis(
  value: unknown
): value is BrowserSpeechSynthesisLike {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.speak === 'function' &&
    typeof value.pause === 'function' &&
    typeof value.resume === 'function' &&
    typeof value.cancel === 'function' &&
    typeof value.getVoices === 'function' &&
    typeof value.addEventListener === 'function' &&
    typeof value.removeEventListener === 'function'
  );
}

function isUtteranceConstructor(
  value: unknown
): value is BrowserSpeechSynthesisUtteranceConstructor {
  return typeof value === 'function';
}

export function isSpeechSynthesisRate(
  value: unknown
): value is SpeechSynthesisRate {
  return SPEECH_SYNTHESIS_RATE_OPTIONS.some(
    (option) => option.value === value
  );
}

export function findKoreanSpeechSynthesisVoice(
  voices: readonly SpeechSynthesisVoiceLike[]
): SpeechSynthesisVoiceLike | undefined {
  const exactMatch = voices.find(
    ({ lang }) => lang.toLowerCase() === SPEECH_SYNTHESIS_LANGUAGE.toLowerCase()
  );

  return (
    exactMatch ??
    voices.find(({ lang }) => lang.toLowerCase().startsWith('ko'))
  );
}

export function mapSpeechSynthesisError(error: unknown): string {
  switch (error) {
    case 'synthesis-unavailable':
      return '현재 음성 안내 서비스를 사용할 수 없습니다.';
    case 'voice-unavailable':
      return '선택한 음성을 사용할 수 없어 안내를 재생하지 못했습니다.';
    case 'language-unavailable':
      return '한국어 음성 안내를 사용할 수 없습니다.';
    case 'text-too-long':
      return '안내 문장이 너무 길어 음성으로 재생하지 못했습니다.';
    case 'invalid-argument':
      return '음성 안내 설정을 사용할 수 없습니다.';
    case 'not-allowed':
      return '브라우저에서 음성 안내 사용을 허용하지 않았습니다.';
    case 'audio-busy':
      return '다른 음성이 재생 중입니다. 잠시 후 다시 시도해 주세요.';
    case 'audio-hardware':
      return '오디오 장치를 사용할 수 없습니다.';
    case 'network':
      return '음성 안내 서비스에 연결할 수 없습니다.';
    case 'canceled':
    case 'interrupted':
      return '음성 안내가 예기치 않게 중단되었습니다.';
    case 'synthesis-failed':
    default:
      return SPEECH_SYNTHESIS_GENERIC_ERROR_MESSAGE;
  }
}

export function resolveBrowserSpeechSynthesisFactory(
  globalScope: unknown
): SpeechSynthesisFactory | null {
  if (!isRecord(globalScope)) {
    return null;
  }

  const speechGlobal = globalScope as SpeechSynthesisGlobalLike;
  if (
    !isBrowserSpeechSynthesis(speechGlobal.speechSynthesis) ||
    !isUtteranceConstructor(speechGlobal.SpeechSynthesisUtterance)
  ) {
    return null;
  }

  const synthesis = speechGlobal.speechSynthesis;
  const Utterance = speechGlobal.SpeechSynthesisUtterance;

  return () => ({
    createUtterance: (text) =>
      new Utterance(text) as SpeechSynthesisUtteranceLike,
    speak: (utterance) =>
      synthesis.speak(utterance as SpeechSynthesisUtterance),
    pause: () => synthesis.pause(),
    resume: () => synthesis.resume(),
    cancel: () => synthesis.cancel(),
    getVoices: () => synthesis.getVoices(),
    addEventListener: (type, listener) =>
      synthesis.addEventListener(type, listener),
    removeEventListener: (type, listener) =>
      synthesis.removeEventListener(type, listener)
  });
}

export function createBrowserSpeechSynthesisFactory():
  | SpeechSynthesisFactory
  | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return resolveBrowserSpeechSynthesisFactory(window);
}
