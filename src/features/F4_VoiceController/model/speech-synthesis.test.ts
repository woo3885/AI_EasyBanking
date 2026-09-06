import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_SPEECH_SYNTHESIS_RATE,
  findKoreanSpeechSynthesisVoice,
  isSpeechSynthesisRate,
  mapSpeechSynthesisError,
  resolveBrowserSpeechSynthesisFactory,
  SPEECH_SYNTHESIS_RATE_OPTIONS,
  type SpeechSynthesisVoiceLike
} from './speech-synthesis';

function createVoice(
  name: string,
  lang: string
): SpeechSynthesisVoiceLike {
  return { name, lang };
}

describe('speech-synthesis model', () => {
  it('D13 Mock 속도 옵션과 기본값을 단일 계약으로 제공한다', () => {
    expect(DEFAULT_SPEECH_SYNTHESIS_RATE).toBe(1);
    expect(SPEECH_SYNTHESIS_RATE_OPTIONS).toEqual([
      { value: 0.8, label: '느리게' },
      { value: 1, label: '보통' },
      { value: 1.2, label: '빠르게' }
    ]);
    expect([0.8, 1, 1.2].every(isSpeechSynthesisRate)).toBe(true);
    expect(isSpeechSynthesisRate(0.9)).toBe(false);
    expect(isSpeechSynthesisRate(Number.NaN)).toBe(false);
    expect(isSpeechSynthesisRate('1')).toBe(false);
  });

  it('ko-KR 정확 일치를 prefix보다 우선하고 입력 배열을 변경하지 않는다', () => {
    const voices = [
      createVoice('prefix', 'ko'),
      createVoice('english', 'en-US'),
      createVoice('exact', 'ko-KR')
    ];
    const snapshot = [...voices];

    expect(findKoreanSpeechSynthesisVoice(voices)?.name).toBe('exact');
    expect(voices).toEqual(snapshot);
  });

  it('대소문자를 무시한 ko prefix를 사용하고 한국어가 없으면 undefined다', () => {
    expect(
      findKoreanSpeechSynthesisVoice([
        createVoice('english', 'en-US'),
        createVoice('korean', 'KO-kr-x-local')
      ])?.name
    ).toBe('korean');
    expect(
      findKoreanSpeechSynthesisVoice([
        createVoice('english', 'en-US'),
        createVoice('japanese', 'ja-JP')
      ])
    ).toBeUndefined();
  });

  it.each([
    'synthesis-failed',
    'synthesis-unavailable',
    'voice-unavailable',
    'text-too-long',
    'invalid-argument',
    'not-allowed',
    'canceled',
    'interrupted',
    'audio-busy',
    'audio-hardware',
    'network',
    'language-unavailable'
  ])('%s 오류를 원문 없는 안전한 한국어 안내로 매핑한다', (error) => {
    const message = mapSpeechSynthesisError(error);
    expect(message).not.toBe('');
    expect(message).not.toContain(error);
    expect(message).not.toContain('provider-private-message');
  });

  it('알 수 없는 오류는 안전한 공통 문구로 매핑한다', () => {
    expect(mapSpeechSynthesisError('provider-private-message')).toBe(
      '음성 안내를 재생하지 못했습니다. 다시 시도해 주세요.'
    );
  });

  it('브라우저 factory 지원을 판정하되 생성만으로 음성 API를 호출하지 않는다', () => {
    const speak = vi.fn();
    const pause = vi.fn();
    const resume = vi.fn();
    const cancel = vi.fn();
    const getVoices = vi.fn(() => []);
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const Utterance = vi.fn(function MockUtterance(this: object) {
      Object.assign(this, {
        text: '',
        lang: '',
        rate: 1,
        voice: null,
        onstart: null,
        onend: null,
        onerror: null
      });
    });

    const factory = resolveBrowserSpeechSynthesisFactory({
      speechSynthesis: {
        speak,
        pause,
        resume,
        cancel,
        getVoices,
        addEventListener,
        removeEventListener
      },
      SpeechSynthesisUtterance: Utterance
    });

    expect(factory).not.toBeNull();
    expect(Utterance).not.toHaveBeenCalled();
    expect(getVoices).not.toHaveBeenCalled();
    expect(speak).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
    factory?.();
    expect(Utterance).not.toHaveBeenCalled();
    expect(getVoices).not.toHaveBeenCalled();
  });

  it('필수 브라우저 API가 없으면 unsupported를 반환한다', () => {
    expect(resolveBrowserSpeechSynthesisFactory(undefined)).toBeNull();
    expect(resolveBrowserSpeechSynthesisFactory({})).toBeNull();
    expect(
      resolveBrowserSpeechSynthesisFactory({
        speechSynthesis: {
          speak: vi.fn(),
          cancel: vi.fn(),
          getVoices: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn()
        }
      })
    ).toBeNull();
  });
});
