import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  type SpeechSynthesisAdapter,
  type SpeechSynthesisErrorEventLike,
  type SpeechSynthesisFactory,
  type SpeechSynthesisUtteranceLike,
  type SpeechSynthesisVoiceLike
} from '@/features/F4_VoiceController/model/speech-synthesis';

import { useSpeechSynthesis } from './useSpeechSynthesis';

class MockUtterance implements SpeechSynthesisUtteranceLike {
  text: string;
  lang = '';
  rate = 1;
  voice: SpeechSynthesisVoiceLike | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: SpeechSynthesisErrorEventLike) => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }

  emitStart() {
    this.onstart?.();
  }

  emitEnd() {
    this.onend?.();
  }

  emitError(error: string) {
    this.onerror?.({ error });
  }
}

class SynthesisHarness implements SpeechSynthesisAdapter {
  voices: SpeechSynthesisVoiceLike[] = [];
  utterances: MockUtterance[] = [];
  voiceListener: (() => void) | null = null;
  createUtterance = vi.fn((text: string) => {
    const utterance = new MockUtterance(text);
    this.utterances.push(utterance);
    return utterance;
  });
  speak = vi.fn();
  pause = vi.fn();
  resume = vi.fn();
  cancel = vi.fn();
  getVoices = vi.fn(() => this.voices);
  addEventListener = vi.fn(
    (_type: 'voiceschanged', listener: () => void) => {
      this.voiceListener = listener;
    }
  );
  removeEventListener = vi.fn(
    (_type: 'voiceschanged', listener: () => void) => {
      if (this.voiceListener === listener) {
        this.voiceListener = null;
      }
    }
  );
  factory: SpeechSynthesisFactory = vi.fn(() => this);

  emitVoicesChanged() {
    this.voiceListener?.();
  }
}

function createOptions(
  harness: SynthesisHarness,
  overrides: Partial<Parameters<typeof useSpeechSynthesis>[0]> = {}
) {
  return {
    message: '현재 화면에서 필요한 항목을 선택해 주세요.',
    synthesisFactory: harness.factory,
    ...overrides
  };
}

describe('useSpeechSynthesis', () => {
  it('mount만으로 factory·utterance·voice 조회·speak·cancel을 호출하지 않는다', () => {
    const harness = new SynthesisHarness();
    const { result } = renderHook(() =>
      useSpeechSynthesis(createOptions(harness))
    );

    expect(result.current.status).toBe('IDLE');
    expect(result.current.isSupported).toBe(true);
    expect(harness.factory).not.toHaveBeenCalled();
    expect(harness.createUtterance).not.toHaveBeenCalled();
    expect(harness.getVoices).not.toHaveBeenCalled();
    expect(harness.speak).not.toHaveBeenCalled();
    expect(harness.cancel).not.toHaveBeenCalled();
  });

  it('빈 message와 명시적 null factory에서는 재생하지 않는다', () => {
    const harness = new SynthesisHarness();
    const { result, rerender } = renderHook(
      ({ message, factory }) =>
        useSpeechSynthesis({
          message,
          synthesisFactory: factory
        }),
      {
        initialProps: {
          message: '   ',
          factory: harness.factory as SpeechSynthesisFactory | null
        }
      }
    );
    act(() => result.current.play());
    expect(harness.factory).not.toHaveBeenCalled();

    rerender({ message: '안전한 안내 문장입니다.', factory: null });
    expect(result.current.status).toBe('UNSUPPORTED');
    act(() => result.current.play());
    expect(harness.factory).not.toHaveBeenCalled();
  });

  it('사용자 play에서만 새 utterance와 한국어 exact voice를 설정한다', () => {
    const harness = new SynthesisHarness();
    harness.voices = [
      { name: 'prefix', lang: 'ko' },
      { name: 'exact', lang: 'ko-KR' }
    ];
    const { result } = renderHook(() =>
      useSpeechSynthesis(
        createOptions(harness, { message: '  안전한 안내 문장입니다.  ' })
      )
    );

    act(() => result.current.play());

    expect(harness.factory).toHaveBeenCalledOnce();
    expect(harness.getVoices).toHaveBeenCalledOnce();
    expect(harness.createUtterance).toHaveBeenCalledWith(
      '안전한 안내 문장입니다.'
    );
    expect(harness.utterances[0]).toMatchObject({
      text: '안전한 안내 문장입니다.',
      lang: 'ko-KR',
      rate: 1,
      voice: { name: 'exact', lang: 'ko-KR' }
    });
    expect(harness.speak).toHaveBeenCalledWith(harness.utterances[0]);
    expect(result.current.status).toBe('STARTING');
    expect(result.current.hasPlaybackRequest).toBe(true);
  });

  it('ko prefix를 fallback으로 쓰고 한국어 voice가 없으면 기본 voice에 맡긴다', () => {
    const prefixHarness = new SynthesisHarness();
    prefixHarness.voices = [{ name: 'prefix', lang: 'KO-local' }];
    const prefix = renderHook(() =>
      useSpeechSynthesis(createOptions(prefixHarness))
    );
    act(() => prefix.result.current.play());
    expect(prefixHarness.utterances[0].voice?.name).toBe('prefix');
    prefix.unmount();

    const defaultHarness = new SynthesisHarness();
    defaultHarness.voices = [{ name: 'english', lang: 'en-US' }];
    const fallback = renderHook(() =>
      useSpeechSynthesis(createOptions(defaultHarness))
    );
    act(() => fallback.result.current.play());
    expect(defaultHarness.utterances[0].voice).toBeNull();
  });

  it('onstart와 onend에서 SPEAKING과 COMPLETED로 전환한다', () => {
    const harness = new SynthesisHarness();
    const { result } = renderHook(() =>
      useSpeechSynthesis(createOptions(harness))
    );
    act(() => result.current.play());
    const utterance = harness.utterances[0];

    act(() => utterance.emitStart());
    expect(result.current.status).toBe('SPEAKING');
    act(() => utterance.emitEnd());
    expect(result.current.status).toBe('COMPLETED');
  });

  it('재생 중 일시정지하고 새 utterance 없이 계속 듣기를 지원한다', () => {
    const harness = new SynthesisHarness();
    const { result } = renderHook(() =>
      useSpeechSynthesis(createOptions(harness))
    );
    act(() => result.current.play());
    act(() => harness.utterances[0].emitStart());

    act(() => result.current.togglePause());
    expect(harness.pause).toHaveBeenCalledOnce();
    expect(result.current.status).toBe('PAUSED');

    act(() => result.current.togglePause());
    expect(harness.resume).toHaveBeenCalledOnce();
    expect(result.current.status).toBe('SPEAKING');
    expect(harness.utterances).toHaveLength(1);
  });

  it('동기 speak 예외와 예상하지 않은 onerror를 안전한 ERROR로 처리한다', () => {
    const throwHarness = new SynthesisHarness();
    throwHarness.speak.mockImplementationOnce(() => {
      throw new Error('private provider detail');
    });
    const thrown = renderHook(() =>
      useSpeechSynthesis(createOptions(throwHarness))
    );
    act(() => thrown.result.current.play());
    expect(thrown.result.current.status).toBe('ERROR');
    expect(thrown.result.current.errorMessage).not.toContain('private');
    thrown.unmount();

    const errorHarness = new SynthesisHarness();
    const errored = renderHook(() =>
      useSpeechSynthesis(createOptions(errorHarness))
    );
    act(() => errored.result.current.play());
    act(() => errorHarness.utterances[0].emitError('network'));
    expect(errored.result.current.status).toBe('ERROR');
    expect(errored.result.current.errorMessage).toBe(
      '음성 안내 서비스에 연결할 수 없습니다.'
    );
  });

  it('stop은 실행 중 queue를 cancel하고 stale callback을 무시한다', () => {
    const harness = new SynthesisHarness();
    const { result } = renderHook(() =>
      useSpeechSynthesis(createOptions(harness))
    );
    act(() => result.current.play());
    const staleEnd = harness.utterances[0].onend;
    const staleError = harness.utterances[0].onerror;

    act(() => result.current.stop());
    expect(harness.cancel).toHaveBeenCalledOnce();
    expect(result.current.status).toBe('IDLE');
    act(() => {
      staleEnd?.();
      staleError?.({ error: 'network' });
    });
    expect(result.current.status).toBe('IDLE');
    expect(result.current.errorMessage).toBe('');
  });

  it('replay는 재생 중에도 cancel 후 새 utterance로 처음부터 재생한다', () => {
    const harness = new SynthesisHarness();
    const { result } = renderHook(() =>
      useSpeechSynthesis(createOptions(harness))
    );
    act(() => result.current.play());
    const first = harness.utterances[0];
    const firstEnd = first.onend;

    act(() => result.current.replay());
    expect(harness.cancel).toHaveBeenCalledOnce();
    expect(harness.utterances).toHaveLength(2);
    expect(harness.utterances[1]).not.toBe(first);
    expect(harness.speak).toHaveBeenCalledTimes(2);
    act(() => result.current.replay());
    expect(harness.cancel).toHaveBeenCalledTimes(2);
    expect(harness.utterances).toHaveLength(3);
    act(() => firstEnd?.());
    expect(result.current.status).toBe('STARTING');
  });

  it('message 변경과 빈 값 변경은 cancel·요청 초기화 후 자동 재생하지 않는다', () => {
    const harness = new SynthesisHarness();
    const { result, rerender } = renderHook(
      ({ message }) =>
        useSpeechSynthesis(createOptions(harness, { message })),
      { initialProps: { message: '첫 번째 안전한 안내입니다.' } }
    );
    act(() => result.current.play());
    rerender({ message: '두 번째 안전한 안내입니다.' });
    expect(harness.cancel).toHaveBeenCalledOnce();
    expect(result.current.status).toBe('IDLE');
    expect(result.current.hasPlaybackRequest).toBe(false);
    expect(harness.speak).toHaveBeenCalledOnce();

    act(() => result.current.play());
    rerender({ message: '' });
    expect(harness.cancel).toHaveBeenCalledTimes(2);
    expect(harness.speak).toHaveBeenCalledTimes(2);
  });

  it('disabled와 secure 전환은 cancel하고 해제 후 자동 재생하지 않는다', () => {
    const harness = new SynthesisHarness();
    const { result, rerender } = renderHook(
      ({ disabled, secure }) =>
        useSpeechSynthesis(
          createOptions(harness, {
            disabled,
            isSecureInput: secure
          })
        ),
      { initialProps: { disabled: false, secure: false } }
    );
    act(() => result.current.play());
    rerender({ disabled: true, secure: false });
    expect(harness.cancel).toHaveBeenCalledOnce();
    rerender({ disabled: false, secure: false });
    expect(harness.speak).toHaveBeenCalledOnce();

    act(() => result.current.play());
    const staleStart = harness.utterances[1].onstart;
    rerender({ disabled: false, secure: true });
    expect(harness.cancel).toHaveBeenCalledTimes(2);
    act(() => staleStart?.());
    expect(result.current.status).toBe('IDLE');
    rerender({ disabled: false, secure: false });
    expect(harness.speak).toHaveBeenCalledTimes(2);
  });

  it('속도 변경은 현재 음성을 건드리지 않고 다음 play에만 적용한다', () => {
    const harness = new SynthesisHarness();
    const { result } = renderHook(() =>
      useSpeechSynthesis(createOptions(harness))
    );
    act(() => result.current.play());
    act(() => result.current.setRate(0.8));
    expect(harness.utterances[0].rate).toBe(1);
    expect(harness.speak).toHaveBeenCalledOnce();
    expect(harness.cancel).not.toHaveBeenCalled();

    act(() => result.current.replay());
    expect(harness.utterances[1].rate).toBe(0.8);
    expect(harness.speak).toHaveBeenCalledTimes(2);
  });

  it('voiceschanged는 재시작하지 않고 다음 replay에서 최신 voice를 쓴다', () => {
    const harness = new SynthesisHarness();
    harness.voices = [];
    const { result } = renderHook(() =>
      useSpeechSynthesis(createOptions(harness))
    );
    act(() => result.current.play());
    harness.voices = [{ name: 'late-korean', lang: 'ko-KR' }];
    act(() => harness.emitVoicesChanged());
    expect(harness.speak).toHaveBeenCalledOnce();

    act(() => result.current.replay());
    expect(harness.utterances[1].voice?.name).toBe('late-korean');
  });

  it('factory 변경은 이전 listener와 재생을 정리하고 새 factory를 자동 호출하지 않는다', () => {
    const first = new SynthesisHarness();
    const second = new SynthesisHarness();
    const { result, rerender } = renderHook(
      ({ factory }) =>
        useSpeechSynthesis({
          message: '안전한 안내 문장입니다.',
          synthesisFactory: factory
        }),
      { initialProps: { factory: first.factory } }
    );
    act(() => result.current.play());
    rerender({ factory: second.factory });

    expect(first.cancel).toHaveBeenCalledOnce();
    expect(first.removeEventListener).toHaveBeenCalledOnce();
    expect(second.factory).not.toHaveBeenCalled();
    expect(result.current.status).toBe('IDLE');
  });

  it('unmount는 handler·listener를 제거하고 실행 중 queue를 cancel한다', () => {
    const harness = new SynthesisHarness();
    const { result, unmount } = renderHook(() =>
      useSpeechSynthesis(createOptions(harness))
    );
    act(() => result.current.play());
    const utterance = harness.utterances[0];
    unmount();

    expect(utterance.onstart).toBeNull();
    expect(utterance.onend).toBeNull();
    expect(utterance.onerror).toBeNull();
    expect(harness.removeEventListener).toHaveBeenCalledOnce();
    expect(harness.cancel).toHaveBeenCalledOnce();
  });
});
