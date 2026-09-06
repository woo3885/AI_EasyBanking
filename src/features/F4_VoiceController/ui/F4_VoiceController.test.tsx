import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  VOICE_CONTROLLER_SELECTORS,
  type SpeechRecognitionAlternativeLike,
  type SpeechRecognitionErrorEventLike,
  type SpeechRecognitionEventLike,
  type SpeechRecognitionFactory,
  type SpeechRecognitionInstance,
  type SpeechRecognitionResultLike,
  type SpeechRecognitionResultListLike
} from '@/features/F4_VoiceController/model/speech-recognition';
import {
  TTS_CONTROLLER_SELECTORS,
  type SpeechSynthesisAdapter,
  type SpeechSynthesisErrorEventLike,
  type SpeechSynthesisFactory,
  type SpeechSynthesisUtteranceLike,
  type SpeechSynthesisVoiceLike
} from '@/features/F4_VoiceController/model/speech-synthesis';
import type { SttEvent } from '@/types/stt-events';

import F4_VoiceController from './F4_VoiceController';

interface MockSegment {
  text: string;
  isFinal?: boolean;
  confidence?: number;
}

function createResultEvent(
  segments: readonly MockSegment[]
): SpeechRecognitionEventLike {
  const results = segments.map((segment) => {
    const alternatives: SpeechRecognitionAlternativeLike[] = [
      {
        transcript: segment.text,
        confidence: segment.confidence ?? 0.9
      }
    ];
    return Object.assign(alternatives, {
      isFinal: segment.isFinal ?? false,
      item: (index: number) => alternatives[index] ?? null
    }) as SpeechRecognitionResultLike;
  });
  const resultList = Object.assign(results, {
    item: (index: number) => results[index] ?? null
  }) as SpeechRecognitionResultListLike;

  return { resultIndex: 0, results: resultList };
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

  emitResult(segments: readonly MockSegment[]) {
    this.onresult?.(createResultEvent(segments));
  }

  emitError(error: string, message = 'provider-private-message') {
    this.onerror?.({ error, message });
  }
}

function createHarness() {
  const instances: MockRecognition[] = [];
  const factory: SpeechRecognitionFactory = vi.fn(() => {
    const recognition = new MockRecognition();
    instances.push(recognition);
    return recognition;
  });

  return { factory, instances };
}

class MockTtsUtterance implements SpeechSynthesisUtteranceLike {
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

class MockTtsHarness implements SpeechSynthesisAdapter {
  voices: SpeechSynthesisVoiceLike[] = [
    { name: 'mock-korean', lang: 'ko-KR' }
  ];
  utterances: MockTtsUtterance[] = [];
  voiceListener: (() => void) | null = null;
  createUtterance = vi.fn((text: string) => {
    const utterance = new MockTtsUtterance(text);
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
  removeEventListener = vi.fn();
  factory: SpeechSynthesisFactory = vi.fn(() => this);
}

describe('F4_VoiceController', () => {
  it('고정 selector와 접근 가능한 대형 실제 버튼을 초기 상태에 맞게 표시한다', () => {
    const harness = createHarness();
    render(
      <F4_VoiceController
        sessionId="session-ui-test"
        recognitionFactory={harness.factory}
      />
    );

    const controller = screen.getByRole('region', { name: '음성 입력' });
    expect(controller).toHaveAttribute('id', VOICE_CONTROLLER_SELECTORS.root);
    expect(controller).toHaveAttribute(
      'data-testid',
      VOICE_CONTROLLER_SELECTORS.root
    );
    expect(controller).toHaveAttribute('aria-busy', 'false');

    const start = screen.getByRole('button', { name: '음성 입력 시작' });
    const stop = screen.getByRole('button', { name: '음성 입력 중지' });
    const retry = screen.getByRole('button', { name: '다시 시도' });
    const clear = screen.getByRole('button', { name: '인식 내용 지우기' });
    for (const button of [start, stop, retry, clear]) {
      expect(button).toHaveAttribute('type', 'button');
      expect(button.className).toContain('min-h-14');
      expect(button.id).toBe(button.getAttribute('data-testid'));
    }
    expect(start).toBeEnabled();
    expect(start).toHaveAttribute('aria-pressed', 'false');
    expect(stop).toBeDisabled();
    expect(retry).toBeDisabled();
    expect(clear).toBeDisabled();
    expect(harness.factory).not.toHaveBeenCalled();
  });

  it('사용자 클릭에서만 시작하고 STARTING·LISTENING·STOPPING을 안내한다', async () => {
    const user = userEvent.setup();
    const harness = createHarness();
    const onSttEvent = vi.fn<(event: SttEvent) => void>();
    render(
      <F4_VoiceController
        sessionId="session-ui-test"
        recognitionFactory={harness.factory}
        onSttEvent={onSttEvent}
      />
    );

    await user.click(screen.getByRole('button', { name: '음성 입력 시작' }));
    const recognition = harness.instances[0];
    expect(recognition.start).toHaveBeenCalledOnce();
    expect(screen.getByTestId(VOICE_CONTROLLER_SELECTORS.status)).toHaveTextContent(
      '마이크 연결을 준비하고 있습니다.'
    );
    expect(screen.getByRole('region', { name: '음성 입력' })).toHaveAttribute(
      'aria-busy',
      'true'
    );
    expect(screen.getByRole('button', { name: '음성 입력 시작' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    act(() => recognition.emitStart());
    expect(screen.getByTestId(VOICE_CONTROLLER_SELECTORS.status)).toHaveTextContent(
      '음성을 듣고 있습니다. 말씀해 주세요.'
    );
    expect(onSttEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'STT_STARTED',
        sessionId: 'session-ui-test'
      })
    );

    await user.click(screen.getByRole('button', { name: '음성 입력 중지' }));
    expect(recognition.stop).toHaveBeenCalledOnce();
    expect(screen.getByTestId(VOICE_CONTROLLER_SELECTORS.status)).toHaveTextContent(
      '음성 입력을 마치는 중입니다.'
    );
  });

  it('partial과 final 결과를 live 정책에 맞게 표시하고 callback으로 전달한다', async () => {
    const user = userEvent.setup();
    const harness = createHarness();
    const onSttEvent = vi.fn<(event: SttEvent) => void>();
    render(
      <F4_VoiceController
        sessionId="session-ui-test"
        recognitionFactory={harness.factory}
        onSttEvent={onSttEvent}
      />
    );
    await user.click(screen.getByRole('button', { name: '음성 입력 시작' }));

    act(() =>
      harness.instances[0].emitResult([
        { text: '예금 상품을 찾아', confidence: 0.8 }
      ])
    );
    const interim = screen.getByTestId(
      VOICE_CONTROLLER_SELECTORS.interimTranscript
    );
    expect(interim).toHaveTextContent('예금 상품을 찾아');
    expect(interim).toHaveAttribute('aria-live', 'off');

    act(() =>
      harness.instances[0].emitResult([
        {
          text: '예금 상품을 찾아 주세요',
          isFinal: true,
          confidence: 0.9
        }
      ])
    );
    const final = screen.getByTestId(
      VOICE_CONTROLLER_SELECTORS.finalTranscript
    );
    expect(final).toHaveTextContent('예금 상품을 찾아 주세요');
    expect(final).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByTestId(VOICE_CONTROLLER_SELECTORS.status)).toHaveTextContent(
      '음성 인식이 완료되었습니다.'
    );
    expect(onSttEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'STT_PARTIAL_RESULT',
        text: '예금 상품을 찾아'
      })
    );
    expect(onSttEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'STT_FINAL_RESULT',
        text: '예금 상품을 찾아 주세요'
      })
    );

    await user.click(screen.getByRole('button', { name: '인식 내용 지우기' }));
    expect(final).toHaveTextContent('아직 완료된 인식 결과가 없습니다.');
  });

  it('재시도 가능한 오류는 안전한 alert와 retry 동작을 제공한다', async () => {
    const user = userEvent.setup();
    const harness = createHarness();
    render(
      <F4_VoiceController
        sessionId="session-ui-test"
        recognitionFactory={harness.factory}
      />
    );
    await user.click(screen.getByRole('button', { name: '음성 입력 시작' }));
    act(() => harness.instances[0].emitError('network'));

    expect(
      screen.getByText('음성 인식 서비스에 연결할 수 없습니다.')
    ).toBeInTheDocument();
    expect(screen.queryByText('provider-private-message')).not.toBeInTheDocument();
    const retry = screen.getByRole('button', { name: '다시 시도' });
    expect(retry).toBeEnabled();
    await user.click(retry);
    expect(harness.instances).toHaveLength(2);
    expect(harness.instances[1].start).toHaveBeenCalledOnce();
  });

  it('권한 오류는 retry를 비활성화하고 unsupported 대안을 표시한다', async () => {
    const user = userEvent.setup();
    const harness = createHarness();
    const { unmount } = render(
      <F4_VoiceController
        sessionId="session-ui-test"
        recognitionFactory={harness.factory}
      />
    );
    await user.click(screen.getByRole('button', { name: '음성 입력 시작' }));
    act(() => harness.instances[0].emitError('not-allowed'));
    expect(
      screen.getByText('마이크 사용 권한을 확인해 주세요.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeDisabled();

    unmount();
    render(
      <F4_VoiceController
        sessionId="session-ui-test"
        recognitionFactory={null}
      />
    );
    expect(
      screen.getByTestId(VOICE_CONTROLLER_SELECTORS.unsupportedNotice)
    ).toHaveTextContent('텍스트 입력으로 진행해 주세요.');
    expect(screen.getByRole('button', { name: '음성 입력 시작' })).toBeDisabled();
  });

  it('secure 전환 즉시 abort·transcript 삭제·버튼 차단을 수행한다', async () => {
    const user = userEvent.setup();
    const harness = createHarness();
    const onSttEvent = vi.fn<(event: SttEvent) => void>();
    const { rerender } = render(
      <F4_VoiceController
        sessionId="session-ui-test"
        recognitionFactory={harness.factory}
        onSttEvent={onSttEvent}
      />
    );
    await user.click(screen.getByRole('button', { name: '음성 입력 시작' }));
    const recognition = harness.instances[0];
    const staleResult = recognition.onresult;
    act(() => recognition.emitResult([{ text: '삭제할 내용' }]));

    rerender(
      <F4_VoiceController
        sessionId="session-ui-test"
        recognitionFactory={harness.factory}
        onSttEvent={onSttEvent}
        isSecureInput
      />
    );
    expect(recognition.abort).toHaveBeenCalledOnce();
    expect(
      screen.getByTestId(VOICE_CONTROLLER_SELECTORS.secureDisabledNotice)
    ).toHaveTextContent('음성 입력이 중단되었습니다.');
    expect(screen.queryByText('삭제할 내용')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '음성 입력 시작' })).toBeDisabled();

    const callbackCount = onSttEvent.mock.calls.length;
    act(() =>
      staleResult?.(
        createResultEvent([{ text: '폐기할 결과', isFinal: true }])
      )
    );
    expect(onSttEvent).toHaveBeenCalledTimes(callbackCount);
    expect(screen.queryByText('폐기할 결과')).not.toBeInTheDocument();
  });

  it('disabled와 빈 sessionId에서 시작을 차단하고 외부 기능을 호출하지 않는다', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    const webSocketMock = vi.fn();
    const speakMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('WebSocket', webSocketMock);
    vi.stubGlobal('speechSynthesis', { speak: speakMock });
    const disabledHarness = createHarness();
    const { unmount } = render(
      <F4_VoiceController
        sessionId="session-ui-test"
        disabled
        recognitionFactory={disabledHarness.factory}
      />
    );
    expect(screen.getByRole('button', { name: '음성 입력 시작' })).toBeDisabled();
    unmount();

    const blankHarness = createHarness();
    render(
      <F4_VoiceController sessionId="  " recognitionFactory={blankHarness.factory} />
    );
    const start = screen.getByRole('button', { name: '음성 입력 시작' });
    expect(start).toBeDisabled();
    await user.click(start);
    expect(disabledHarness.factory).not.toHaveBeenCalled();
    expect(blankHarness.factory).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(webSocketMock).not.toHaveBeenCalled();
    expect(speakMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('TTS section과 고정 selector, 화면 문장, 기본 속도를 접근 가능하게 표시한다', () => {
    const recognition = createHarness();
    const tts = new MockTtsHarness();
    render(
      <F4_VoiceController
        sessionId="session-ui-test"
        message="현재 화면에서 필요한 항목을 선택해 주세요."
        recognitionFactory={recognition.factory}
        synthesisFactory={tts.factory}
      />
    );

    const controller = screen.getByRole('region', { name: '음성 안내' });
    expect(controller).toHaveAttribute('id', TTS_CONTROLLER_SELECTORS.root);
    expect(controller.id).toBe(controller.getAttribute('data-testid'));
    expect(
      screen.getByText('현재 화면에서 필요한 항목을 선택해 주세요.')
    ).toBeInTheDocument();

    const play = screen.getByRole('button', { name: '안내 듣기' });
    const replay = screen.getByRole('button', { name: '다시 듣기' });
    const pause = screen.getByRole('button', { name: '안내 일시정지' });
    const stop = screen.getByRole('button', { name: '음성 중지' });
    for (const button of [play, replay, pause, stop]) {
      expect(button).toHaveAttribute('type', 'button');
      expect(button.className).toContain('min-h-14');
      expect(button.id).toBe(button.getAttribute('data-testid'));
    }
    expect(play).not.toHaveAttribute('aria-pressed');
    expect(replay).not.toHaveAttribute('aria-pressed');
    expect(pause).toHaveAttribute('aria-pressed', 'false');
    expect(stop).not.toHaveAttribute('aria-pressed');
    expect(play).toBeEnabled();
    expect(replay).toBeDisabled();
    expect(pause).toBeDisabled();
    expect(stop).toBeDisabled();

    const rate = screen.getByRole('combobox', { name: '안내 속도' });
    expect(rate).toHaveValue('1');
    expect(rate.id).toBe(rate.getAttribute('data-testid'));
    expect(screen.getByTestId(TTS_CONTROLLER_SELECTORS.rateStatus))
      .toHaveTextContent('현재 속도는 보통입니다.');
    expect(tts.factory).not.toHaveBeenCalled();
  });

  it('TTS play·replay·stop과 STARTING·SPEAKING·COMPLETED 상태를 표시한다', async () => {
    const user = userEvent.setup();
    const tts = new MockTtsHarness();
    render(
      <F4_VoiceController
        sessionId="session-ui-test"
        message="현재 화면에서 필요한 항목을 선택해 주세요."
        recognitionFactory={null}
        synthesisFactory={tts.factory}
      />
    );

    await user.click(screen.getByRole('button', { name: '안내 듣기' }));
    expect(tts.speak).toHaveBeenCalledOnce();
    expect(tts.utterances[0]).toMatchObject({
      lang: 'ko-KR',
      rate: 1,
      voice: { name: 'mock-korean' }
    });
    expect(screen.getByTestId(TTS_CONTROLLER_SELECTORS.playbackStatus))
      .toHaveTextContent('음성 안내 시작을 요청했습니다.');

    act(() => tts.utterances[0].emitStart());
    expect(screen.getByTestId(TTS_CONTROLLER_SELECTORS.playbackStatus))
      .toHaveTextContent('음성 안내를 재생하고 있습니다.');
    await user.click(screen.getByRole('button', { name: '안내 일시정지' }));
    expect(tts.pause).toHaveBeenCalledOnce();
    expect(screen.getByTestId(TTS_CONTROLLER_SELECTORS.playbackStatus))
      .toHaveTextContent('음성 안내를 일시정지했습니다.');
    await user.click(screen.getByRole('button', { name: '안내 계속 듣기' }));
    expect(tts.resume).toHaveBeenCalledOnce();
    act(() => tts.utterances[0].emitEnd());
    expect(screen.getByTestId(TTS_CONTROLLER_SELECTORS.playbackStatus))
      .toHaveTextContent('음성 안내 재생이 끝났습니다.');

    await user.click(screen.getByRole('button', { name: '다시 듣기' }));
    expect(tts.cancel).toHaveBeenCalledOnce();
    expect(tts.utterances).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: '음성 중지' }));
    expect(tts.cancel).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId(TTS_CONTROLLER_SELECTORS.playbackStatus))
      .toHaveTextContent('안내 듣기 버튼으로 음성 안내를 시작할 수 있습니다.');
  });

  it('TTS 속도 변경은 다음 재생에 적용하고 오류는 alert로 안내한다', async () => {
    const user = userEvent.setup();
    const tts = new MockTtsHarness();
    render(
      <F4_VoiceController
        sessionId="session-ui-test"
        message="현재 화면에서 필요한 항목을 선택해 주세요."
        recognitionFactory={null}
        synthesisFactory={tts.factory}
      />
    );
    await user.click(screen.getByRole('button', { name: '안내 듣기' }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: '안내 속도' }),
      '0.8'
    );
    expect(tts.speak).toHaveBeenCalledOnce();
    expect(tts.utterances[0].rate).toBe(1);
    expect(screen.getByTestId(TTS_CONTROLLER_SELECTORS.rateStatus))
      .toHaveTextContent('현재 속도는 느리게입니다.');

    await user.click(screen.getByRole('button', { name: '다시 듣기' }));
    expect(tts.utterances[1].rate).toBe(0.8);
    act(() => tts.utterances[1].emitError('network'));
    expect(
      screen.getByText('음성 안내 서비스에 연결할 수 없습니다.')
    ).toBeInTheDocument();
  });

  it('빈 문장·unsupported·secure·disabled에서 TTS control을 차단한다', async () => {
    const user = userEvent.setup();
    const tts = new MockTtsHarness();
    const { rerender } = render(
      <F4_VoiceController
        sessionId="session-ui-test"
        message=""
        recognitionFactory={null}
        synthesisFactory={tts.factory}
      />
    );
    expect(screen.getByRole('button', { name: '안내 듣기' })).toBeDisabled();

    rerender(
      <F4_VoiceController
        sessionId="session-ui-test"
        message="안전한 안내 문장입니다."
        recognitionFactory={null}
        synthesisFactory={null}
      />
    );
    expect(
      screen.getByTestId(TTS_CONTROLLER_SELECTORS.unsupportedNotice)
    ).toBeInTheDocument();

    rerender(
      <F4_VoiceController
        sessionId="session-ui-test"
        message="안전한 안내 문장입니다."
        recognitionFactory={null}
        synthesisFactory={tts.factory}
      />
    );
    await user.click(screen.getByRole('button', { name: '안내 듣기' }));
    rerender(
      <F4_VoiceController
        sessionId="session-ui-test"
        message="안전한 안내 문장입니다."
        recognitionFactory={null}
        synthesisFactory={tts.factory}
        isSecureInput
      />
    );
    expect(tts.cancel).toHaveBeenCalledOnce();
    expect(
      screen.getByTestId(TTS_CONTROLLER_SELECTORS.secureNotice)
    ).toBeInTheDocument();
    expect(screen.queryByText('안전한 안내 문장입니다.')).not.toBeInTheDocument();
    for (const control of [
      screen.getByRole('button', { name: '안내 듣기' }),
      screen.getByRole('button', { name: '다시 듣기' }),
      screen.getByRole('button', { name: '음성 중지' }),
      screen.getByRole('combobox', { name: '안내 속도' })
    ]) {
      expect(control).toBeDisabled();
    }

    rerender(
      <F4_VoiceController
        sessionId="session-ui-test"
        message="안전한 안내 문장입니다."
        recognitionFactory={null}
        synthesisFactory={tts.factory}
        disabled
      />
    );
    expect(screen.getByRole('button', { name: '안내 듣기' })).toBeDisabled();
    expect(tts.speak).toHaveBeenCalledOnce();
  });
});
