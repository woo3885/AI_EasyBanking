import type { SttErrorCode } from '@/types/stt-events';

export const SPEECH_RECOGNITION_LANGUAGE = 'ko-KR' as const;

export type SpeechRecognitionStatus =
  | 'IDLE'
  | 'STARTING'
  | 'LISTENING'
  | 'STOPPING'
  | 'COMPLETED'
  | 'ERROR'
  | 'UNSUPPORTED';

export interface SpeechRecognitionAlternativeLike {
  readonly transcript: string;
  readonly confidence: number;
}

export interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: SpeechRecognitionAlternativeLike | undefined;
  item?: (index: number) => SpeechRecognitionAlternativeLike | null;
}

export interface SpeechRecognitionResultListLike {
  readonly length: number;
  readonly [index: number]: SpeechRecognitionResultLike | undefined;
  item?: (index: number) => SpeechRecognitionResultLike | null;
}

export interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}

export interface SpeechRecognitionErrorEventLike {
  readonly error: string;
  readonly message?: string;
}

export interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export type SpeechRecognitionConstructor =
  new () => SpeechRecognitionInstance;

export type SpeechRecognitionFactory = () => SpeechRecognitionInstance;

interface SpeechRecognitionGlobalLike {
  SpeechRecognition?: unknown;
  webkitSpeechRecognition?: unknown;
}

export interface MappedSpeechRecognitionError {
  code: SttErrorCode;
  message: string;
  retryable: boolean;
}

export const VOICE_CONTROLLER_SELECTORS = {
  root: 'controller-voice-input',
  startButton: 'btn-stt-start',
  stopButton: 'btn-stt-stop',
  retryButton: 'btn-stt-retry',
  clearButton: 'btn-stt-clear',
  status: 'status-stt-recognition',
  interimTranscript: 'transcript-stt-interim',
  finalTranscript: 'transcript-stt-final',
  unsupportedNotice: 'notice-stt-unsupported',
  secureDisabledNotice: 'notice-stt-secure-disabled'
} as const;

export const VOICE_CONTROLLER_PREVIEW_SELECTORS = {
  root: 'preview-voice-controller',
  eventStatus: 'status-preview-stt-event'
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSpeechRecognitionConstructor(
  value: unknown
): value is SpeechRecognitionConstructor {
  return typeof value === 'function';
}

export function configureSpeechRecognition(
  recognition: SpeechRecognitionInstance
): SpeechRecognitionInstance {
  recognition.lang = SPEECH_RECOGNITION_LANGUAGE;
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;
  return recognition;
}

export function resolveBrowserSpeechRecognitionFactory(
  globalScope: unknown
): SpeechRecognitionFactory | null {
  if (!isRecord(globalScope)) {
    return null;
  }

  const speechGlobal = globalScope as SpeechRecognitionGlobalLike;
  const constructorCandidate =
    speechGlobal.SpeechRecognition ??
    speechGlobal.webkitSpeechRecognition;

  if (!isSpeechRecognitionConstructor(constructorCandidate)) {
    return null;
  }

  return () => configureSpeechRecognition(new constructorCandidate());
}

export function createBrowserSpeechRecognitionFactory():
  | SpeechRecognitionFactory
  | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return resolveBrowserSpeechRecognitionFactory(window);
}

export function normalizeSpeechRecognitionConfidence(
  confidence: unknown
): number | null {
  return typeof confidence === 'number' &&
    Number.isFinite(confidence) &&
    confidence >= 0 &&
    confidence <= 1
    ? confidence
    : null;
}

export function combineSpeechRecognitionConfidences(
  confidences: readonly unknown[]
): number | null {
  if (confidences.length === 0) {
    return null;
  }

  const normalized = confidences.map(normalizeSpeechRecognitionConfidence);
  if (normalized.some((confidence) => confidence === null)) {
    return null;
  }

  return Math.min(...(normalized as number[]));
}

export function mapSpeechRecognitionError(
  event: SpeechRecognitionErrorEventLike,
  intentionalAbort = false
): MappedSpeechRecognitionError | null {
  if (event.error === 'aborted' && intentionalAbort) {
    return null;
  }

  switch (event.error) {
    case 'no-speech':
      return {
        code: 'NO_SPEECH_DETECTED',
        message: '음성이 들리지 않았습니다. 다시 말씀해 주세요.',
        retryable: true
      };
    case 'audio-capture':
      return {
        code: 'MICROPHONE_UNAVAILABLE',
        message: '마이크를 사용할 수 없습니다.',
        retryable: true
      };
    case 'not-allowed':
      return {
        code: 'PERMISSION_DENIED',
        message: '마이크 사용 권한을 확인해 주세요.',
        retryable: false
      };
    case 'service-not-allowed':
      return {
        code: 'PERMISSION_DENIED',
        message: '음성 인식 서비스 사용이 허용되지 않았습니다.',
        retryable: false
      };
    case 'network':
      return {
        code: 'STT_SERVER_ERROR',
        message: '음성 인식 서비스에 연결할 수 없습니다.',
        retryable: true
      };
    case 'language-not-supported':
      return {
        code: 'UNKNOWN_ERROR',
        message: '한국어 음성 인식을 지원하지 않습니다.',
        retryable: false
      };
    case 'aborted':
      return {
        code: 'UNKNOWN_ERROR',
        message: '음성 입력이 중단되었습니다.',
        retryable: true
      };
    case 'phrases-not-supported':
    case 'bad-grammar':
      return {
        code: 'UNKNOWN_ERROR',
        message: '음성 인식 설정을 사용할 수 없습니다.',
        retryable: false
      };
    default:
      return {
        code: 'UNKNOWN_ERROR',
        message: '음성 인식 중 문제가 발생했습니다.',
        retryable: false
      };
  }
}

export function createUnexpectedEndError(): MappedSpeechRecognitionError {
  return {
    code: 'UNKNOWN_ERROR',
    message: '음성 입력이 예기치 않게 종료되었습니다.',
    retryable: true
  };
}
