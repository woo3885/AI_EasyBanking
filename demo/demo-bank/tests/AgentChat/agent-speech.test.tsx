import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ConversationMessage } from '../../src/features/AgentChat/model/conversation-types';
import AgentChatPanel from '../../src/features/AgentChat/ui/AgentChatPanel';
import AgentChatShell from '../../src/features/AgentChat/ui/AgentChatShell';
import { useAgentSpeechSynthesis } from '../../src/features/AgentChat/hooks/use-agent-speech';

let recognitionInstance: FakeRecognition | null = null;
class FakeRecognition {
  lang = ''; interimResults = false; continuous = false;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null = null;
  onend: (() => void) | null = null; onerror: (() => void) | null = null;
  start = vi.fn(); stop = vi.fn(); abort = vi.fn();
  constructor() { recognitionInstance = this; }
}

afterEach(() => {
  delete (window as typeof window & { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
  recognitionInstance = null;
});

function SpeechHarness({ blocked = false, sessionId = 'session-1' }: { blocked?: boolean; sessionId?: string }) {
  const speech = useAgentSpeechSynthesis(blocked, sessionId);
  return <button type="button" onClick={() => speech.speak('안전한 AI 안내입니다.')}>읽어주기</button>;
}

describe('agent speech controls', () => {
  it('STT 미지원 브라우저에는 음성 입력 control을 표시하지 않는다', () => {
    render(<AgentChatShell onSubmitRequest={vi.fn()} />);
    expect(screen.queryByRole('button', { name: '음성 입력 시작' })).not.toBeInTheDocument();
  });

  it('보호 상태에서는 STT 시작을 실제 disabled 처리한다', () => {
    render(<AgentChatPanel value="" messages={[]} submitPhase="IDLE" safeError={null}
      interactionBlocked onDraftChange={vi.fn()} onSubmit={vi.fn()} onDismissError={vi.fn()}
      speechRecognition={{ isSupported: true, isListening: false, start: vi.fn(), stop: vi.fn() }} />);
    expect(screen.getByRole('button', { name: '음성 입력 시작' })).toBeDisabled();
  });
  it('STT final 결과도 draft만 바꾸고 자동 전송하지 않는다', async () => {
    (window as typeof window & { webkitSpeechRecognition?: typeof FakeRecognition }).webkitSpeechRecognition = FakeRecognition;
    const user = userEvent.setup(); const onSubmitRequest = vi.fn();
    render(<AgentChatShell onSubmitRequest={onSubmitRequest} />);
    await user.click(screen.getByRole('button', { name: '음성 입력 시작' }));
    act(() => recognitionInstance?.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: '12개월 예금 가입' } }] }));
    expect(screen.getByRole('textbox', { name: '업무 요청' })).toHaveValue('12개월 예금 가입');
    expect(onSubmitRequest).not.toHaveBeenCalled();
  });

  it('STT partial 결과도 draft만 바꾸고 자동 전송하지 않는다', async () => {
    (window as typeof window & { webkitSpeechRecognition?: typeof FakeRecognition }).webkitSpeechRecognition = FakeRecognition;
    const user = userEvent.setup(); const onSubmitRequest = vi.fn();
    render(<AgentChatShell onSubmitRequest={onSubmitRequest} />);
    await user.click(screen.getByRole('button', { name: '음성 입력 시작' }));
    act(() => recognitionInstance?.onresult?.({ resultIndex: 0, results: [{ isFinal: false, 0: { transcript: '예금 상품' } }] }));
    expect(screen.getByRole('textbox', { name: '업무 요청' })).toHaveValue('예금 상품');
    expect(onSubmitRequest).not.toHaveBeenCalled();
  });

  it('민감정보 의심 STT 결과를 draft에 저장하지 않는다', async () => {
    (window as typeof window & { webkitSpeechRecognition?: typeof FakeRecognition }).webkitSpeechRecognition = FakeRecognition;
    const user = userEvent.setup();
    render(<AgentChatShell onSubmitRequest={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '음성 입력 시작' }));
    act(() => recognitionInstance?.onresult?.({ resultIndex: 0, results: [{ isFinal: false, 0: { transcript: 'OTP는 123456' } }] }));
    expect(screen.getByRole('textbox', { name: '업무 요청' })).toHaveValue('');
    expect(screen.getByRole('alert')).toHaveTextContent('비밀번호나 인증번호는 채팅에 입력할 수 없습니다.');
  });

  it('AI 메시지는 수동 버튼에서만 TTS를 실행하고 중지를 제공한다', async () => {
    const speak = vi.fn(); const stop = vi.fn(); const user = userEvent.setup();
    const message: ConversationMessage = { messageId: 'ai-1', role: 'AI', kind: 'MESSAGE', sequence: 1,
      text: '예금 기간을 알려 주세요.', questionId: null, goalRevision: 1, occurredAt: '2026-09-03T00:00:00Z' };
    render(<AgentChatPanel value="" messages={[message]} submitPhase="IDLE" safeError={null}
      onDraftChange={vi.fn()} onSubmit={vi.fn()} onDismissError={vi.fn()}
      speechSynthesis={{ isSupported: true, isSpeaking: false, speak, stop }} />);
    expect(speak).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '이 안내 읽어주기' }));
    expect(speak).toHaveBeenCalledWith('예금 기간을 알려 주세요.');
    expect(screen.queryByRole('button', { name: '읽기 중지' })).not.toBeInTheDocument();
  });

  it('TTS는 자동 재생하지 않고 session 변경과 unmount에서 cancel한다', async () => {
    const user = userEvent.setup();
    const speak = vi.fn(); const cancel = vi.fn();
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speak, cancel } });
    Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', { configurable: true,
      value: class { lang = ''; onend: (() => void) | null = null; onerror: (() => void) | null = null; constructor(public text: string) {} } });
    const { rerender, unmount } = render(<SpeechHarness />);
    expect(speak).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '읽어주기' }));
    expect(speak).toHaveBeenCalledTimes(1);
    rerender(<SpeechHarness sessionId="session-2" />);
    expect(cancel).toHaveBeenCalled();
    const count = cancel.mock.calls.length;
    unmount();
    expect(cancel.mock.calls.length).toBeGreaterThan(count);
  });

  it('차단 상태에서는 TTS를 실행하지 않는다', async () => {
    const user = userEvent.setup(); const speak = vi.fn(); const cancel = vi.fn();
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speak, cancel } });
    Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', { configurable: true, value: class { constructor(public text: string) {} } });
    render(<SpeechHarness blocked />);
    await user.click(screen.getByRole('button', { name: '읽어주기' }));
    expect(speak).not.toHaveBeenCalled();
  });

  it('STT는 unmount에서 recognition을 abort한다', async () => {
    (window as typeof window & { webkitSpeechRecognition?: typeof FakeRecognition }).webkitSpeechRecognition = FakeRecognition;
    const user = userEvent.setup();
    const { unmount } = render(<AgentChatShell onSubmitRequest={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '음성 입력 시작' }));
    const instance = recognitionInstance;
    unmount();
    expect(instance?.abort).toHaveBeenCalledTimes(1);
  });
});
