import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  type SpeechRecognitionAlternativeLike,
  type SpeechRecognitionErrorEventLike,
  type SpeechRecognitionEventLike,
  type SpeechRecognitionFactory,
  type SpeechRecognitionInstance,
  type SpeechRecognitionResultLike,
  type SpeechRecognitionResultListLike
} from '@/features/F4_VoiceController/model/speech-recognition';
import type { SttEvent } from '@/types/stt-events';

import { useSpeechRecognition } from './useSpeechRecognition';

interface MockSegment {
  text?: string;
  confidence?: number;
  isFinal?: boolean;
  hasAlternative?: boolean;
}

function createResult(segment: MockSegment): SpeechRecognitionResultLike {
  const alternatives: SpeechRecognitionAlternativeLike[] =
    segment.hasAlternative === false
      ? []
      : [
          {
            transcript: segment.text ?? '',
            confidence: segment.confidence ?? 0.8
          }
        ];

  return Object.assign(alternatives, {
    isFinal: segment.isFinal ?? false,
    item: (index: number) => alternatives[index] ?? null
  });
}

function createResultEvent(
  segments: readonly MockSegment[],
  resultIndex = 0
): SpeechRecognitionEventLike {
  const results = segments.map(createResult);
  const resultList = Object.assign(results, {
    item: (index: number) => results[index] ?? null
  }) as SpeechRecognitionResultListLike;

  return { resultIndex, results: resultList };
}

class MockRecognition implements SpeechRecognitionInstance {
  lang = 'ko-KR';
  interimResults = true;
  continuous = false;
  maxAlternatives = 1;
  onstart: (() => void) | null = null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null = null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();

  emitStart() {
    this.onstart?.();
  }

  emitResult(segments: readonly MockSegment[], resultIndex = 0) {
    this.onresult?.(createResultEvent(segments, resultIndex));
  }

  emitError(error: string, message = 'raw-provider-error') {
    this.onerror?.({ error, message });
  }

  emitEnd() {
    this.onend?.();
  }
}

function createRecognitionHarness() {
  const instances: MockRecognition[] = [];
  const factory: SpeechRecognitionFactory = vi.fn(() => {
    const recognition = new MockRecognition();
    instances.push(recognition);
    return recognition;
  });

  return { factory, instances };
}

function createOptions(
  factory: SpeechRecognitionFactory | null,
  onSttEvent = vi.fn<(event: SttEvent) => void>()
) {
  return {
    sessionId: 'session-d12-test',
    recognitionFactory: factory,
    onSttEvent,
    now: vi.fn(() => 1_000),
    createUtteranceId: vi.fn(() => 'utterance-d12-test')
  };
}

describe('useSpeechRecognition', () => {
  it('지원 환경은 IDLE로 시작하고 사용자 start 호출 전 instance나 마이크를 시작하지 않는다', () => {
    const harness = createRecognitionHarness();
    const { result } = renderHook(() =>
      useSpeechRecognition(createOptions(harness.factory))
    );

    expect(result.current.status).toBe('IDLE');
    expect(result.current.isSupported).toBe(true);
    expect(harness.factory).not.toHaveBeenCalled();
  });

  it('factory가 없으면 UNSUPPORTED이며 start를 호출해도 인식이 시작되지 않는다', () => {
    const { result } = renderHook(() =>
      useSpeechRecognition(createOptions(null))
    );

    expect(result.current.status).toBe('UNSUPPORTED');
    expect(result.current.isSupported).toBe(false);
    act(() => result.current.start());
    expect(result.current.status).toBe('UNSUPPORTED');
  });

  it('start에서 STARTING이 되고 onstart 시 STT_STARTED와 LISTENING을 만든다', () => {
    const harness = createRecognitionHarness();
    const onSttEvent = vi.fn<(event: SttEvent) => void>();
    const options = createOptions(harness.factory, onSttEvent);
    const { result } = renderHook(() => useSpeechRecognition(options));

    act(() => result.current.start());
    const recognition = harness.instances[0];

    expect(result.current.status).toBe('STARTING');
    expect(recognition.start).toHaveBeenCalledOnce();
    expect(recognition).toMatchObject({
      lang: 'ko-KR',
      interimResults: true,
      continuous: false,
      maxAlternatives: 1
    });
    expect(onSttEvent).not.toHaveBeenCalled();

    act(() => recognition.emitStart());

    expect(result.current.status).toBe('LISTENING');
    expect(onSttEvent).toHaveBeenCalledWith({
      type: 'STT_STARTED',
      sessionId: 'session-d12-test',
      utteranceId: 'utterance-d12-test',
      timestamp: 1_000
    });
  });

  it('빈 sessionId와 실행 중 중복 start를 차단한다', () => {
    const harness = createRecognitionHarness();
    const { result, rerender } = renderHook(
      ({ sessionId }) =>
        useSpeechRecognition({
          ...createOptions(harness.factory),
          sessionId
        }),
      { initialProps: { sessionId: '' } }
    );

    act(() => result.current.start());
    expect(harness.factory).not.toHaveBeenCalled();

    rerender({ sessionId: 'session-d12-test' });
    act(() => {
      result.current.start();
      result.current.start();
    });
    expect(harness.factory).toHaveBeenCalledOnce();
    expect(harness.instances[0].start).toHaveBeenCalledOnce();
  });

  it('stop은 STARTING·LISTENING에서 STOPPING으로 전환하고 중복 호출을 막는다', () => {
    const harness = createRecognitionHarness();
    const { result } = renderHook(() =>
      useSpeechRecognition(createOptions(harness.factory))
    );
    act(() => result.current.start());
    const recognition = harness.instances[0];

    act(() => {
      result.current.stop();
      result.current.stop();
    });

    expect(result.current.status).toBe('STOPPING');
    expect(recognition.stop).toHaveBeenCalledOnce();
    act(() => recognition.emitEnd());
    expect(result.current.status).toBe('IDLE');
  });

  it('stop 이후 도착한 final 결과를 한 번 수용한다', () => {
    const harness = createRecognitionHarness();
    const onSttEvent = vi.fn<(event: SttEvent) => void>();
    const { result } = renderHook(() =>
      useSpeechRecognition(createOptions(harness.factory, onSttEvent))
    );
    act(() => result.current.start());
    const recognition = harness.instances[0];
    act(() => result.current.stop());

    act(() =>
      recognition.emitResult([
        { text: '최종 안내', isFinal: true, confidence: 0.9 }
      ])
    );

    expect(result.current.status).toBe('COMPLETED');
    expect(result.current.finalText).toBe('최종 안내');
    expect(
      onSttEvent.mock.calls.filter(([event]) =>
        event.type === 'STT_FINAL_RESULT'
      )
    ).toHaveLength(1);
  });

  it('resultIndex부터 여러 partial segment를 합치고 sequence를 증가시킨다', () => {
    const harness = createRecognitionHarness();
    const onSttEvent = vi.fn<(event: SttEvent) => void>();
    const now = vi
      .fn<() => number>()
      .mockReturnValueOnce(1_100)
      .mockReturnValueOnce(1_200);
    const { result } = renderHook(() =>
      useSpeechRecognition({
        ...createOptions(harness.factory, onSttEvent),
        now
      })
    );
    act(() => result.current.start());
    const recognition = harness.instances[0];
    act(() => recognition.emitStart());

    act(() =>
      recognition.emitResult(
        [
          { text: '무시할 이전 결과' },
          { text: '예금 상품을', confidence: 0.9 },
          { text: '찾아 주세요', confidence: 0.7 }
        ],
        1
      )
    );

    expect(result.current.interimText).toBe('예금 상품을 찾아 주세요');
    expect(onSttEvent).toHaveBeenLastCalledWith({
      type: 'STT_PARTIAL_RESULT',
      sessionId: 'session-d12-test',
      utteranceId: 'utterance-d12-test',
      timestamp: 1_200,
      text: '예금 상품을 찾아 주세요',
      language: 'ko-KR',
      sequence: 1,
      isFinal: false,
      confidence: 0.7
    });
  });

  it('여러 final segment를 합쳐 한 번만 전달하고 timing·words를 만들지 않는다', () => {
    const harness = createRecognitionHarness();
    const onSttEvent = vi.fn<(event: SttEvent) => void>();
    const { result } = renderHook(() =>
      useSpeechRecognition(createOptions(harness.factory, onSttEvent))
    );
    act(() => result.current.start());
    const recognition = harness.instances[0];

    act(() =>
      recognition.emitResult([
        { text: '예금 가입을', isFinal: true, confidence: 0.92 },
        { text: '도와주세요', isFinal: true, confidence: 0.85 }
      ])
    );
    act(() =>
      recognition.emitResult([
        { text: '늦은 중간 결과', isFinal: false, confidence: 0.5 }
      ])
    );

    const finalEvents = onSttEvent.mock.calls
      .map(([event]) => event)
      .filter((event) => event.type === 'STT_FINAL_RESULT');
    expect(result.current.finalText).toBe('예금 가입을 도와주세요');
    expect(result.current.interimText).toBe('');
    expect(result.current.status).toBe('COMPLETED');
    expect(finalEvents).toHaveLength(1);
    expect(finalEvents[0]).toMatchObject({
      text: '예금 가입을 도와주세요',
      sequence: 1,
      confidence: 0.85
    });
    expect(finalEvents[0]).not.toHaveProperty('startedAt');
    expect(finalEvents[0]).not.toHaveProperty('endedAt');
    expect(finalEvents[0]).not.toHaveProperty('durationMs');
    expect(finalEvents[0]).not.toHaveProperty('words');
  });

  it('빈 transcript와 alternative가 없는 결과는 무시한다', () => {
    const harness = createRecognitionHarness();
    const onSttEvent = vi.fn<(event: SttEvent) => void>();
    const { result } = renderHook(() =>
      useSpeechRecognition(createOptions(harness.factory, onSttEvent))
    );
    act(() => result.current.start());
    const recognition = harness.instances[0];

    act(() =>
      recognition.emitResult([
        { text: '   ' },
        { hasAlternative: false }
      ])
    );

    expect(result.current.interimText).toBe('');
    expect(onSttEvent).not.toHaveBeenCalled();
  });

  it.each([
    [Number.NaN, null],
    [-0.1, null],
    [1.1, null],
    [0, 0],
    [1, 1]
  ])('confidence %s를 %s로 정규화한다', (confidence, expected) => {
    const harness = createRecognitionHarness();
    const onSttEvent = vi.fn<(event: SttEvent) => void>();
    const { result } = renderHook(() =>
      useSpeechRecognition(createOptions(harness.factory, onSttEvent))
    );
    act(() => result.current.start());

    act(() =>
      harness.instances[0].emitResult([{ text: '중간 결과', confidence }])
    );

    expect(onSttEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ confidence: expected })
    );
  });

  it('브라우저 오류를 안전한 STT_ERROR로 한 번 변환하고 raw message를 숨긴다', () => {
    const harness = createRecognitionHarness();
    const onSttEvent = vi.fn<(event: SttEvent) => void>();
    const { result } = renderHook(() =>
      useSpeechRecognition(createOptions(harness.factory, onSttEvent))
    );
    act(() => result.current.start());
    const recognition = harness.instances[0];

    act(() => {
      recognition.emitError('network', 'provider-secret');
      recognition.emitError('network', 'provider-secret');
    });

    expect(result.current.status).toBe('ERROR');
    expect(result.current.errorMessage).toBe(
      '음성 인식 서비스에 연결할 수 없습니다.'
    );
    expect(result.current.errorMessage).not.toContain('provider-secret');
    expect(result.current.retryable).toBe(true);
    expect(
      onSttEvent.mock.calls.filter(([event]) => event.type === 'STT_ERROR')
    ).toHaveLength(1);
  });

  it('예상하지 않은 aborted와 end를 재시도 가능한 오류로 처리한다', () => {
    const harness = createRecognitionHarness();
    const onSttEvent = vi.fn<(event: SttEvent) => void>();
    const { result } = renderHook(() =>
      useSpeechRecognition(createOptions(harness.factory, onSttEvent))
    );
    act(() => result.current.start());
    act(() => harness.instances[0].emitError('aborted'));
    expect(result.current.errorMessage).toBe('음성 입력이 중단되었습니다.');

    act(() => result.current.retry());
    expect(harness.instances).toHaveLength(2);
    act(() => harness.instances[1].emitEnd());
    expect(result.current.status).toBe('ERROR');
    expect(result.current.errorMessage).toBe(
      '음성 입력이 예기치 않게 종료되었습니다.'
    );
  });

  it('retry는 새 utterance를 시작하고 이전 instance의 늦은 callback을 차단한다', () => {
    const harness = createRecognitionHarness();
    const onSttEvent = vi.fn<(event: SttEvent) => void>();
    const createUtteranceId = vi
      .fn<() => string>()
      .mockReturnValueOnce('utterance-old')
      .mockReturnValueOnce('utterance-new');
    const { result } = renderHook(() =>
      useSpeechRecognition({
        ...createOptions(harness.factory, onSttEvent),
        createUtteranceId
      })
    );
    act(() => result.current.start());
    const oldRecognition = harness.instances[0];
    const staleResultHandler = oldRecognition.onresult;
    act(() => oldRecognition.emitError('network'));

    act(() => result.current.retry());
    expect(oldRecognition.abort).toHaveBeenCalledOnce();
    expect(harness.instances[1].start).toHaveBeenCalledOnce();
    act(() =>
      staleResultHandler?.(
        createResultEvent([{ text: '폐기할 결과', isFinal: true }])
      )
    );

    expect(result.current.finalText).toBe('');
    expect(onSttEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ text: '폐기할 결과' })
    );
  });

  it('clear는 실행 중 instance를 abort하고 transcript와 오류를 지우며 빈 이벤트를 보내지 않는다', () => {
    const harness = createRecognitionHarness();
    const onSttEvent = vi.fn<(event: SttEvent) => void>();
    const { result } = renderHook(() =>
      useSpeechRecognition(createOptions(harness.factory, onSttEvent))
    );
    act(() => result.current.start());
    act(() =>
      harness.instances[0].emitResult([{ text: '지울 중간 결과' }])
    );
    const eventCount = onSttEvent.mock.calls.length;

    act(() => result.current.clear());

    expect(harness.instances[0].abort).toHaveBeenCalledOnce();
    expect(result.current.status).toBe('IDLE');
    expect(result.current.interimText).toBe('');
    expect(result.current.finalText).toBe('');
    expect(result.current.errorMessage).toBe('');
    expect(onSttEvent).toHaveBeenCalledTimes(eventCount);
  });

  it('secure 진입은 abort·transcript 삭제·stale callback 차단을 수행하고 해제 후 자동 시작하지 않는다', () => {
    const harness = createRecognitionHarness();
    const onSttEvent = vi.fn<(event: SttEvent) => void>();
    const options = createOptions(harness.factory, onSttEvent);
    const { result, rerender } = renderHook(
      ({ isSecureInput }) =>
        useSpeechRecognition({ ...options, isSecureInput }),
      { initialProps: { isSecureInput: false } }
    );
    act(() => result.current.start());
    const recognition = harness.instances[0];
    act(() => recognition.emitResult([{ text: '삭제할 중간 결과' }]));
    const staleResultHandler = recognition.onresult;
    const eventCount = onSttEvent.mock.calls.length;

    rerender({ isSecureInput: true });

    expect(recognition.abort).toHaveBeenCalledOnce();
    expect(result.current.interimText).toBe('');
    expect(result.current.finalText).toBe('');
    act(() => {
      result.current.start();
      result.current.retry();
      staleResultHandler?.(
        createResultEvent([{ text: '보안 이후 결과', isFinal: true }])
      );
    });
    expect(harness.instances).toHaveLength(1);
    expect(onSttEvent).toHaveBeenCalledTimes(eventCount);

    rerender({ isSecureInput: false });
    expect(harness.instances).toHaveLength(1);
  });

  it('disabled는 start를 막고 실행 중 전환 시 abort하되 기존 transcript를 보존한다', () => {
    const harness = createRecognitionHarness();
    const options = createOptions(harness.factory);
    const { result, rerender } = renderHook(
      ({ disabled }) => useSpeechRecognition({ ...options, disabled }),
      { initialProps: { disabled: true } }
    );
    act(() => result.current.start());
    expect(harness.instances).toHaveLength(0);

    rerender({ disabled: false });
    act(() => result.current.start());
    act(() =>
      harness.instances[0].emitResult([{ text: '보존할 중간 결과' }])
    );
    rerender({ disabled: true });

    expect(harness.instances[0].abort).toHaveBeenCalledOnce();
    expect(result.current.status).toBe('IDLE');
    expect(result.current.interimText).toBe('보존할 중간 결과');
  });

  it('unmount는 handler 제거 후 abort하고 늦은 callback을 차단한다', () => {
    const harness = createRecognitionHarness();
    const onSttEvent = vi.fn<(event: SttEvent) => void>();
    const { result, unmount } = renderHook(() =>
      useSpeechRecognition(createOptions(harness.factory, onSttEvent))
    );
    act(() => result.current.start());
    const recognition = harness.instances[0];
    const staleResultHandler = recognition.onresult;

    unmount();
    expect(recognition.abort).toHaveBeenCalledOnce();
    expect(recognition.onresult).toBeNull();
    act(() =>
      staleResultHandler?.(
        createResultEvent([{ text: 'unmount 이후', isFinal: true }])
      )
    );
    expect(onSttEvent).not.toHaveBeenCalled();
  });

  it('factory 또는 start 동기 예외를 안전한 STT_ERROR로 변환한다', () => {
    const onSttEvent = vi.fn<(event: SttEvent) => void>();
    const throwingFactory: SpeechRecognitionFactory = () => {
      throw new Error('raw factory error');
    };
    const { result } = renderHook(() =>
      useSpeechRecognition(createOptions(throwingFactory, onSttEvent))
    );

    act(() => result.current.start());

    expect(result.current.status).toBe('ERROR');
    expect(result.current.errorMessage).toBe(
      '음성 인식을 시작할 수 없습니다.'
    );
    expect(onSttEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'STT_ERROR', code: 'UNKNOWN_ERROR' })
    );
  });
});
