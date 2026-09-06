import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import {
  combineSpeechRecognitionConfidences,
  createBrowserSpeechRecognitionFactory,
  createUnexpectedEndError,
  mapSpeechRecognitionError,
  type MappedSpeechRecognitionError,
  type SpeechRecognitionErrorEventLike,
  type SpeechRecognitionEventLike,
  type SpeechRecognitionFactory,
  type SpeechRecognitionInstance,
  type SpeechRecognitionStatus
} from '@/features/F4_VoiceController/model/speech-recognition';
import type { SttEvent } from '@/types/stt-events';

export interface UseSpeechRecognitionOptions {
  sessionId: string;
  disabled?: boolean;
  isSecureInput?: boolean;
  onSttEvent?: (event: SttEvent) => void;
  recognitionFactory?: SpeechRecognitionFactory | null;
  now?: () => number;
  createUtteranceId?: () => string;
}

export interface UseSpeechRecognitionResult {
  status: SpeechRecognitionStatus;
  interimText: string;
  finalText: string;
  errorMessage: string;
  isSupported: boolean;
  retryable: boolean;
  start: () => void;
  stop: () => void;
  retry: () => void;
  clear: () => void;
}

interface ActiveRecognition {
  generation: number;
  recognition: SpeechRecognitionInstance;
  sessionId: string;
  utteranceId: string;
  sequence: number;
  finalEmitted: boolean;
  errorEmitted: boolean;
  stopRequested: boolean;
}

interface RecognitionSegment {
  text: string;
  confidence: number;
}

let fallbackUtteranceSequence = 0;

function defaultNow(): number {
  return Date.now();
}

function defaultCreateUtteranceId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  fallbackUtteranceSequence += 1;
  return `utterance-${Date.now()}-${fallbackUtteranceSequence}`;
}

function detachRecognitionHandlers(
  recognition: SpeechRecognitionInstance
): void {
  recognition.onstart = null;
  recognition.onresult = null;
  recognition.onerror = null;
  recognition.onend = null;
}

function getResultSegment(
  event: SpeechRecognitionEventLike,
  index: number
): { segment: RecognitionSegment; isFinal: boolean } | null {
  const result = event.results[index] ?? event.results.item?.(index);
  if (!result) {
    return null;
  }

  const alternative = result[0] ?? result.item?.(0);
  if (!alternative) {
    return null;
  }

  const text = alternative.transcript.trim();
  if (!text) {
    return null;
  }

  return {
    segment: { text, confidence: alternative.confidence },
    isFinal: result.isFinal
  };
}

function combineSegmentText(segments: readonly RecognitionSegment[]): string {
  return segments.map(({ text }) => text).join(' ').trim();
}

export function useSpeechRecognition({
  sessionId,
  disabled = false,
  isSecureInput = false,
  onSttEvent,
  recognitionFactory,
  now = defaultNow,
  createUtteranceId = defaultCreateUtteranceId
}: UseSpeechRecognitionOptions): UseSpeechRecognitionResult {
  const resolvedFactory = useMemo(
    () =>
      recognitionFactory === undefined
        ? createBrowserSpeechRecognitionFactory()
        : recognitionFactory,
    [recognitionFactory]
  );
  const isSupported = resolvedFactory !== null;
  const [status, setStatus] = useState<SpeechRecognitionStatus>(
    isSupported ? 'IDLE' : 'UNSUPPORTED'
  );
  const [interimText, setInterimText] = useState('');
  const [finalText, setFinalText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [retryable, setRetryable] = useState(false);
  const mountedRef = useRef(true);
  const generationRef = useRef(0);
  const activeRef = useRef<ActiveRecognition | null>(null);
  const statusRef = useRef(status);
  const disabledRef = useRef(disabled);
  const secureInputRef = useRef(isSecureInput);
  const onSttEventRef = useRef(onSttEvent);
  const previousDisabledRef = useRef(disabled);

  statusRef.current = status;
  disabledRef.current = disabled;
  secureInputRef.current = isSecureInput;
  onSttEventRef.current = onSttEvent;

  const setStatusValue = useCallback((nextStatus: SpeechRecognitionStatus) => {
    statusRef.current = nextStatus;
    if (mountedRef.current) {
      setStatus(nextStatus);
    }
  }, []);

  const disposeActiveRecognition = useCallback((shouldAbort: boolean) => {
    generationRef.current += 1;
    const active = activeRef.current;
    activeRef.current = null;

    if (!active) {
      return;
    }

    detachRecognitionHandlers(active.recognition);
    if (shouldAbort) {
      try {
        active.recognition.abort();
      } catch {
        // Cleanup must remain best-effort and must not expose browser errors.
      }
    }
  }, []);

  const isCurrentActive = useCallback((generation: number): boolean => {
    return (
      mountedRef.current &&
      !disabledRef.current &&
      !secureInputRef.current &&
      activeRef.current?.generation === generation
    );
  }, []);

  const emitEvent = useCallback((event: SttEvent) => {
    if (
      !mountedRef.current ||
      disabledRef.current ||
      secureInputRef.current
    ) {
      return;
    }

    onSttEventRef.current?.(event);
  }, []);

  const commitError = useCallback(
    (
      active: ActiveRecognition,
      mappedError: MappedSpeechRecognitionError
    ) => {
      if (
        !isCurrentActive(active.generation) ||
        active.errorEmitted
      ) {
        return;
      }

      active.errorEmitted = true;
      setErrorMessage(mappedError.message);
      setRetryable(mappedError.retryable);
      setStatusValue('ERROR');
      emitEvent({
        type: 'STT_ERROR',
        sessionId: active.sessionId,
        utteranceId: active.utteranceId,
        timestamp: now(),
        ...mappedError
      });
    },
    [emitEvent, isCurrentActive, now, setStatusValue]
  );

  const start = useCallback(() => {
    const normalizedSessionId = sessionId.trim();
    if (
      !resolvedFactory ||
      !normalizedSessionId ||
      disabledRef.current ||
      secureInputRef.current ||
      statusRef.current === 'STARTING' ||
      statusRef.current === 'LISTENING' ||
      statusRef.current === 'STOPPING'
    ) {
      if (!resolvedFactory) {
        setStatusValue('UNSUPPORTED');
      }
      return;
    }

    disposeActiveRecognition(true);
    setInterimText('');
    setFinalText('');
    setErrorMessage('');
    setRetryable(false);

    const utteranceId = createUtteranceId();
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    let recognition: SpeechRecognitionInstance;

    try {
      recognition = resolvedFactory();
    } catch {
      const mappedError: MappedSpeechRecognitionError = {
        code: 'UNKNOWN_ERROR',
        message: '음성 인식을 시작할 수 없습니다.',
        retryable: false
      };
      setErrorMessage(mappedError.message);
      setRetryable(mappedError.retryable);
      setStatusValue('ERROR');
      emitEvent({
        type: 'STT_ERROR',
        sessionId: normalizedSessionId,
        utteranceId,
        timestamp: now(),
        ...mappedError
      });
      return;
    }

    const active: ActiveRecognition = {
      generation,
      recognition,
      sessionId: normalizedSessionId,
      utteranceId,
      sequence: 0,
      finalEmitted: false,
      errorEmitted: false,
      stopRequested: false
    };
    activeRef.current = active;

    recognition.onstart = () => {
      if (!isCurrentActive(generation)) {
        return;
      }

      setStatusValue('LISTENING');
      emitEvent({
        type: 'STT_STARTED',
        sessionId: active.sessionId,
        utteranceId: active.utteranceId,
        timestamp: now()
      });
    };

    recognition.onresult = (event) => {
      if (!isCurrentActive(generation) || active.finalEmitted) {
        return;
      }

      const partialSegments: RecognitionSegment[] = [];
      const finalSegments: RecognitionSegment[] = [];
      const resultCount = Number.isFinite(event.results.length)
        ? Math.max(0, Math.trunc(event.results.length))
        : 0;
      const startIndex = Number.isFinite(event.resultIndex)
        ? Math.max(0, Math.trunc(event.resultIndex))
        : 0;

      for (let index = startIndex; index < resultCount; index += 1) {
        const resultSegment = getResultSegment(event, index);
        if (!resultSegment) {
          continue;
        }

        if (resultSegment.isFinal) {
          finalSegments.push(resultSegment.segment);
        } else {
          partialSegments.push(resultSegment.segment);
        }
      }

      const partial = combineSegmentText(partialSegments);
      if (partial) {
        active.sequence += 1;
        setInterimText(partial);
        emitEvent({
          type: 'STT_PARTIAL_RESULT',
          sessionId: active.sessionId,
          utteranceId: active.utteranceId,
          timestamp: now(),
          text: partial,
          language: 'ko-KR',
          sequence: active.sequence,
          isFinal: false,
          confidence: combineSpeechRecognitionConfidences(
            partialSegments.map(({ confidence }) => confidence)
          )
        });
      }

      const final = combineSegmentText(finalSegments);
      if (!final || active.finalEmitted) {
        return;
      }

      active.finalEmitted = true;
      active.sequence += 1;
      setInterimText('');
      setFinalText(final);
      setStatusValue('COMPLETED');
      emitEvent({
        type: 'STT_FINAL_RESULT',
        sessionId: active.sessionId,
        utteranceId: active.utteranceId,
        timestamp: now(),
        text: final,
        language: 'ko-KR',
        sequence: active.sequence,
        isFinal: true,
        confidence: combineSpeechRecognitionConfidences(
          finalSegments.map(({ confidence }) => confidence)
        )
      });
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      if (!isCurrentActive(generation)) {
        return;
      }

      const mappedError = mapSpeechRecognitionError(event);
      if (mappedError) {
        commitError(active, mappedError);
      }
    };

    recognition.onend = () => {
      if (!isCurrentActive(generation)) {
        return;
      }

      if (active.finalEmitted) {
        setStatusValue('COMPLETED');
      } else if (active.errorEmitted) {
        setStatusValue('ERROR');
      } else if (active.stopRequested) {
        setStatusValue('IDLE');
      } else {
        commitError(active, createUnexpectedEndError());
      }

      disposeActiveRecognition(false);
    };

    setStatusValue('STARTING');
    try {
      recognition.start();
    } catch {
      commitError(active, {
        code: 'UNKNOWN_ERROR',
        message: '음성 인식을 시작할 수 없습니다.',
        retryable: false
      });
    }
  }, [
    commitError,
    createUtteranceId,
    disposeActiveRecognition,
    emitEvent,
    isCurrentActive,
    now,
    resolvedFactory,
    sessionId,
    setStatusValue
  ]);

  const stop = useCallback(() => {
    if (
      statusRef.current !== 'STARTING' &&
      statusRef.current !== 'LISTENING'
    ) {
      return;
    }

    const active = activeRef.current;
    if (!active || active.stopRequested) {
      return;
    }

    active.stopRequested = true;
    setStatusValue('STOPPING');
    try {
      active.recognition.stop();
    } catch {
      commitError(active, {
        code: 'UNKNOWN_ERROR',
        message: '음성 입력을 중지할 수 없습니다.',
        retryable: true
      });
    }
  }, [commitError, setStatusValue]);

  const retry = useCallback(() => {
    if (
      statusRef.current !== 'ERROR' ||
      !retryable ||
      disabledRef.current ||
      secureInputRef.current
    ) {
      return;
    }

    disposeActiveRecognition(true);
    setInterimText('');
    setFinalText('');
    setErrorMessage('');
    setRetryable(false);
    setStatusValue('IDLE');
    start();
  }, [disposeActiveRecognition, retryable, setStatusValue, start]);

  const clear = useCallback(() => {
    disposeActiveRecognition(true);
    setInterimText('');
    setFinalText('');
    setErrorMessage('');
    setRetryable(false);
    setStatusValue(isSupported ? 'IDLE' : 'UNSUPPORTED');
  }, [disposeActiveRecognition, isSupported, setStatusValue]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      disposeActiveRecognition(true);
    };
  }, [disposeActiveRecognition]);

  useEffect(() => {
    disposeActiveRecognition(true);
    setStatusValue(isSupported ? 'IDLE' : 'UNSUPPORTED');
  }, [disposeActiveRecognition, isSupported, resolvedFactory, setStatusValue]);

  useEffect(() => {
    if (!isSecureInput) {
      return;
    }

    disposeActiveRecognition(true);
    setInterimText('');
    setFinalText('');
    setErrorMessage('');
    setRetryable(false);
    setStatusValue(isSupported ? 'IDLE' : 'UNSUPPORTED');
  }, [
    disposeActiveRecognition,
    isSecureInput,
    isSupported,
    setStatusValue
  ]);

  useEffect(() => {
    const becameDisabled = disabled && !previousDisabledRef.current;
    previousDisabledRef.current = disabled;
    if (!becameDisabled || !activeRef.current) {
      return;
    }

    disposeActiveRecognition(true);
    setStatusValue(isSupported ? 'IDLE' : 'UNSUPPORTED');
  }, [disabled, disposeActiveRecognition, isSupported, setStatusValue]);

  return {
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
  };
}
