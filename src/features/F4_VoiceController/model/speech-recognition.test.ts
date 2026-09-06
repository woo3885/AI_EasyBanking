import { describe, expect, it, vi } from 'vitest';

import type { SttErrorCode } from '@/types/stt-events';

import {
  combineSpeechRecognitionConfidences,
  mapSpeechRecognitionError,
  normalizeSpeechRecognitionConfidence,
  resolveBrowserSpeechRecognitionFactory,
  type SpeechRecognitionErrorEventLike,
  type SpeechRecognitionEventLike,
  type SpeechRecognitionInstance
} from './speech-recognition';

class MockRecognition implements SpeechRecognitionInstance {
  lang = '';
  interimResults = false;
  continuous = true;
  maxAlternatives = 0;
  onstart: (() => void) | null = null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null = null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
}

class StandardRecognition extends MockRecognition {}
class WebkitRecognition extends MockRecognition {}

describe('speech-recognition adapter', () => {
  it('표준 SpeechRecognition을 webkit보다 우선한다', () => {
    const factory = resolveBrowserSpeechRecognitionFactory({
      SpeechRecognition: StandardRecognition,
      webkitSpeechRecognition: WebkitRecognition
    });

    expect(factory?.()).toBeInstanceOf(StandardRecognition);
  });

  it('표준 생성자가 없으면 webkitSpeechRecognition을 사용한다', () => {
    const factory = resolveBrowserSpeechRecognitionFactory({
      webkitSpeechRecognition: WebkitRecognition
    });

    expect(factory?.()).toBeInstanceOf(WebkitRecognition);
  });

  it('생성자가 없거나 scope가 객체가 아니면 unsupported를 반환한다', () => {
    expect(resolveBrowserSpeechRecognitionFactory({})).toBeNull();
    expect(resolveBrowserSpeechRecognitionFactory(null)).toBeNull();
  });

  it('instance를 생성하고 설정하지만 start는 호출하지 않는다', () => {
    const factory = resolveBrowserSpeechRecognitionFactory({
      SpeechRecognition: StandardRecognition
    });
    const recognition = factory?.();

    expect(recognition).toMatchObject({
      lang: 'ko-KR',
      interimResults: true,
      continuous: false,
      maxAlternatives: 1
    });
    expect(recognition?.start).not.toHaveBeenCalled();
  });

  it.each([
    [
      'no-speech',
      'NO_SPEECH_DETECTED',
      '음성이 들리지 않았습니다. 다시 말씀해 주세요.',
      true
    ],
    [
      'audio-capture',
      'MICROPHONE_UNAVAILABLE',
      '마이크를 사용할 수 없습니다.',
      true
    ],
    [
      'not-allowed',
      'PERMISSION_DENIED',
      '마이크 사용 권한을 확인해 주세요.',
      false
    ],
    [
      'service-not-allowed',
      'PERMISSION_DENIED',
      '음성 인식 서비스 사용이 허용되지 않았습니다.',
      false
    ],
    [
      'network',
      'STT_SERVER_ERROR',
      '음성 인식 서비스에 연결할 수 없습니다.',
      true
    ],
    [
      'language-not-supported',
      'UNKNOWN_ERROR',
      '한국어 음성 인식을 지원하지 않습니다.',
      false
    ],
    [
      'aborted',
      'UNKNOWN_ERROR',
      '음성 입력이 중단되었습니다.',
      true
    ],
    [
      'phrases-not-supported',
      'UNKNOWN_ERROR',
      '음성 인식 설정을 사용할 수 없습니다.',
      false
    ],
    [
      'bad-grammar',
      'UNKNOWN_ERROR',
      '음성 인식 설정을 사용할 수 없습니다.',
      false
    ],
    [
      'vendor-private-error',
      'UNKNOWN_ERROR',
      '음성 인식 중 문제가 발생했습니다.',
      false
    ]
  ] as const)(
    '%s 오류를 기존 SttErrorCode와 안전한 안내로 변환한다',
    (browserCode, code, message, retryable) => {
      const rawEvent = Object.freeze({
        error: browserCode,
        message: 'provider-secret-debug-message'
      });
      const mapped = mapSpeechRecognitionError(rawEvent);

      expect(mapped).toEqual({
        code: code satisfies SttErrorCode,
        message,
        retryable
      });
      expect(mapped?.message).not.toContain(rawEvent.message);
      expect(rawEvent).toEqual({
        error: browserCode,
        message: 'provider-secret-debug-message'
      });
    }
  );

  it('의도적인 aborted는 오류로 변환하지 않는다', () => {
    expect(
      mapSpeechRecognitionError({ error: 'aborted' }, true)
    ).toBeNull();
  });

  it('confidence는 유한한 0~1 값만 허용하고 복수 segment는 최솟값을 사용한다', () => {
    expect(normalizeSpeechRecognitionConfidence(0)).toBe(0);
    expect(normalizeSpeechRecognitionConfidence(1)).toBe(1);
    expect(normalizeSpeechRecognitionConfidence(Number.NaN)).toBeNull();
    expect(normalizeSpeechRecognitionConfidence(-0.1)).toBeNull();
    expect(normalizeSpeechRecognitionConfidence(1.1)).toBeNull();
    expect(combineSpeechRecognitionConfidences([0.9, 0.7])).toBe(0.7);
    expect(combineSpeechRecognitionConfidences([0.9, Number.NaN])).toBeNull();
    expect(combineSpeechRecognitionConfidences([])).toBeNull();
  });

  it('adapter는 네트워크·WebSocket·TTS 기능을 호출하지 않는다', () => {
    const fetchMock = vi.fn();
    const webSocketMock = vi.fn();
    const speakMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('WebSocket', webSocketMock);
    vi.stubGlobal('speechSynthesis', { speak: speakMock });

    const factory = resolveBrowserSpeechRecognitionFactory({
      SpeechRecognition: StandardRecognition
    });
    factory?.();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(webSocketMock).not.toHaveBeenCalled();
    expect(speakMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
