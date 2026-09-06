import { useCallback, useEffect, useRef, useState } from 'react';

import { validateChatMessage } from '../model/chat-message-policy';

interface SpeechRecognitionAlternativeLike { transcript: string }
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function recognitionConstructor() {
  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

export function useAgentSpeechRecognition(options: {
  blocked: boolean;
  onDraft: (draft: string) => void;
  onSensitive: () => void;
}) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const blockedRef = useRef(options.blocked);
  const [isListening, setIsListening] = useState(false);
  const Constructor = typeof window === 'undefined' ? undefined : recognitionConstructor();

  blockedRef.current = options.blocked;

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
  }, []);

  const abort = useCallback(() => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.abort();
    }
    setIsListening(false);
  }, []);

  const start = useCallback(() => {
    if (!Constructor || options.blocked || recognitionRef.current) return;
    const recognition = new Constructor();
    recognition.lang = 'ko-KR';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      if (blockedRef.current || recognitionRef.current !== recognition) return;
      let draft = '';
      for (let index = 0; index < event.results.length; index += 1) {
        draft += event.results[index][0]?.transcript ?? '';
      }
      const validation = validateChatMessage(draft);
      if (validation.issues.includes('SENSITIVE_INFORMATION')) {
        abort();
        options.onDraft('');
        options.onSensitive();
        return;
      }
      options.onDraft(draft);
    };
    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      recognitionRef.current = null;
      setIsListening(false);
    };
    recognition.onerror = recognition.onend;
    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  }, [Constructor, abort, options]);

  useEffect(() => {
    if (options.blocked) abort();
  }, [abort, options.blocked]);

  useEffect(() => () => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.abort();
    }
  }, []);

  return { isSupported: Boolean(Constructor), isListening, start, stop };
}

export function useAgentSpeechSynthesis(blocked: boolean, sessionId: string | null) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const synthesis = typeof window === 'undefined' ? undefined : window.speechSynthesis;

  const stop = useCallback(() => {
    synthesis?.cancel();
    setIsSpeaking(false);
  }, [synthesis]);

  const speak = useCallback((text: string) => {
    if (!synthesis || blocked || !validateChatMessage(text).isValid) return;
    synthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    synthesis.speak(utterance);
  }, [blocked, synthesis]);

  useEffect(() => {
    stop();
  }, [blocked, sessionId, stop]);

  useEffect(() => stop, [stop]);

  return { isSupported: Boolean(synthesis), isSpeaking, speak, stop };
}
