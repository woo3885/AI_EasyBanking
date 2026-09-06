import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

import {
  createBrowserSpeechSynthesisFactory,
  DEFAULT_SPEECH_SYNTHESIS_RATE,
  findKoreanSpeechSynthesisVoice,
  isSpeechSynthesisRate,
  mapSpeechSynthesisError,
  SPEECH_SYNTHESIS_GENERIC_ERROR_MESSAGE,
  SPEECH_SYNTHESIS_LANGUAGE,
  type SpeechSynthesisAdapter,
  type SpeechSynthesisFactory,
  type SpeechSynthesisRate,
  type SpeechSynthesisStatus,
  type SpeechSynthesisUtteranceLike,
  type SpeechSynthesisVoiceLike
} from '@/features/F4_VoiceController/model/speech-synthesis';

export interface UseSpeechSynthesisOptions {
  message?: string;
  disabled?: boolean;
  isSecureInput?: boolean;
  synthesisFactory?: SpeechSynthesisFactory | null;
}

export interface UseSpeechSynthesisResult {
  status: SpeechSynthesisStatus;
  rate: SpeechSynthesisRate;
  errorMessage: string;
  hasPlaybackRequest: boolean;
  isSupported: boolean;
  play: () => void;
  replay: () => void;
  togglePause: () => void;
  stop: () => void;
  setRate: (rate: SpeechSynthesisRate) => void;
}

interface ActiveUtterance {
  generation: number;
  utterance: SpeechSynthesisUtteranceLike;
}

function detachUtteranceHandlers(
  utterance: SpeechSynthesisUtteranceLike
): void {
  utterance.onstart = null;
  utterance.onend = null;
  utterance.onerror = null;
}

export function useSpeechSynthesis({
  message = '',
  disabled = false,
  isSecureInput = false,
  synthesisFactory
}: UseSpeechSynthesisOptions): UseSpeechSynthesisResult {
  const resolvedFactory = useMemo(
    () =>
      synthesisFactory === undefined
        ? createBrowserSpeechSynthesisFactory()
        : synthesisFactory,
    [synthesisFactory]
  );
  const isSupported = resolvedFactory !== null;
  const normalizedMessage = message.trim();
  const [status, setStatus] = useState<SpeechSynthesisStatus>(
    isSupported ? 'IDLE' : 'UNSUPPORTED'
  );
  const [rate, setRateState] = useState<SpeechSynthesisRate>(
    DEFAULT_SPEECH_SYNTHESIS_RATE
  );
  const [errorMessage, setErrorMessage] = useState('');
  const [hasPlaybackRequest, setHasPlaybackRequest] = useState(false);
  const mountedRef = useRef(true);
  const generationRef = useRef(0);
  const activeRef = useRef<ActiveUtterance | null>(null);
  const adapterRef = useRef<SpeechSynthesisAdapter | null>(null);
  const voicesRef = useRef<readonly SpeechSynthesisVoiceLike[]>([]);
  const voiceListenerRef = useRef<(() => void) | null>(null);
  const statusRef = useRef(status);
  const rateRef = useRef(rate);
  const disabledRef = useRef(disabled);
  const secureInputRef = useRef(isSecureInput);
  const messageRef = useRef(normalizedMessage);
  const hasPlaybackRequestRef = useRef(hasPlaybackRequest);
  const previousMessageRef = useRef(normalizedMessage);
  const previousDisabledRef = useRef(disabled);
  const previousSecureInputRef = useRef(isSecureInput);
  const previousFactoryRef = useRef(resolvedFactory);

  statusRef.current = status;
  rateRef.current = rate;
  disabledRef.current = disabled;
  secureInputRef.current = isSecureInput;
  messageRef.current = isSecureInput ? '' : normalizedMessage;
  hasPlaybackRequestRef.current = hasPlaybackRequest;

  const setStatusValue = useCallback((next: SpeechSynthesisStatus) => {
    statusRef.current = next;
    if (mountedRef.current) {
      setStatus(next);
    }
  }, []);

  const setPlaybackRequestValue = useCallback((next: boolean) => {
    hasPlaybackRequestRef.current = next;
    if (mountedRef.current) {
      setHasPlaybackRequest(next);
    }
  }, []);

  const invalidateActive = useCallback((shouldCancel: boolean) => {
    generationRef.current += 1;
    const active = activeRef.current;
    activeRef.current = null;
    if (active) {
      detachUtteranceHandlers(active.utterance);
    }

    if (shouldCancel && adapterRef.current) {
      try {
        adapterRef.current.cancel();
      } catch {
        // Browser cleanup is best-effort and does not expose provider details.
      }
    }
  }, []);

  const detachVoiceListener = useCallback(() => {
    const adapter = adapterRef.current;
    const listener = voiceListenerRef.current;
    if (adapter && listener) {
      try {
        adapter.removeEventListener('voiceschanged', listener);
      } catch {
        // Listener cleanup remains best-effort across browser implementations.
      }
    }
    voiceListenerRef.current = null;
  }, []);

  const getAdapter = useCallback((): SpeechSynthesisAdapter | null => {
    if (adapterRef.current) {
      return adapterRef.current;
    }
    if (!resolvedFactory) {
      return null;
    }

    try {
      const adapter = resolvedFactory();
      adapterRef.current = adapter;
      const listener = () => {
        if (!mountedRef.current || adapterRef.current !== adapter) {
          return;
        }
        try {
          voicesRef.current = adapter.getVoices();
        } catch {
          voicesRef.current = [];
        }
      };
      voiceListenerRef.current = listener;
      adapter.addEventListener('voiceschanged', listener);
      return adapter;
    } catch {
      return null;
    }
  }, [resolvedFactory]);

  const startPlayback = useCallback(
    (shouldRestart: boolean) => {
      const text = messageRef.current;
      if (
        !text ||
        disabledRef.current ||
        secureInputRef.current ||
        !resolvedFactory ||
        (!shouldRestart &&
          (statusRef.current === 'STARTING' ||
            statusRef.current === 'SPEAKING' ||
            statusRef.current === 'PAUSED'))
      ) {
        if (!resolvedFactory) {
          setStatusValue('UNSUPPORTED');
        }
        return;
      }

      const adapter = getAdapter();
      if (!adapter) {
        setErrorMessage(SPEECH_SYNTHESIS_GENERIC_ERROR_MESSAGE);
        setStatusValue('ERROR');
        return;
      }

      if (shouldRestart) {
        invalidateActive(true);
      } else {
        invalidateActive(false);
      }

      try {
        voicesRef.current = adapter.getVoices();
        const utterance = adapter.createUtterance(text);
        const generation = generationRef.current + 1;
        generationRef.current = generation;
        utterance.text = text;
        utterance.lang = SPEECH_SYNTHESIS_LANGUAGE;
        utterance.rate = rateRef.current;
        const koreanVoice = findKoreanSpeechSynthesisVoice(
          voicesRef.current
        );
        if (koreanVoice) {
          utterance.voice = koreanVoice;
        }

        const isCurrent = () =>
          mountedRef.current &&
          !disabledRef.current &&
          !secureInputRef.current &&
          activeRef.current?.generation === generation;

        utterance.onstart = () => {
          if (isCurrent()) {
            setStatusValue('SPEAKING');
          }
        };
        utterance.onend = () => {
          if (!isCurrent()) {
            return;
          }
          detachUtteranceHandlers(utterance);
          activeRef.current = null;
          setStatusValue('COMPLETED');
        };
        utterance.onerror = (event) => {
          if (!isCurrent()) {
            return;
          }
          detachUtteranceHandlers(utterance);
          activeRef.current = null;
          setErrorMessage(mapSpeechSynthesisError(event.error));
          setStatusValue('ERROR');
        };
        activeRef.current = { generation, utterance };
        setErrorMessage('');
        setPlaybackRequestValue(true);
        setStatusValue('STARTING');
        adapter.speak(utterance);
      } catch {
        const active = activeRef.current;
        if (active) {
          detachUtteranceHandlers(active.utterance);
        }
        activeRef.current = null;
        setErrorMessage(SPEECH_SYNTHESIS_GENERIC_ERROR_MESSAGE);
        setStatusValue('ERROR');
      }
    }, [
      getAdapter,
      invalidateActive,
      resolvedFactory,
      setPlaybackRequestValue,
      setStatusValue
    ]
  );

  const play = useCallback(() => {
    startPlayback(false);
  }, [startPlayback]);

  const replay = useCallback(() => {
    if (!hasPlaybackRequestRef.current) {
      return;
    }
    startPlayback(true);
  }, [startPlayback]);

  const togglePause = useCallback(() => {
    const adapter = adapterRef.current;
    if (!adapter || disabledRef.current || secureInputRef.current) {
      return;
    }

    try {
      if (statusRef.current === 'SPEAKING') {
        adapter.pause();
        setStatusValue('PAUSED');
      } else if (statusRef.current === 'PAUSED') {
        adapter.resume();
        setStatusValue('SPEAKING');
      }
    } catch {
      invalidateActive(true);
      setErrorMessage(SPEECH_SYNTHESIS_GENERIC_ERROR_MESSAGE);
      setStatusValue('ERROR');
    }
  }, [invalidateActive, setStatusValue]);

  const stop = useCallback(() => {
    if (
      statusRef.current !== 'STARTING' &&
      statusRef.current !== 'SPEAKING' &&
      statusRef.current !== 'PAUSED'
    ) {
      return;
    }
    invalidateActive(true);
    setErrorMessage('');
    setStatusValue('IDLE');
  }, [invalidateActive, setStatusValue]);

  const setRate = useCallback((nextRate: SpeechSynthesisRate) => {
    if (!isSpeechSynthesisRate(nextRate)) {
      return;
    }
    rateRef.current = nextRate;
    setRateState(nextRate);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const shouldCancel =
        statusRef.current === 'STARTING' ||
        statusRef.current === 'SPEAKING' ||
        statusRef.current === 'PAUSED';
      invalidateActive(shouldCancel);
      detachVoiceListener();
      adapterRef.current = null;
      voicesRef.current = [];
    };
  }, [detachVoiceListener, invalidateActive]);

  useEffect(() => {
    if (previousMessageRef.current === normalizedMessage) {
      return;
    }
    previousMessageRef.current = normalizedMessage;
    const shouldCancel = activeRef.current !== null;
    invalidateActive(shouldCancel);
    setErrorMessage('');
    setPlaybackRequestValue(false);
    setStatusValue(isSupported ? 'IDLE' : 'UNSUPPORTED');
  }, [
    invalidateActive,
    isSupported,
    normalizedMessage,
    setPlaybackRequestValue,
    setStatusValue
  ]);

  useEffect(() => {
    const becameDisabled = disabled && !previousDisabledRef.current;
    previousDisabledRef.current = disabled;
    if (!becameDisabled) {
      return;
    }
    invalidateActive(activeRef.current !== null);
    setErrorMessage('');
    setPlaybackRequestValue(false);
    setStatusValue(isSupported ? 'IDLE' : 'UNSUPPORTED');
  }, [
    disabled,
    invalidateActive,
    isSupported,
    setPlaybackRequestValue,
    setStatusValue
  ]);

  useEffect(() => {
    const enteredSecureInput =
      isSecureInput && !previousSecureInputRef.current;
    previousSecureInputRef.current = isSecureInput;
    if (!enteredSecureInput) {
      return;
    }
    invalidateActive(activeRef.current !== null);
    setErrorMessage('');
    setPlaybackRequestValue(false);
    setStatusValue(isSupported ? 'IDLE' : 'UNSUPPORTED');
  }, [
    invalidateActive,
    isSecureInput,
    isSupported,
    setPlaybackRequestValue,
    setStatusValue
  ]);

  useEffect(() => {
    if (previousFactoryRef.current === resolvedFactory) {
      return;
    }
    previousFactoryRef.current = resolvedFactory;
    invalidateActive(activeRef.current !== null);
    detachVoiceListener();
    adapterRef.current = null;
    voicesRef.current = [];
    setErrorMessage('');
    setPlaybackRequestValue(false);
    setStatusValue(isSupported ? 'IDLE' : 'UNSUPPORTED');
  }, [
    detachVoiceListener,
    invalidateActive,
    isSupported,
    resolvedFactory,
    setPlaybackRequestValue,
    setStatusValue
  ]);

  return {
    status,
    rate,
    errorMessage,
    hasPlaybackRequest,
    isSupported,
    play,
    replay,
    togglePause,
    stop,
    setRate
  };
}
